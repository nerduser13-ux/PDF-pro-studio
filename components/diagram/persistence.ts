import { DiagramDocument } from './types';
import { DIAGRAM_TEMPLATES } from './templates';

const STORAGE_KEY_CURRENT = 'pdf_pro_diagram_current';
const STORAGE_KEY_DOCS = 'pdf_pro_diagram_documents';

/**
 * Loads the active diagram document, with fallback to SWOT template
 */
export function loadActiveDiagram(): DiagramDocument {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load diagram from localStorage:', err);
  }
  return DIAGRAM_TEMPLATES[0].createDocument();
}

/**
 * Saves the active diagram document
 */
export function saveActiveDiagram(doc: DiagramDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(doc));
    // Also update in the list of saved documents
    const savedList = getSavedDiagramList();
    const existingIdx = savedList.findIndex(d => d.id === doc.id);
    if (existingIdx >= 0) {
      savedList[existingIdx] = doc;
    } else {
      savedList.unshift(doc);
    }
    // Limit to 20 recent documents
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedList.slice(0, 20)));
  } catch (err) {
    console.warn('Failed to save diagram to localStorage:', err);
  }
}

/**
 * Retrieves the list of all saved diagrams
 */
export function getSavedDiagramList(): DiagramDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to get saved diagram list:', err);
  }
  return [];
}

/**
 * Deletes a diagram from the saved list
 */
export function deleteSavedDiagram(id: string): void {
  try {
    const list = getSavedDiagramList().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to delete diagram:', err);
  }
}
