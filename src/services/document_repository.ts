import {parseDocumentFile, type ParsedDocument} from './document_service.js';
import {EXAMPLE_PAPERS, loadExamplePaper} from './example_papers.js';
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('doc-qa-documents', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {database = undefined; throw error;});
  return database;
}
export async function saveDocument(document: ParsedDocument): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite');
    transaction.objectStore('documents').put(document);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
export async function readDocument(id: string): Promise<ParsedDocument | null> {
  const db = await openDatabase();
  const document = await new Promise<ParsedDocument | null>((resolve, reject) => {
    const request = db.transaction('documents', 'readonly').objectStore('documents').get(id);
    request.onsuccess = () => {
      const document = request.result;
      resolve(document?.id === id && Array.isArray(document.blocks) && Array.isArray(document.units) ? document : null);
    };
    request.onerror = () => reject(request.error);
  });
  // Older saved examples contain extracted text only. Recover the exact shipped file,
  // verifying its content identity before replacing the cached representation.
  if (document && !document.originalFile && document.extension === 'pdf') {
    const example = EXAMPLE_PAPERS.find(paper => `${paper.id}.pdf` === document.name);
    if (example) {
      try {
        const restored = await parseDocumentFile(await loadExamplePaper(example.id));
        if (restored.id === id) {await saveDocument(restored); return restored;}
      } catch { /* The cached text remains usable when the example cannot be loaded. */ }
    }
  }
  return document;
}
