#!/usr/bin/env node

/**
 * PDF Pro Studio Windows Standalone Executable Builder with Embedded Engine
 *
 * This script packages the entire frontend application (dist/) AND the backend
 * conversion engine (docx, pptx, xlsx, pdf-lib, jszip, etc.) into a single,
 * self-contained Windows executable (.exe).
 *
 * Features:
 * 1. Bundles all static assets into base64 virtual filesystem map.
 * 2. Compiles a high-performance embedded Node.js conversion engine running on http://127.0.0.1:8000.
 * 3. Handles all conversion endpoints: /health, /merge, /remove-pages, /extract-pages, /rotate,
 *    /pdf-to-word, /pdf-to-excel, /pdf-to-pptx, /pdf-to-pdfa, /image-to-pdf, /zip.
 * 4. Merges into Node Single Executable Application (SEA) blob.
 * 5. Injects SEA blob into official Windows x64 Node.js runtime using postject.
 * 6. Converts the PE executable to Windows GUI subsystem (no console window popup).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

console.log('=== Step 1: Validating frontend build (dist/) ===');
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('dist/ not found or incomplete. Building Vite production bundle...');
  execSync('npm run build', { stdio: 'inherit' });
}

// Read all files recursively in dist/
function getFilesRecursively(dir, rootDir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, rootDir));
    } else {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      results.push({ relPath, fullPath });
    }
  });
  return results;
}

const distFiles = getFilesRecursively(distDir, distDir);
console.log(`Found ${distFiles.length} distribution files in dist/. Creating in-memory asset map...`);

const assetsMap = {};
distFiles.forEach(({ relPath, fullPath }) => {
  const fileBuf = fs.readFileSync(fullPath);
  assetsMap[relPath] = fileBuf.toString('base64');
});

console.log('=== Step 2: Compiling embedded conversion backend engine ===');
// We bundle the backend engine (docx, pptxgenjs, xlsx, jszip, pdf-lib) using esbuild
const engineSource = `
const http = require('http');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { exec } = require('child_process');
const docx = require('docx');
const pptxgen = require('pptxgenjs');
const xlsx = require('xlsx');
const jszip = require('jszip');
const { PDFDocument, PDFArray, degrees } = require('pdf-lib');

function parseMultipart(bodyBuffer, boundary) {
  const boundaryBuffer = Buffer.from('--' + boundary);
  const parts = [];
  let start = bodyBuffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    let nextStart = bodyBuffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (nextStart === -1) break;

    const partBuffer = bodyBuffer.subarray(start + boundaryBuffer.length, nextStart);
    const headerEnd = partBuffer.indexOf(Buffer.from('\\r\\n\\r\\n'));
    if (headerEnd !== -1) {
      const headerStr = partBuffer.subarray(0, headerEnd).toString('utf-8');
      let data = partBuffer.subarray(headerEnd + 4);
      if (data.subarray(data.length - 2).toString() === '\\r\\n') {
        data = data.subarray(0, data.length - 2);
      }

      const disposition = headerStr.match(/Content-Disposition:\\s*form-data;\\s*name="([^"]+)"(?:;\\s*filename="([^"]+)")?/i);
      if (disposition) {
        parts.push({
          name: disposition[1],
          filename: disposition[2] || null,
          data: data
        });
      }
    }
    start = nextStart;
  }
  return parts;
}

function parsePageRange(pageStr, totalPages) {
  if (!pageStr || pageStr.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const set = new Set();
  const parts = pageStr.split(',');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) set.add(i - 1);
        }
      }
    } else {
      const num = parseInt(p, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        set.add(num - 1);
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

async function extractPdfText(pdfBytes) {
  try {
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdf.getPages();
    const results = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const lines = [];
      const contents = page.node.Contents();
      if (!contents) {
        results.push({ pageNumber: i + 1, lines: [] });
        continue;
      }

      const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
      for (const ref of refs) {
        const stream = pdf.context.lookup(ref);
        if (!stream || !stream.contents) continue;

        let decoded = '';
        try {
          decoded = zlib.inflateSync(Buffer.from(stream.contents)).toString('utf-8');
        } catch (e) {
          try {
            decoded = Buffer.from(stream.contents).toString('utf-8');
          } catch (e2) {}
        }

        if (!decoded) continue;

        const hexMatches = decoded.match(/<([0-9a-fA-F]+)>\\s*(?:Tj|'|")/g) || [];
        for (const m of hexMatches) {
          const h = m.replace(/<\\s*/, '').replace(/>\\s*(?:Tj|'|")$/, '').trim();
          if (h) {
            try {
              const s = Buffer.from(h, 'hex').toString('utf-8');
              if (s.trim()) lines.push(s.trim());
            } catch(e) {}
          }
        }

        const literalMatches = decoded.match(/\\((?:\\\\\\(|\\\\\\)|[^)])*\\)\\s*(?:Tj|'|")/g) || [];
        for (const m of literalMatches) {
          const l = m.replace(/\\)\\s*(?:Tj|'|")$/, '').replace(/^\\(/, '').replace(/\\\\([()\\\\])/g, '$1');
          if (l.trim()) lines.push(l.trim());
        }

        const tjArr = decoded.match(/\\[(.*?)\\]\\s*TJ/gs) || [];
        for (const arr of tjArr) {
          const inner = arr.replace(/^\\[/, '').replace(/\\]\\s*TJ$/, '');
          let combined = '';
          const parts = inner.match(/(<[0-9a-fA-F]+>|\\((?:\\\\\\(|\\\\\\)|[^)])*\\))/g) || [];
          for (const p of parts) {
            if (p.startsWith('<')) {
              const h = p.slice(1, -1).trim();
              combined += Buffer.from(h, 'hex').toString('utf-8');
            } else if (p.startsWith('(')) {
              combined += p.slice(1, -1).replace(/\\\\([()\\\\])/g, '$1');
            }
          }
          if (combined.trim()) lines.push(combined.trim());
        }
      }

      results.push({
        pageNumber: i + 1,
        lines: lines.length ? lines : [\`Document Page \${i + 1}\`]
      });
    }

    return results;
  } catch(e) {
    return [];
  }
}

async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1:8000');
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', engine: 'PDF Pro Studio Embedded Engine' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      const boundary = boundaryMatch ? boundaryMatch[1].trim().replace(/^"|"$/g, '') : null;
      const parts = boundary ? parseMultipart(body, boundary) : [];

      if (pathname === '/merge') {
        const fileParts = parts.filter(p => p.name === 'files' || (p.filename && p.data && p.data.length > 0));
        const mergedDoc = await PDFDocument.create();
        for (const p of fileParts) {
          const doc = await PDFDocument.load(p.data, { ignoreEncryption: true });
          const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
          pages.forEach(pg => mergedDoc.addPage(pg));
        }
        const outBytes = await mergedDoc.save();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="merged.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      if (pathname === '/remove-pages') {
        const filePart = parts.find(p => p.name === 'file');
        const pagesPart = parts.find(p => p.name === 'pages');
        const pdf = await PDFDocument.load(filePart.data, { ignoreEncryption: true });
        const total = pdf.getPageCount();
        const toRemove = new Set(parsePageRange(pagesPart ? pagesPart.data.toString('utf-8') : '', total));
        
        const newPdf = await PDFDocument.create();
        const keepIndices = [];
        for (let i = 0; i < total; i++) {
          if (!toRemove.has(i)) keepIndices.push(i);
        }
        const copied = await newPdf.copyPages(pdf, keepIndices);
        copied.forEach(pg => newPdf.addPage(pg));
        const outBytes = await newPdf.save();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="removed_pages.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      if (pathname === '/extract-pages') {
        const filePart = parts.find(p => p.name === 'file');
        const pagesPart = parts.find(p => p.name === 'pages');
        const pdf = await PDFDocument.load(filePart.data, { ignoreEncryption: true });
        const total = pdf.getPageCount();
        const indices = parsePageRange(pagesPart ? pagesPart.data.toString('utf-8') : '', total);

        const newPdf = await PDFDocument.create();
        const copied = await newPdf.copyPages(pdf, indices);
        copied.forEach(pg => newPdf.addPage(pg));
        const outBytes = await newPdf.save();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="extracted_pages.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      if (pathname === '/rotate') {
        const filePart = parts.find(p => p.name === 'file');
        const anglePart = parts.find(p => p.name === 'angle');
        const pagesPart = parts.find(p => p.name === 'pages');
        const angle = anglePart ? parseInt(anglePart.data.toString('utf-8'), 10) || 90 : 90;
        
        const pdf = await PDFDocument.load(filePart.data, { ignoreEncryption: true });
        const total = pdf.getPageCount();
        const indices = pagesPart && pagesPart.data.toString('utf-8').trim()
          ? parsePageRange(pagesPart.data.toString('utf-8'), total)
          : Array.from({ length: total }, (_, i) => i);

        indices.forEach(idx => {
          const pg = pdf.getPage(idx);
          const currentAngle = pg.getRotation().angle;
          pg.setRotation(degrees((currentAngle + angle) % 360));
        });

        const outBytes = await pdf.save();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="rotated.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      if (pathname === '/pdf-to-word') {
        const filePart = parts.find(p => p.name === 'file');
        const extracted = await extractPdfText(filePart.data);
        const children = [];

        children.push(new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: 'Converted by PDF Pro Studio',
              bold: true,
              size: 28,
              color: '1E293B'
            })
          ],
          spacing: { after: 300 }
        }));

        for (const page of extracted) {
          children.push(new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: \`--- Page \${page.pageNumber} ---\`,
                bold: true,
                size: 20,
                color: '64748B'
              })
            ],
            spacing: { before: 200, after: 150 }
          }));

          for (const line of page.lines) {
            children.push(new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: line,
                  size: 22
                })
              ],
              spacing: { after: 120 }
            }));
          }
        }

        const doc = new docx.Document({
          sections: [{
            properties: {},
            children: children
          }]
        });

        const docxBuf = await docx.Packer.toBuffer(doc);
        const filename = (filePart.filename || 'converted.pdf').replace(/\\.pdf$/i, '') + '.docx';
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': \`attachment; filename="\${filename}"\`
        });
        res.end(docxBuf);
        return;
      }

      if (pathname === '/pdf-to-excel') {
        const filePart = parts.find(p => p.name === 'file');
        const extracted = await extractPdfText(filePart.data);
        const wb = xlsx.utils.book_new();
        const rows = [['Page', 'Line Number', 'Extracted Content']];

        for (const page of extracted) {
          page.lines.forEach((line, lIdx) => {
            rows.push([page.pageNumber, lIdx + 1, line]);
          });
        }

        const ws = xlsx.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 60 }];
        xlsx.utils.book_append_sheet(wb, ws, 'Extracted Data');

        const xlsxBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const filename = (filePart.filename || 'converted.pdf').replace(/\\.pdf$/i, '') + '.xlsx';
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': \`attachment; filename="\${filename}"\`
        });
        res.end(xlsxBuf);
        return;
      }

      if (pathname === '/pdf-to-pptx') {
        const filePart = parts.find(p => p.name === 'file');
        const extracted = await extractPdfText(filePart.data);
        const pptx = new pptxgen();
        pptx.layout = 'LAYOUT_WIDE';

        for (const page of extracted) {
          const slide = pptx.addSlide();
          slide.addText(\`Page \${page.pageNumber}\`, {
            x: 0.8,
            y: 0.6,
            fontSize: 22,
            bold: true,
            color: '1E293B'
          });

          const contentText = page.lines.join('\\n\\n') || \`Content for page \${page.pageNumber}\`;
          slide.addText(contentText, {
            x: 0.8,
            y: 1.5,
            w: 11.5,
            h: 5.5,
            fontSize: 14,
            color: '334155',
            breakLine: true
          });
        }

        const pptxBuf = await pptx.write({ outputType: 'nodebuffer' });
        const filename = (filePart.filename || 'converted.pdf').replace(/\\.pdf$/i, '') + '.pptx';
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': \`attachment; filename="\${filename}"\`
        });
        res.end(pptxBuf);
        return;
      }

      if (pathname === '/zip') {
        const fileParts = parts.filter(p => p.filename && p.data);
        const zip = new jszip();
        for (const p of fileParts) {
          zip.file(p.filename, p.data);
        }
        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="files.zip"'
        });
        res.end(zipBuf);
        return;
      }

      if (pathname === '/pdf-to-pdfa') {
        const filePart = parts.find(p => p.name === 'file');
        const pdf = await PDFDocument.load(filePart.data, { ignoreEncryption: true });
        pdf.setTitle((filePart.filename || 'Document').replace(/\\.pdf$/i, ''));
        pdf.setProducer('PDF Pro Studio PDF/A Engine');
        pdf.setCreator('PDF Pro Studio');
        const outBytes = await pdf.save({ useObjectStreams: false });
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="converted_pdfa.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      if (pathname === '/image-to-pdf') {
        const fileParts = parts.filter(p => p.filename && p.data);
        const pdf = await PDFDocument.create();
        for (const p of fileParts) {
          let img;
          if (p.filename && p.filename.match(/\\.png$/i)) {
            img = await pdf.embedPng(p.data);
          } else {
            img = await pdf.embedJpg(p.data);
          }
          const page = pdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        const outBytes = await pdf.save();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="images_to_pdf.pdf"'
        });
        res.end(Buffer.from(outBytes));
        return;
      }

      // Default fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found', endpoint: pathname }));
    } catch (err) {
      console.error('API Error on', pathname, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

// Start embedded API engine on 127.0.0.1:8000
const apiServer = http.createServer(handleApiRequest);
apiServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 8000 is occupied by external Python backend. Embedded engine yielding to external service.');
  } else {
    console.error('Embedded Engine Error:', err);
  }
});
apiServer.listen(8000, '127.0.0.1', () => {
  console.log('PDF Pro Studio embedded engine active at http://127.0.0.1:8000');
});

// Start static frontend file server on random available loopback port
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }
  let lookupKey = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath;
  lookupKey = decodeURIComponent(lookupKey);

  let fileContentBase64 = assets[lookupKey];
  if (!fileContentBase64 && assets[lookupKey + '.html']) {
    lookupKey = lookupKey + '.html';
    fileContentBase64 = assets[lookupKey];
  }
  if (!fileContentBase64 && !path.extname(lookupKey)) {
    lookupKey = 'index.html';
    fileContentBase64 = assets[lookupKey];
  }

  if (fileContentBase64) {
    const ext = path.extname(lookupKey).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const body = Buffer.from(fileContentBase64, 'base64');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + lookupKey);
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const appUrl = 'http://127.0.0.1:' + port;
  console.log('PDF Pro Studio desktop UI server listening at:', appUrl);

  if (process.platform === 'win32') {
    const edgeAppCmd = 'start msedge --app="' + appUrl + '" --window-size=1280,840';
    exec(edgeAppCmd, (err) => {
      if (err) {
        exec('start "" "' + appUrl + '"');
      }
    });
  } else {
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(openCmd + ' "' + appUrl + '"');
  }
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
`;

// Compile engine + dependencies into single JS bundle using esbuild
const bundledEngine = esbuild.buildSync({
  stdin: {
    contents: engineSource,
    resolveDir: path.join(__dirname, '..'),
    loader: 'js',
  },
  bundle: true,
  platform: 'node',
  target: 'node22',
  minify: true,
  write: false,
  external: [],
}).outputFiles[0].text;

console.log(`Bundled engine code: ${(bundledEngine.length / 1024 / 1024).toFixed(2)} MB`);

// Generate complete SEA runtime script injecting assets and bundled engine
const runtimeScript = `
const assets = ${JSON.stringify(assetsMap)};
${bundledEngine}
`;

const buildDir = path.join(__dirname, '..', 'build-win');
fs.mkdirSync(buildDir, { recursive: true });

const seaEntryPath = path.join(buildDir, 'sea-entry.js');
const seaConfigPath = path.join(buildDir, 'sea-config.json');
const seaBlobPath = path.join(buildDir, 'sea-prep.blob');

fs.writeFileSync(seaEntryPath, runtimeScript, 'utf-8');
fs.writeFileSync(
  seaConfigPath,
  JSON.stringify({
    main: seaEntryPath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true
  }, null, 2),
  'utf-8'
);

console.log('=== Step 3: Compiling SEA blob ===');
execSync(`node --experimental-sea-config "${seaConfigPath}"`, { stdio: 'inherit' });

console.log('=== Step 4: Extracting official Windows x64 binary ===');
const baseExePath = '/tmp/nodewin/package/bin/node.exe';
if (!fs.existsSync(baseExePath)) {
  console.log('Extracting node.exe runtime...');
  if (!fs.existsSync('/tmp/gjsify-node-runtime-win32-x64-0.64.2.tgz')) {
    execSync('cd /tmp && npm pack @gjsify/node-runtime-win32-x64@0.64.2', { stdio: 'inherit' });
  }
  execSync('mkdir -p /tmp/nodewin && cd /tmp/nodewin && tar -zxvf /tmp/gjsify-node-runtime-win32-x64-0.64.2.tgz package/bin/node.exe', { stdio: 'inherit' });
}

const targetConsoleExe = path.join(buildDir, 'PDF-Pro-Studio-debug.exe');
const targetGuiExe = path.join(buildDir, 'PDF-Pro-Studio.exe');

fs.copyFileSync(baseExePath, targetConsoleExe);

console.log('=== Step 5: Injecting SEA blob via postject ===');
const postjectBin = path.join(__dirname, '..', 'node_modules', '.bin', 'postject');
execSync(`"${postjectBin}" "${targetConsoleExe}" NODE_SEA_BLOB "${seaBlobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });

console.log('=== Step 6: Converting to Windows GUI subsystem (no cmd terminal popup) ===');
const createNodewBin = path.join(__dirname, '..', 'node_modules', '.bin', 'create-nodew-exe');
execSync(`"${createNodewBin}" "${targetConsoleExe}" "${targetGuiExe}"`, { stdio: 'inherit' });

console.log('=== Success! Standalone Windows executable with embedded engine created ===');
const stats = fs.statSync(targetGuiExe);
console.log(`Executable: ${targetGuiExe}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
