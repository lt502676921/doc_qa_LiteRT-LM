import {sourceLocation, type DocumentBlock, type ParsedDocument} from './document_service.js';
export interface SourceCitation {
  id: string; documentId: string; label: string; documentName: string; excerpt: string;
}
export interface CitationResult {citations: SourceCitation[]; invalid: string[];}
export function validateCitations(text: string, document: ParsedDocument, evidence: DocumentBlock[]): CitationResult {
  const allowed = new Map(evidence.map(block => [block.id, block]));
  const citations = new Map<string, SourceCitation>(), invalid = new Set<string>();
  for (const match of text.matchAll(/\[\[([^\]\n]+)\]\]|(?<!\[)\[(S\d+)\](?![\](])/g)) {
    const id = (match[1] || match[2]).trim();
    const block = allowed.get(id);
    if (!block) {invalid.add(id); continue;}
    citations.set(id, {id, documentId: document.id, documentName: document.name,
      label: block.label, excerpt: block.text.slice(0, 220)});
  }
  return {citations: [...citations.values()], invalid: [...invalid]};
}
export function citationMarkdown(text: string, citations: SourceCitation[] = []): string {
  const references = new Map(citations.map((citation, index) => [citation.id, {citation, number: index + 1}]));
  return text.replace(/\[\[([^\]\n]+)\]\]|(?<!\[)\[(S\d+)\](?![\](])/g, (marker, double, single) => {
    const id = String(double || single).trim();
    const reference = references.get(id);
    if (!reference) return '\\[Source unavailable\\]';
    const title = `View source · ${sourceLocation(reference.citation.label)}`.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return `[\\[${reference.number}\\]](#source-${id} "${title}")`;
  }).replace(/\[\[S\d*$|(?<!\[)\[S\d*$/, '');
}

/** Copy readable references together with the locations they refer to. */
export function citationPlainText(text: string, citations: SourceCitation[] = []): string {
  const references = new Map(citations.map((citation, index) => [citation.id, index + 1]));
  const answer = text.replace(/\[\[([^\]\n]+)\]\]|(?<!\[)\[(S\d+)\](?![\](])/g, (_, double, single) => {
    const number = references.get(String(double || single).trim());
    return number ? `[${number}]` : '[Source unavailable]';
  }).replace(/\[\[S\d*$|(?<!\[)\[S\d*$/, '');
  return citations.length ? `${answer}\n\nSources:\n${citations.map((citation, index) =>
    `[${index + 1}] ${citation.documentName} · ${sourceLocation(citation.label)}`).join('\n')}` : answer;
}
