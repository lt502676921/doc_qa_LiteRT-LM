import type {OfficeContentNode, OfficeParserAST} from 'officeparser';
import {marked} from 'marked';
import {sourceRegions, sourceText, type SourceRegion} from './source_geometry.js';

export interface DocumentBlock {
  id: string; unitId: string; label: string; text: string; markdown: string; page?: number;
  regions?: SourceRegion[];
}
export interface DocumentUnit {id: string; label: string;}
export interface ParsedDocument {
  id: string; name: string; size: number; extension: string; html: string; markdown: string;
  wordCount: number; charCount: number; title?: string; blocks: DocumentBlock[];
  units: DocumentUnit[]; unreadableUnits: string[]; warnings: string[];
  originalFile?: Blob;
}
export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md', 'markdown', 'json', 'csv'];
export const ACCEPTED_FILE_TYPES = '.pdf,.xlsx,.docx,.pptx,.txt,.md,.markdown,.json,.csv';

/** Keep extraction counters out of locations shown to readers. */
export function sourceLocation(label: string): string {
  return label.replace(/ · (?:paragraph|table block|text) \d+$/, '');
}

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function splitText(text: string, maximum = 1400): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maximum) {
    let end = remaining.lastIndexOf('\n', maximum);
    if (end < maximum / 2) end = remaining.lastIndexOf(' ', maximum);
    if (end < maximum / 2) end = maximum;
    if (/^[\uDC00-\uDFFF]$/.test(remaining[end])) end--;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
function plainText(node: OfficeContentNode): string {
  return sourceText(node).text;
}
/** Shared by the browser and fixture tests. Never infer pagination from rendered HTML. */
export function extractDocumentStructure(ast: OfficeParserAST): {
  blocks: DocumentBlock[]; units: DocumentUnit[]; unreadableUnits: string[];
} {
  const blocks: DocumentBlock[] = [], units: DocumentUnit[] = [];
  const unreadableUnits: string[] = [];
  let unit: DocumentUnit = {id: 'document', label: 'Document'};
  let page: number | undefined;
  let pageWidth = 0, pageHeight = 0;
  let paragraph = 0;
  const addUnit = (next: DocumentUnit) => {
    unit = next;
    if (!units.some(item => item.id === next.id)) units.push(next);
    paragraph = 0;
  };
  const visit = (node: OfficeContentNode) => {
    const metadata = (node.metadata || {}) as Record<string, unknown>;
    if (['page', 'slide', 'sheet'].includes(node.type)) {
      const index = metadata.pageNumber || metadata.slideNumber || metadata.sheetName || units.length + 1;
      const prefix = node.type === 'page' ? 'Page' : node.type === 'slide' ? 'Slide' : 'Sheet';
      addUnit({id: `${node.type}-${index}`, label: `${prefix} ${index}`});
      page = node.type === 'page' ? Number(index) : undefined;
      pageWidth = Number(metadata.pageWidth) || 0;
      pageHeight = Number(metadata.pageHeight) || 0;
      const before = blocks.length;
      (node.children || []).forEach(visit);
      if (blocks.length === before) unreadableUnits.push(unit.label);
      return;
    }
    if (node.type === 'heading' && !['pdf', 'pptx', 'xlsx'].includes(ast.type))
      addUnit({id: `section-${units.length + 1}`, label: plainText(node).slice(0, 100) || 'Section'});
    if (['image', 'chart', 'drawing', 'embed', 'break'].includes(node.type)) return;
    if (!['paragraph', 'heading', 'table', 'list', 'code', 'note', 'row'].includes(node.type) && node.children?.length) {
      node.children.forEach(visit); return;
    }
    const source = sourceText(node);
    const text = source.text.trim();
    if (!text) return;
    if (!units.some(item => item.id === unit.id)) addUnit(unit);
    paragraph++;
    let offset = 0;
    for (const part of splitText(text)) {
      const start = source.text.indexOf(part, offset);
      const regions = page && start >= 0 ? sourceRegions(source, start, start + part.length, pageWidth, pageHeight) : [];
      offset = start + part.length;
      const heading = node.type === 'heading' ? `${'#'.repeat(Math.min(6, Number(metadata.level) || 2))} ` : '';
      blocks.push({id: `S${blocks.length + 1}`, unitId: unit.id,
        label: `${unit.label} · ${node.type === 'table' ? 'table block' : 'paragraph'} ${paragraph}`,
        text: part, markdown: heading + part, page, ...(regions.length ? {regions} : {})});
    }
  };
  ast.content.forEach(visit);
  return {blocks, units, unreadableUnits};
}
function textStructure(text: string, extension: string) {
  const blocks: DocumentBlock[] = [], units: DocumentUnit[] = [];
  let unit: DocumentUnit = {id: 'document', label: 'Document'};
  for (const paragraph of text.split(/\n\s*\n/)) {
    if (!paragraph.trim()) continue;
    const heading = ['md', 'markdown'].includes(extension) && paragraph.match(/^#{1,6}\s+(.+)/);
    if (heading) unit = {id: `section-${units.length + 1}`, label: heading[1].slice(0, 100)};
    if (!units.some(item => item.id === unit.id)) units.push(unit);
    for (const part of splitText(paragraph)) blocks.push({id: `S${blocks.length + 1}`,
      unitId: unit.id, label: `${unit.label} · text ${blocks.length + 1}`, text: part, markdown: part});
  }
  return {blocks, units, unreadableUnits: [] as string[]};
}
export async function parseDocumentFile(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_EXTENSIONS.includes(extension)) throw new Error('Unsupported file type. Choose a PDF, Office or text document.');
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let structure: ReturnType<typeof textStructure>;
  let title = file.name;
  let warnings: string[] = [];
  if (['txt', 'md', 'markdown', 'json', 'csv'].includes(extension)) {
    structure = textStructure(new TextDecoder().decode(buffer), extension);
  } else {
    const {OfficeParser} = await import('officeparser');
    const ast = await OfficeParser.parseOffice(buffer, {ocr: false, extractAttachments: false,
      pdfWorkerSrc: `${import.meta.env?.BASE_URL || './'}workers/pdf.worker.min.mjs`});
    structure = extractDocumentStructure(ast);
    title = ast.metadata.title || file.name;
    warnings = ast.warnings.map(warning => String(warning.code));
  }
  if (!structure.blocks.length) throw new Error('No readable text was found. Scanned pages and images are not supported in text-only mode.');
  const markdown = structure.blocks.map(block => block.markdown).join('\n\n');
  const html = structure.blocks.map(block => {
    const body = ['md', 'markdown'].includes(extension)
      ? marked.parse(block.markdown, {async: false}) as string
      : `<p style="white-space:pre-wrap">${escapeHtml(block.text)}</p>`;
    return `<section id="source-${block.id}" class="source-block"><small>${escapeHtml(sourceLocation(block.label))}</small>${body}</section>`;
  }).join('');
  const words = markdown.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) || [];
  return {id, name: file.name, size: file.size, extension, html, markdown,
    wordCount: words.length, charCount: markdown.length, title, ...structure, warnings, originalFile: file};
}
