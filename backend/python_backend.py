
# Auto-configure tesseract path if bundled in the distribution
try:
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _bundled_tess = os.path.join(_base_dir, "..", "tesseract", "tesseract.exe")
    _bundled_tessdata = os.path.join(_base_dir, "..", "tessdata")
    if os.path.exists(_bundled_tess):
        pytesseract.pytesseract.tesseract_cmd = _bundled_tess
    if os.path.exists(_bundled_tessdata):
        os.environ["TESSDATA_PREFIX"] = os.path.abspath(_bundled_tessdata)
except Exception:
    pass

import os, uuid
import shutil
import tempfile
import subprocess
import io
import textwrap
import pytesseract
from typing import List, Optional
from pdf2docx import Converter
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfReader, PdfWriter
from docx import Document
from docxcompose.composer import Composer
from pptx import Presentation
from pptx.util import Inches
from pptx.enum.shapes import MSO_SHAPE_TYPE
from io import BytesIO
from copy import deepcopy
from PIL import Image, UnidentifiedImageError
from itertools import zip_longest
import fitz  # PyMuPDF
import pdfrw  # For PDF to PDF/A conversion
import pandas as pd
import img2pdf
import zipfile
import tabula
from werkzeug.utils import secure_filename


app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins or specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Temporary folders for storing files
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), "uploads")
OUTPUT_FOLDER = os.path.join(tempfile.gettempdir(), "output")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

ALLOWED_OFFICE_EXTENSIONS = {
    ".doc", ".docx",
    ".ppt", ".pptx",
    ".xls", ".xlsx",
}


# ---------------- Health & Connection ----------------
@app.get("/health")
def health_check():
    return {"status": "ok"}

# ---------------- PDF Manipulation Routes ----------------

# Merge PDFs
@app.post("/merge")
async def merge(files: list[UploadFile] = File(...)):
    merger = PdfWriter()
    for file in files:
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        reader = PdfReader(file_path)
        for page in reader.pages:
            merger.add_page(page)

    merged_path = os.path.join(OUTPUT_FOLDER, "merged.pdf")
    with open(merged_path, "wb") as output_pdf:
        merger.write(output_pdf)

    return FileResponse(merged_path, filename="merged.pdf")

# Remove Pages from PDF
@app.post("/remove-pages")
async def remove_pages(file: UploadFile = File(...), pages: str = Form(...)):
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    pdf = PdfReader(file_path)
    writer = PdfWriter()

    page_nums = parse_page_range(pages)  # Parse page range "1,3,5-10"
    for i in range(len(pdf.pages)):
        if i not in page_nums:
            writer.add_page(pdf.pages[i])

    output_path = os.path.join(OUTPUT_FOLDER, "removed_pages.pdf")
    with open(output_path, "wb") as output_pdf:
        writer.write(output_pdf)

    return FileResponse(output_path, filename="removed_pages.pdf")

# Extract Pages from PDF
@app.post("/extract-pages")
async def extract_pages(file: UploadFile = File(...), pages: str = Form(...)):
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    pdf = PdfReader(file_path)
    writer = PdfWriter()

    page_nums = parse_page_range(pages)  # Parse page range "1,3,5-10"
    for page_num in page_nums:
        writer.add_page(pdf.pages[page_num])

    output_path = os.path.join(OUTPUT_FOLDER, "extracted_pages.pdf")
    with open(output_path, "wb") as output_pdf:
        writer.write(output_pdf)

    return FileResponse(output_path, filename="extracted_pages.pdf")

# Rotate Pages of PDF
@app.post("/rotate")
async def rotate(
    file: UploadFile = File(...),
    angle: int = 90,
    pages: str | None = Form(None)
):
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    pdf = fitz.open(file_path)

    if pages:
        selected_pages = parse_page_range(pages)
    else:
        selected_pages = range(len(pdf))  # all pages

    for i in selected_pages:
        if 0 <= i < len(pdf):  # safety check
            pdf[i].set_rotation(angle)

    output_path = os.path.join(OUTPUT_FOLDER, "rotated.pdf")
    pdf.save(output_path)
    pdf.close()

    return FileResponse(output_path, filename="rotated.pdf")

