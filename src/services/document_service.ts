/**
 * Copyright 2026 The ODML Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { marked } from 'marked';

export interface ParsedDocument {
  name: string;
  size: number;
  extension: string;
  html: string;
  markdown: string;
  wordCount: number;
  charCount: number;
  title?: string;
}

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
];

export const ACCEPTED_FILE_TYPES =
  '.pdf,.xlsx,.docx,.pptx,.txt,.md,.markdown,.json,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown';

let officeParserModulePromise: Promise<unknown> | null = null;

function loadOfficeParser(): Promise<unknown> {
  if (!officeParserModulePromise) {
    officeParserModulePromise = import('officeparser');
  }
  return officeParserModulePromise;
}

function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function countWords(text: string): number {
  const matches = text.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

/**
 * Service to parse files (PDF, Word, Excel, PowerPoint, Text, Markdown)
 * into HTML preview and clean Markdown text for LLM indexing.
 */
export async function parseDocumentFile(file: File): Promise<ParsedDocument> {
  const ext = getFileExtension(file);

  // Handle plain text and Markdown files directly
  if (['txt', 'md', 'markdown', 'json', 'csv'].includes(ext)) {
    const text = await file.text();
    let htmlContent = '';

    if (ext === 'md' || ext === 'markdown') {
      htmlContent = await marked.parse(text, { breaks: true });
    } else if (ext === 'json') {
      try {
        const formatted = JSON.stringify(JSON.parse(text), null, 2);
        htmlContent = `<pre><code>${escapeHtml(formatted)}</code></pre>`;
      } catch {
        htmlContent = `<pre><code>${escapeHtml(text)}</code></pre>`;
      }
    } else {
      htmlContent = `<pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.6;">${escapeHtml(text)}</pre>`;
    }

    return {
      name: file.name,
      size: file.size,
      extension: ext,
      html: htmlContent,
      markdown: text,
      wordCount: countWords(text),
      charCount: text.length,
      title: file.name,
    };
  }

  // Handle Office and PDF documents using officeparser
  try {
    const officeParserMod = (await loadOfficeParser()) as {
      OfficeParser: {
        parseOffice: (
          data: ArrayBuffer,
          config?: Record<string, unknown>
        ) => Promise<{
          metadata?: { title?: string };
          to: (
            format: 'html' | 'markdown',
            options?: Record<string, unknown>
          ) => Promise<{ value: string }>;
        }>;
      };
    };

    const arrayBuffer = await file.arrayBuffer();
    const ast = await officeParserMod.OfficeParser.parseOffice(arrayBuffer, {});

    const [htmlResult, markdownResult] = await Promise.all([
      ast.to('html', {
        htmlConfig: {
          standalone: { document: false, styles: 'scoped' },
        },
      }),
      ast.to('markdown'),
    ]);

    const markdown = markdownResult?.value || '';
    const html = htmlResult?.value || '<p>No previewable content found.</p>';
    const title = ast?.metadata?.title || file.name;

    return {
      name: file.name,
      size: file.size,
      extension: ext,
      html,
      markdown,
      wordCount: countWords(markdown),
      charCount: markdown.length,
      title,
    };
  } catch (err: unknown) {
    console.error('[DocumentService] Failed to parse office document:', err);
    throw new Error(
      `Unable to parse ${file.name}. Please ensure officeparser is installed and the file is valid. (${(err as Error).message || err})`
    );
  }
}