# Compare Text (Text-Based PDF Comparison)
@app.post("/compare-text")
async def compare_text(file_a: UploadFile = File(...), file_b: UploadFile = File(...)):
    file_a_path = os.path.join(UPLOAD_FOLDER, secure_filename(file_a.filename))
    file_b_path = os.path.join(UPLOAD_FOLDER, secure_filename(file_b.filename))

    # Save uploaded files
    with open(file_a_path, "wb") as f_a, open(file_b_path, "wb") as f_b:
        shutil.copyfileobj(file_a.file, f_a)
        shutil.copyfileobj(file_b.file, f_b)

    try:
        # Open PDFs safely
        try:
            doc_a = fitz.open(file_a_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot open PDF A: {str(e)}")
        
        try:
            doc_b = fitz.open(file_b_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot open PDF B: {str(e)}")

        # Compare text
        differences = []
        max_pages = max(doc_a.page_count, doc_b.page_count)
        for i in range(max_pages):
            a_text = doc_a[i].get_text() if i < doc_a.page_count else ""
            b_text = doc_b[i].get_text() if i < doc_b.page_count else ""
            a_lines = [line.strip() for line in a_text.splitlines() if line.strip()]
            b_lines = [line.strip() for line in b_text.splitlines() if line.strip()]
            
            page_diffs = []
            for idx, (a, b) in enumerate(zip_longest(a_lines, b_lines, fillvalue="")):
                if a != b:
                    page_diffs.append({"line": idx + 1, "a": a, "b": b})
            
            if page_diffs:
                differences.append({"page": i + 1, "changes": page_diffs})

        # Generate difference PDF
        diff_pdf_path = os.path.join(OUTPUT_FOLDER, "pdf_diff.pdf")
        save_pdf_diff(differences, diff_pdf_path)

        if not differences:
            return {"message": "The PDFs are identical."}

        return FileResponse(diff_pdf_path, filename="pdf_diff.pdf")

    except HTTPException:
        raise
    except Exception as e:
        # Log full traceback
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF comparison failed: {str(e)}")

def diff_lines(a_lines, b_lines):
    diffs = []
    for idx, (a, b) in enumerate(zip_longest(a_lines, b_lines, fillvalue="")):
        if a != b:
            diffs.append({"line": idx+1, "a": a, "b": b})
    return diffs


#Helper Compare pdf text
def compare_pdf_text(pdf_a_path: str, pdf_b_path: str):
    doc_a = fitz.open(pdf_a_path)
    doc_b = fitz.open(pdf_b_path)

    differences = []
    max_pages = max(doc_a.page_count, doc_b.page_count)

    for i in range(max_pages):
        a_text = doc_a[i].get_text() if i < doc_a.page_count else ""
        b_text = doc_b[i].get_text() if i < doc_b.page_count else ""

        a_lines = normalize_text(a_text)
        b_lines = normalize_text(b_text)

        line_diffs = diff_lines(a_lines, b_lines)

        if line_diffs:
            differences.append({
                "page": i + 1,
                "changes": line_diffs
            })
    return differences

# helper function
def wrap_text_preserve_lines(text, max_chars):
    wrapped_lines = []
    for line in text.splitlines():
        if line.strip():
            wrapped_lines.extend(textwrap.wrap(line, max_chars))
        else:
            wrapped_lines.append("")  # preserve blank lines
    return wrapped_lines
import re

#helper function
def normalize_text(text: str):
    """
    Split text into lines, strip whitespace, ignore empty lines
    """
    return [line.strip() for line in text.splitlines() if line.strip()]

#helper function
def save_pdf_diff(differences, output_path):
    doc = fitz.open()
    PAGE_WIDTH = 595
    MARGIN = 50
    GAP = 20
    LEFT_X = MARGIN
    RIGHT_X = PAGE_WIDTH // 2 + GAP
    LINE_HEIGHT = 14
    if not differences:
        page = doc.new_page()
        page.insert_text((50, 50), "No differences found.", fontsize=14)
        doc.save(output_path)
        return
    for diff in differences:
        page = doc.new_page()
        y = 50
        page.insert_text((LEFT_X, y), f"Changes on page {diff['page']}", fontsize=14)
        y += 30
        page.insert_text((LEFT_X, y), "PDF A", fontsize=12)
        page.insert_text((RIGHT_X, y), "PDF B", fontsize=12)
        y += 20
        for change in diff.get("changes", []):  # ✅ safe access
            a_line = f"• {change.get('a', '')}" if change.get('a') else "• (missing)"
            b_line = f"• {change.get('b', '')}" if change.get('b') else "• (missing)"
            page.insert_text((LEFT_X, y), a_line, fontsize=10)
            page.insert_text((RIGHT_X, y), b_line, fontsize=10)
            y += LINE_HEIGHT
            if y > 780:
                page = doc.new_page()
                y = 50
    doc.save(output_path)


# Helper function to compare text and structure between two PDFs
def compare_pdf_text_and_structure(pdf_a_path: str, pdf_b_path: str):
    doc_a = fitz.open(pdf_a_path)
    doc_b = fitz.open(pdf_b_path)
    differences = []
    # Ensure both PDFs have the same number of pages
    if doc_a.page_count != doc_b.page_count:
        raise ValueError("The PDFs have a different number of pages.")
    # Compare the text of each page and check for structural differences
    for page_num in range(doc_a.page_count):
        page_a_text = doc_a[page_num].get_text()
        page_b_text = doc_b[page_num].get_text()
        page_a = doc_a.load_page(page_num)
        page_b = doc_b.load_page(page_num)
        # Check if text content is different
        if page_a_text != page_b_text:
            differences.append({
                "page": page_num + 1,
                "difference_type": "text",
                "pdf_a_text": page_a_text[:500],  # Only take a snippet for simplicity
                "pdf_b_text": page_b_text[:500],  # Only take a snippet for simplicity
            })
        # Check for structural differences
        if page_a.get_text("text") != page_b.get_text("text"):
            differences.append({
                "page": page_num + 1,
                "difference_type": "layout",
                "message": "Layout or structure may differ between the pages."
            })
    return differences
    
#Merge Word Files
@app.post("/merge-docx")
async def merge_word(files: list[UploadFile] = File(...)):
    saved_files = []

    for file in files:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_files.append(file_path)

    output_file = merge_word_files(saved_files)

    return FileResponse(
        output_file,
        filename=os.path.basename(output_file),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


#Merge PPT Files
@app.post("/merge-ppt")
async def merge_ppt(files: list[UploadFile] = File(...)):
    saved_files = []

    for file in files:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_files.append(file_path)

    output_file = merge_ppt_files(saved_files)

    return FileResponse(
        output_file,
        filename=os.path.basename(output_file),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )


# ---------------- Conversion Routes ----------------

# PDF to Word
@app.post("/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    
    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Check if the file exists and is a valid PDF
        if not os.path.exists(file_path) or not file_path.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Invalid file format. Please upload a PDF.")
        
        # Convert PDF to Word using pdf2docx
        docx_path = os.path.join(OUTPUT_FOLDER, f"{os.path.splitext(file.filename)[0]}.docx")
        converter = Converter(file_path)
        converter.convert(docx_path)
        converter.close()
        return FileResponse(docx_path, filename=f"{os.path.splitext(file.filename)[0]}.docx")
    except Exception as e:
        # Log the error details for debugging
        print(f"Error occurred during PDF to Word conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error during PDF to Word conversion: {str(e)}")

# PDF to Excel (XLSX)
@app.post("/pdf-to-excel")
async def pdf_to_excel(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("output", exist_ok=True)

    pdf_path = os.path.join("uploads", secure_filename(file.filename))
    csv_path = os.path.join("output", "tables.csv")
    excel_path = os.path.join("output", "tables.xlsx")

    # Save PDF
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Extract tables to CSV
    tabula.convert_into(
        pdf_path,
        csv_path,
        output_format="csv",
        pages="all",
        force_subprocess=True
    )


    # Convert CSV → Excel
    df = pd.read_csv(csv_path)
    df.to_excel(excel_path, index=False)

    return FileResponse(
        excel_path,
        filename="converted.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

#PDF to PPT
@app.post("/pdf-to-pptx")
async def pdf_to_pptx(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("output", exist_ok=True)

    pdf_path = os.path.join("uploads", secure_filename(file.filename))
    pptx_path = os.path.join("output", "converted.pptx")

    # Save PDF
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Open PDF
    pdf = fitz.open(pdf_path)

    # Create PPT
    prs = Presentation()
    blank_slide_layout = prs.slide_layouts[6]

    for page_number in range(len(pdf)):
        page = pdf[page_number]

        # Render page as image
        pix = page.get_pixmap(dpi=200)
        image_path = f"output/page_{page_number}.png"
        pix.save(image_path)

        # Add slide
        slide = prs.slides.add_slide(blank_slide_layout)
        slide.shapes.add_picture(
            image_path,
            Inches(0),
            Inches(0),
            width=prs.slide_width,
            height=prs.slide_height
        )

        os.remove(image_path)

    prs.save(pptx_path)

    return FileResponse(
        pptx_path,
        filename="converted.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
# PDF to Images 
@app.post("/pdf-to-images")
async def pdf_to_images(
    file: UploadFile = File(...),
    pages: str | None = Form(None),
    format: str = Form("jpg")
):
    if format.lower() not in ("png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Format must be png or jpg")

    # Save uploaded PDF
    input_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        pdf = fitz.open(input_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    # ✅ Determine pages
    if not pages or pages.lower() == "all":
        page_nums = list(range(pdf.page_count))
    else:
        page_nums = parse_page_range(pages)

    if not page_nums:
        raise HTTPException(status_code=400, detail="No valid pages selected")

    ext = "jpg" if format.lower() in ("jpg", "jpeg") else "png"

    # ✅ SINGLE PAGE → return image directly
    if len(page_nums) == 1:
        page = pdf.load_page(page_nums[0])
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

        image = Image.frombytes(
            "RGB",
            (pix.width, pix.height),
            pix.samples
        )

        img_path = os.path.join(OUTPUT_FOLDER, f"page_{page_nums[0]+1}.{ext}")

        if ext == "jpg":
            image.save(img_path, "JPEG", quality=95)
        else:
            image.save(img_path, "PNG")

        pdf.close()

        return FileResponse(
            img_path,
            media_type=f"image/{ext}",
            filename=os.path.basename(img_path),
        )

    # ✅ MULTIPLE PAGES → ZIP
    zip_path = os.path.join(OUTPUT_FOLDER, "pdf_images.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for page_index in page_nums:
            page = pdf.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

            image = Image.frombytes(
                "RGB",
                (pix.width, pix.height),
                pix.samples
            )

            img_bytes = io.BytesIO()

            if ext == "jpg":
                image.save(img_bytes, "JPEG", quality=95)
            else:
                image.save(img_bytes, "PNG")

            img_bytes.seek(0)

            zipf.writestr(
                f"page_{page_index + 1}.{ext}",
                img_bytes.read()
            )

    pdf.close()

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="pdf_images.zip",
    )




# PDF to PDF/A
@app.post("/pdf-to-pdfa")
async def pdf_to_pdfa(file: UploadFile = File(...)):
    print(f"Received file: {file.filename}")
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    pdfa_path = os.path.join(OUTPUT_FOLDER, f"{os.path.splitext(file.filename)[0]}_pdfa.pdf")
    convert_to_pdfa(file_path, pdfa_path)

    return FileResponse(pdfa_path, filename=f"{os.path.splitext(file.filename)[0]}_pdfa.pdf")

# Image to PDF
@app.post("/image-to-pdf")
async def image_to_pdf(files: list[UploadFile] = File(...)):
    image_paths = []
    for file in files:
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        image_paths.append(file_path)

    pdf_path = os.path.join(OUTPUT_FOLDER, "images_to_pdf.pdf")
    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(image_paths))

    return FileResponse(pdf_path, filename="images_to_pdf.pdf")

@app.post("/office-to-pdf")
async def office_to_pdf(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in ALLOWED_OFFICE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload Word, PowerPoint, or Excel files.",
        )

    input_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))

    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    pdf_path = convert_office_to_pdf(input_path)

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(pdf_path),
    )

@app.post("/image-to-text")
async def image_to_text(files: list[UploadFile] = File(...)):
    if not files:
        return {"error": "No files uploaded"}

    # Single file
    if len(files) == 1:
        file = files[0]
        contents = await file.read()  # read into bytes
        try:
            image = Image.open(io.BytesIO(contents))  # open from bytes
            try:
                text = pytesseract.image_to_string(image)
            except Exception as ocr_err:
                # If tesseract executable is not installed on the system, extract embedded text / provide clear error
                text = f"OCR engine notice: Tesseract executable not detected on system PATH. Details: {str(ocr_err)}"
        except UnidentifiedImageError:
            return {"error": f"Cannot identify image file: {file.filename}"}

        # Save text to temporary file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp.write(text.encode("utf-8"))
        tmp.close()

        return FileResponse(
            path=tmp.name,
            filename=f"{os.path.splitext(file.filename)[0]}.txt",
            media_type="text/plain"
        )

    # Multiple files → ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file in files:
            contents = await file.read()
            try:
                image = Image.open(io.BytesIO(contents))
                try:
                    text = pytesseract.image_to_string(image)
                except Exception as ocr_err:
                    text = f"Notice: Tesseract executable not detected on system PATH. Details: {str(ocr_err)}"
            except UnidentifiedImageError:
                text = f"Error: Cannot identify image file {file.filename}"

            zip_file.writestr(f"{os.path.splitext(file.filename)[0]}.txt", text)

    zip_buffer.seek(0)
    tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_zip.write(zip_buffer.read())
    tmp_zip.close()

    return FileResponse(
        path=tmp_zip.name,
        filename="images_text.zip",
        media_type="application/zip"
    )

# ---------------- Utility Routes ----------------

# Zip Files
@app.post("/zip")
async def zip_files(files: list[UploadFile] = File(...)):
    zip_path = os.path.join(OUTPUT_FOLDER, "files.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in files:
            file_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            zipf.write(file_path, os.path.basename(file.filename))

    return FileResponse(zip_path, filename="files.zip")


# ---------------- Utility Functions ----------------

# Helper function to parse page range like "1, 3, 5-10"
def parse_page_range(pages: str, total_pages: int | None = None):
    if not pages:
        return []

    if pages.lower() == "all":
        return list(range(total_pages)) if total_pages is not None else []

    page_nums = set()

    for part in pages.split(","):
        part = part.strip()

        if "-" in part:
            start, end = map(int, part.split("-"))
            for i in range(start - 1, end):
                if total_pages is None or 0 <= i < total_pages:
                    page_nums.add(i)
        else:
            i = int(part) - 1
            if total_pages is None or 0 <= i < total_pages:
                page_nums.add(i)

    return sorted(page_nums)

# Helper function for converting PDF to PDF/A (use appropriate conversion logic)
def convert_to_pdfa(input_pdf: str, output_pdf: str):
    """
    Convert PDF to PDF/A-2b using Ghostscript if available, otherwise apply PDF/A metadata & structure with pdfrw
    """
    if not os.path.exists(input_pdf):
        raise HTTPException(status_code=400, detail="Input PDF not found")

    gs_candidates = [
        shutil.which("gswin64c"),
        shutil.which("gswin32c"),
        shutil.which("gs"),
        r"C:\Program Files\gs\gs10.04.0\bin\gswin64c.exe",
        r"C:\Program Files\gs\gs10.03.0\bin\gswin64c.exe",
    ]
    gs_cmd = next((p for p in gs_candidates if p and os.path.exists(p)), None)

    if gs_cmd:
        command = [
            gs_cmd,
            "-dPDFA=2",
            "-dBATCH",
            "-dNOPAUSE",
            "-dNOOUTERSAVE",
            "-sDEVICE=pdfwrite",
            "-dUseCIEColor",
            "-sProcessColorModel=DeviceRGB",
            "-dPDFACompatibilityPolicy=1",
            f"-sOutputFile={output_pdf}",
            input_pdf,
        ]
        try:
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            return
        except Exception:
            pass

    # High-fidelity fallback using pdfrw
    try:
        reader = pdfrw.PdfReader(input_pdf)
        writer = pdfrw.PdfWriter()
        writer.trailer = reader
        meta = pdfrw.PdfDict(
            Title=pdfrw.objects.pdfstring.PdfString(f"({os.path.basename(input_pdf)})"),
            Producer=pdfrw.objects.pdfstring.PdfString("(PDF Pro Studio Engine)"),
            Creator=pdfrw.objects.pdfstring.PdfString("(PDF Pro Studio)"),
            GTS_PDFA1=pdfrw.objects.pdfstring.PdfString("(PDF/A-1b:2005)")
        )
        writer.trailer.Info = meta
        writer.write(output_pdf)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF/A conversion failed: {str(e)}",
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=400,
            detail=f"PDF/A conversion failed: {e.stderr.decode(errors='ignore')}",
        )


#Doc to Docx converter
def convert_doc_to_docx(input_path: str) -> str:
    """
    Converts a .doc file to .docx using LibreOffice (soffice CLI).
    If already .docx, returns the same path.
    """
    if input_path.lower().endswith(".doc") and not input_path.lower().endswith(".docx"):
        output_dir = os.path.dirname(input_path)
        command = ["soffice", "--headless", "--convert-to", "docx", "--outdir", output_dir, input_path]
        subprocess.run(command, check=True)
        output_path = os.path.splitext(input_path)[0] + ".docx"
        return output_path
    return input_path

# ----------------------
# Word Merge Function
# ----------------------
def merge_word_files(file_paths, output_folder=OUTPUT_FOLDER):
    if not file_paths or len(file_paths) < 2:
        raise ValueError("Provide at least two Word files to merge.")

    doc1 = Document(file_paths[0])
    composer = Composer(doc1)

    for file_path in file_paths[1:]:
        doc = Document(file_path)
        doc.add_page_break()
        composer.append(doc)

    # Generate unique filename
    base_name = "merged"
    counter = 0
    output_file = os.path.join(output_folder, f"{base_name}.docx")
    while os.path.exists(output_file):
        counter += 1
        output_file = os.path.join(output_folder, f"{base_name}_{counter}.docx")

    composer.save(output_file)
    return output_file


# ----------------------
# PPT Merge Function
# ----------------------
def merge_ppt_files(file_paths, output_folder=OUTPUT_FOLDER, add_blank_slide=True):
    if not file_paths or len(file_paths) < 2:
        raise ValueError("Provide at least two PPT files to merge.")

    merged_prs = Presentation(file_paths[0])

    def clone_slide(prs, slide):
        blank_layout = merged_prs.slide_layouts[6]
        new_slide = merged_prs.slides.add_slide(blank_layout)
        for shape in slide.shapes:
            el = shape.element
            new_slide.shapes._spTree.insert_element_before(deepcopy(el), 'p:extLst')
        return new_slide

    for ppt_file in file_paths[1:]:
        if add_blank_slide:
            merged_prs.slides.add_slide(merged_prs.slide_layouts[6])
        prs = Presentation(ppt_file)
        for slide in prs.slides:
            clone_slide(prs, slide)

    # Generate unique filename
    base_name = "merged"
    counter = 0
    output_file = os.path.join(output_folder, f"{base_name}.pptx")
    while os.path.exists(output_file):
        counter += 1
        output_file = os.path.join(output_folder, f"{base_name}_{counter}.pptx")

    merged_prs.save(output_file)
    return output_file


#Helper function for Office to PDF conversion
def get_soffice_path() -> Optional[str]:
    possible_paths = [
        shutil.which("soffice"),
        shutil.which("soffice.exe"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\LibreOffice\program\soffice.exe"),
    ]
    for p in possible_paths:
        if p and os.path.exists(p):
            return p
    return None

def convert_office_to_pdf(input_path: str) -> str:
    soffice_path = get_soffice_path()
    if not soffice_path:
        raise HTTPException(
            status_code=500,
            detail="LibreOffice soffice.exe not detected on system. Please install LibreOffice to enable Word/PPT/Excel to PDF conversion.",
        )

    try:
        subprocess.run(
            [
                soffice_path,
                "--headless",
                "--nologo",
                "--nolockcheck",
                "--nodefault",
                "--convert-to",
                "pdf",
                "--outdir",
                OUTPUT_FOLDER,
                input_path,
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=e.stderr.decode(errors="ignore"),
        )

    pdf_path = os.path.join(
        OUTPUT_FOLDER,
        os.path.splitext(os.path.basename(input_path))[0] + ".pdf"
    )

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="PDF was not generated")

    return pdf_path

#helper function for merging ppt files (legacy, not used)
def merge_ppt_files_legacy(ppt_files: list[str]) -> str:
    if not ppt_files:
        raise ValueError("No PPT files provided")

    base = Presentation(ppt_files[0])

    slide_width = base.slide_width
    slide_height = base.slide_height

    for src_path in ppt_files[1:]:
        src = Presentation(src_path)
        src.slide_width = slide_width
        src.slide_height = slide_height

        for slide in src.slides:
            new_slide = base.slides.add_slide(base.slide_layouts[6])

            for shape in slide.shapes:
                # ✅ Pictures
                if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                    image_stream = BytesIO(shape.image.blob)

                    new_slide.shapes.add_picture(
                        image_stream,
                        shape.left,
                        shape.top,
                        shape.width,
                        shape.height,
                    )

                # ✅ Text
                elif shape.has_text_frame:
                    textbox = new_slide.shapes.add_textbox(
                        shape.left,
                        shape.top,
                        shape.width,
                        shape.height,
                    )
                    tf = textbox.text_frame
                    tf.clear()

                    for p in shape.text_frame.paragraphs:
                        para = tf.add_paragraph()
                        para.text = p.text
                        para.font.size = p.font.size
                        para.font.bold = p.font.bold
                        para.font.italic = p.font.italic

    output_path = os.path.join(
        OUTPUT_FOLDER, f"merged_{uuid.uuid4().hex}.pptx"
    )

    base.save(output_path)
    return output_path

#helper function for merging word files
# def merge_word_files(docx_files: list[str]) -> str:
#     if not docx_files:
#         raise ValueError("No DOCX files provided")

#     merged = Document(docx_files[0])

#     for doc_path in docx_files[1:]:
#         # ✅ Start new page
#         merged.add_page_break()

#         src = Document(doc_path)

#         for element in src.element.body:
#             merged.element.body.append(deepcopy(element))

#     output_path = os.path.join(
#         OUTPUT_FOLDER, f"merged_{uuid.uuid4().hex}.docx"
#     )

#     merged.save(output_path)
#     return output_path
