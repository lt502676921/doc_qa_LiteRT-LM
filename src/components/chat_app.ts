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

import './sidebar_drawer';
import './chat_window';
import './document_preview';

import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { marked } from 'marked';

import {
  ACCEPTED_FILE_TYPES,
  parseDocumentFile,
  sourceLocation,
} from '../services/document_service.js';
import { LlmChatStateController } from '../state_controller.js';
import {EXAMPLE_PAPERS, loadExamplePaper} from '../services/example_papers.js';
import type {SourceCitation} from '../services/citation_service.js';
import type {DocumentPreview} from './document_preview.js';
import { sharedStyles } from '../styles/shared_styles.js';
import { workspaceStyles } from '../styles/workspace_styles.js';
import {icon} from './icons.js';
import { registerAppServiceWorker, renderHtml, setIframeHtml } from './util.js';

/* tslint:disable:no-new-decorators */

/**
 * Main application container for the Document Q&A & Intelligence interface,
 * with local inference on WebGPU.
 */
@customElement('document-qa-app')
export class DocumentQaApp extends LitElement {
  // Central source of truth state controller
  private state = new LlmChatStateController(this);

  // Drawer & Overlay UI State
  @property({ type: Boolean }) isSidebarOpen = false;
  @property({ type: Boolean }) isPreviewOpen = false;

  @state() private isParsingDoc = false;
  @state() private loadingExample = '';
  @state() private docError: string | null = null;
  @state() private isDraggingOver = false;

  @state() private assistantTab: 'chat' | 'summary' = 'chat';
  @state() private mobilePane: 'document' | 'assistant' = 'document';
  @state() private readingWidth = 60;
  @state() private isGeneralChat = false;
  @state() private isDocumentFullscreen = false;
  private resizing = false;
  private workspaceObserver?: ResizeObserver;
  private previousDocumentId: string | null = null;

  static override styles = [sharedStyles, workspaceStyles];

  override willUpdate() {
    const id = this.state.chatSession.currentDoc?.id || null;
    if (id !== this.previousDocumentId) {
      this.assistantTab = 'chat';
      this.mobilePane = 'document';
      this.isGeneralChat = false;
      this.isDocumentFullscreen = false;
      this.previousDocumentId = id;
    }
  }

  private workspaceDimensions() {
    const workspace = this.renderRoot.querySelector<HTMLElement>('.workspace');
    if (!workspace) return null;
    const rect = workspace.getBoundingClientRect();
    const style = getComputedStyle(workspace);
    const leftPadding = parseFloat(style.paddingLeft);
    const width = workspace.clientWidth - leftPadding - parseFloat(style.paddingRight);
    return {left: rect.left + leftPadding, width};
  }

  private clampReadingWidth(value: number) {
    const dimensions = this.workspaceDimensions();
    if (!dimensions || dimensions.width <= 0) return value;
    const min = Math.max(30, 360 / dimensions.width * 100);
    const max = Math.min(72, 100 - 354 / dimensions.width * 100);
    return Math.min(max, Math.max(min, value));
  }

  private resizeWorkspace(event: PointerEvent) {
    if (!this.resizing) return;
    const dimensions = this.workspaceDimensions();
    if (dimensions) this.readingWidth = this.clampReadingWidth((event.clientX - dimensions.left) / dimensions.width * 100);
  }

  private resizeWithKeyboard(event: KeyboardEvent) {
    const steps: Record<string, number> = {ArrowLeft: -2, ArrowRight: 2};
    if (event.key in steps) {
      event.preventDefault();
      this.readingWidth = this.clampReadingWidth(this.readingWidth + steps[event.key]);
    } else if (event.key === 'Home') {
      event.preventDefault(); this.readingWidth = this.clampReadingWidth(60);
    }
  }

  private async openRecent(id: string) {
    this.isGeneralChat = false;
    await this.state.chatSession.selectConversation(id);
  }

  private renderWelcome(busy: boolean) {
    const recent = this.state.chatSession.conversationsList
      .filter((item, index, items) => item.documentId && items.findIndex(other => other.documentId === item.documentId) === index)
      .slice(0, 4);
    return html`<main class="welcome" @dragover=${this.handleDragOver}
      @dragleave=${this.handleDragLeave} @drop=${this.handleDrop}>
      <div class="welcome-content">
        <div class="welcome-heading">
          <span class="eyebrow"><span class="privacy-dot"></span>Your private reading workspace</span>
          <h2>A little more clarity. <br>From every document.</h2>
          <p>Read the original, ask a question, and follow the answer back to its source.</p>
        </div>
        <div class="welcome-grid">
          <section class="upload-card ${this.isDraggingOver ? 'dragging' : ''}" aria-label="Upload a document">
            <div class="upload-icon">${this.documentIcon()}</div>
            <h3>${this.isParsingDoc ? 'Opening your document…' : 'Bring a document. Start exploring.'}</h3>
            <p>${this.isParsingDoc ? 'Preparing the preview and readable text.' : 'Drop a file here, or choose one from your device.'}</p>
            ${this.isParsingDoc ? html`<span class="loading-bar" role="status" aria-label="Preparing document"></span>` : html`
              <label class="file-btn">Choose a document ${icon('arrow-up-right')}
                <input aria-label="Choose a document" type="file" ?disabled=${busy}
                  accept=${ACCEPTED_FILE_TYPES} @change=${this.handleFileChosen}>
              </label>`}
            <small>PDF · DOCX · XLSX · PPTX · Markdown</small>
            ${this.docError ? html`<p class="error-note" role="alert">${this.docError}</p>` : ''}
          </section>
          <section class="workflow-card" aria-label="How it works">
            <span class="eyebrow">From reading to understanding</span>
            <ol class="workflow-steps">
              <li><span class="step-number">01</span><div><h3>Keep the original in view</h3><p>Read your document alongside the conversation.</p></div></li>
              <li><span class="step-number">02</span><div><h3>Ask what matters to you</h3><p>Explore ideas, compare details, or get a summary.</p></div></li>
              <li><span class="step-number">03</span><div><h3>Check the source</h3><p>Follow cited passages directly into the document.</p></div></li>
            </ol>
          </section>
        </div>
        <section class="recent-section" aria-label="Recent documents">
          <div class="section-heading"><h3>Pick up where you left off</h3>
            <button class="text-button" @click=${this.toggleSidebar}>View history ${icon('arrow-up-right')}</button>
          </div>
          ${recent.length ? html`<div class="recent-grid">${recent.map(item => html`
            <button class="recent-card" ?disabled=${busy} @click=${() => this.openRecent(item.id)}>
              <span class="recent-icon">${this.documentIcon()}</span>
              <span class="recent-copy"><strong>${item.documentName || item.title}</strong><small>${new Date(item.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} · Saved on this device</small></span>
              <span class="card-arrow" aria-hidden="true">${icon('arrow-up-right')}</span>
            </button>`)}</div>` : html`<p class="recent-empty">Your documents and conversations will appear here after you open a file.</p>`}
        </section>
        ${this.renderExamples()}
        <footer class="welcome-footer"><span>Files stay in your browser. Analysis uses readable text.</span>
          <button class="text-button" @click=${() => {this.isGeneralChat = true; this.mobilePane = 'assistant';}}>Chat without a document ${icon('arrow-right')}</button>
        </footer>
      </div>
    </main>`;
  }

  private documentIcon() {
    return icon('file', 24);
  }

  override firstUpdated() {
    this.workspaceObserver = new ResizeObserver(() => this.requestUpdate());
    this.workspaceObserver.observe(this);
    if ('serviceWorker' in navigator) {
      registerAppServiceWorker(navigator.serviceWorker)
        .then((reg) =>
          console.log('[PWA] Service Worker registered:', reg.scope)
        )
        .catch((err) =>
          console.error('[PWA] Service Worker registration failed:', err)
        );
    }
  }

  override updated() {
    if (matchMedia('(min-width: 861px)').matches) {
      const width = this.clampReadingWidth(this.readingWidth);
      if (Math.abs(width - this.readingWidth) > .05) this.readingWidth = width;
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.workspaceObserver?.disconnect();
  }

  private toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  private async handleFileChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';
    await this.processSelectedFile(file);
  }

  private async processSelectedFile(file: File, reserved = false) {
    if (this.state.chatSession.isBusy || (!reserved && this.isParsingDoc)) return;
    this.isParsingDoc = true;
    this.docError = null;

    try {
      const parsedDoc = await parseDocumentFile(file);
      await this.state.chatSession.setDocument(parsedDoc);

    } catch (err: unknown) {
      console.error('[Doc Q&A] Failed to parse document:', err);
      this.docError = (err as Error).message || 'Failed to parse file';
    } finally {
      this.isParsingDoc = false;
    }
  }

  private async selectExample(id: string) {
    if (this.isParsingDoc || this.state.chatSession.isBusy) return;
    this.isParsingDoc = true; this.loadingExample = id; this.docError = null;
    try {await this.processSelectedFile(await loadExamplePaper(id), true);}
    catch (error) {this.docError = (error as Error).message;}
    finally {this.isParsingDoc = false; this.loadingExample = '';}
  }

  private async selectSource(event: CustomEvent<SourceCitation>) {
    const citation = event.detail;
    if (citation.documentId !== this.state.chatSession.currentDoc?.id) return;
    await this.updateComplete;
    if (citation.documentId !== this.state.chatSession.currentDoc?.id) return;
    this.mobilePane = 'document';
    await this.updateComplete;
    const viewer = this.renderRoot.querySelector<DocumentPreview>('document-preview');
    await viewer?.revealSource(citation.id);
  }

  private handleSummaryCitation(event: MouseEvent) {
    const link = (event.target as Element).closest('a[href^="#source-"]');
    if (!link) return;
    event.preventDefault();
    const id = link.getAttribute('href')!.slice('#source-'.length);
    const citation = this.state.chatSession.summaryCitations.find(item => item.id === id);
    if (citation) void this.selectSource(new CustomEvent('source-selected', {detail: citation}));
  }

  private renderExamples(compact = false) {
    return html`<div class="example-library ${compact ? 'compact' : ''}" aria-label="Built-in documents">
      <div class="section-heading"><h3>${compact ? 'Open an example' : 'Or explore something interesting'}</h3>${compact ? '' : html`<span class="section-caption">Five papers. Plenty of ideas.</span>`}</div>
      <div class="example-grid">${EXAMPLE_PAPERS.map(paper => html`
        <button class="example-card" ?disabled=${this.isParsingDoc || this.state.chatSession.isBusy}
          @click=${() => this.selectExample(paper.id)}>
          <span class="example-type">PDF ${icon('arrow-up-right')}</span>
          <strong>${this.loadingExample === paper.id ? 'Loading…' : paper.title}</strong>
          <span>${paper.year} · ${paper.pages} pages</span>
          ${compact ? '' : html`<small>${paper.description}</small>`}
        </button>`)}</div>
    </div>`;
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    if (e.relatedTarget instanceof Node && this.renderRoot.contains(e.relatedTarget)) return;
    this.isDraggingOver = false;
  }

  private async handleDrop(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await this.processSelectedFile(file);
    }
  }

  private async handleCloseDoc() {
    this.isGeneralChat = false;
    await this.state.chatSession.clearDocument();
  }

  private handlePreviewHtml(e: CustomEvent<{ base64Code: string }>) {
    const base64 = e.detail.base64Code;
    if (!base64) return;
    try {
      const code = decodeURIComponent(escape(atob(base64)));
      const iframe = this.renderRoot.querySelector(
        '#preview-iframe'
      ) as HTMLIFrameElement;
      if (iframe) {
        setIframeHtml(iframe, code);
        this.isPreviewOpen = true;
      }
    } catch (err) {
      console.error('[Doc Q&A] Failed to decode HTML content:', err);
    }
  }

  private closePreview() {
    this.isPreviewOpen = false;
    const iframe = this.renderRoot.querySelector(
      '#preview-iframe'
    ) as HTMLIFrameElement;
    if (iframe) {
      setIframeHtml(iframe, '');
    }
  }

  override render() {
    const chat = this.state.chatSession;
    const currentDoc = chat.currentDoc;
    const isSummarizing = chat.isSummarizing;
    const isModelLoading = this.state.modelLoader.isModelLoading;
    const busy = chat.isBusy || this.isParsingDoc || isModelLoading;
    const plan = chat.contextPreview;
    const percentage = Math.min(100, Math.round(100 * (plan.inputTokens + plan.outputReserve + plan.margin) / plan.limit));
    const isError = /failed|error/i.test(this.state.statusText);
    const statusType = isError ? 'error' : busy ? 'loading' : this.state.modelLoader.engine ? 'ready' : 'idle';
    const statusLabel = isError ? 'Needs attention' : this.isParsingDoc ? 'Opening document' : chat.isRestoring ? 'Restoring' :
      isModelLoading ? 'Loading model' : isSummarizing ? 'Summarizing' : chat.isGenerating ? 'Answering' :
      this.state.modelLoader.engine ? 'Model ready' : 'Local workspace';
    const summaryText = chat.summaryText;
    const welcome = !currentDoc && !chat.missingDocument && !chat.messages.length && !this.isGeneralChat;

    return html`
      <div class="sidebar-overlay ${this.isSidebarOpen ? 'open' : ''}" @click=${this.toggleSidebar}></div>
      <aside class="sidebar ${this.isSidebarOpen ? 'open' : ''}" ?inert=${!this.isSidebarOpen} aria-label="History and settings">
        <div class="drawer-header"><h2 class="drawer-title">History &amp; settings</h2>
          <button class="icon-button" aria-label="Close Drawer" @click=${this.toggleSidebar}>${icon('close', 20)}</button></div>
        <document-sidebar style=${busy ? 'pointer-events:none;opacity:0.6' : ''} .state=${this.state}
          @new-workspace=${() => {this.isGeneralChat = false; this.assistantTab = 'chat'; this.mobilePane = 'document';}}
          @close=${() => this.isSidebarOpen = false}></document-sidebar>
      </aside>
      <header class="topbar">
        <div class="topbar-left">
          <button id="btn-toggle-sidebar" class="icon-button" aria-label="Toggle Menu" title="History and settings"
            aria-expanded=${this.isSidebarOpen} @click=${this.toggleSidebar}>
            ${icon('sidebar', 20)}
          </button>
          <div class="brand-group"><div class="brand-lockup">
            <img class="brand-mark" src=${`${import.meta.env.BASE_URL}icons/document-qa.svg`} width="32" height="32" alt="" aria-hidden="true">
            <h1 class="brand">Doc Q&amp;A<span class="brand-dot">.</span></h1>
          </div><span class="brand-divider"></span><span class="brand-description">Read with understanding</span></div>
        </div>
        <div class="topbar-right">
          <button class="topbar-status-badge ${statusType}" title=${this.state.statusText} @click=${this.toggleSidebar}>
            <span class="topbar-status-dot ${statusType}"></span><span>${statusLabel}</span></button>
          ${!welcome ? html`<label class="file-btn file-btn-secondary">Open document
            <input aria-label="Open document" type="file" ?disabled=${busy} accept=${ACCEPTED_FILE_TYPES} @change=${this.handleFileChosen}>
          </label>` : ''}
        </div>
      </header>
      ${welcome ? this.renderWelcome(busy) : html`
        <nav class="mobile-switch" aria-label="Workspace view" ?hidden=${this.isDocumentFullscreen}>
          <button aria-pressed=${this.mobilePane === 'document'} @click=${() => this.mobilePane = 'document'}>Document</button>
          <button aria-pressed=${this.mobilePane === 'assistant'} @click=${() => this.mobilePane = 'assistant'}>Assistant</button>
        </nav>
        <main class="workspace ${this.resizing ? 'resizing' : ''} ${this.isDocumentFullscreen ? 'fullscreen' : ''}" style=${`--reading-width: ${this.readingWidth}%`}>
          <section class="pane pane-document ${this.mobilePane === 'document' ? 'mobile-active' : ''}" aria-label="Document Preview"
            @dragover=${this.handleDragOver} @dragleave=${this.handleDragLeave} @drop=${this.handleDrop}>
            <div class="pane-header"><div class="document-heading"><span class="document-symbol">${this.documentIcon()}</span>
              <div class="document-info"><h2 class="document-name" title=${currentDoc?.name || 'Document'}>${currentDoc?.name || 'Your document'}</h2>
                ${currentDoc ? html`<p class="pane-meta">${currentDoc.extension.toUpperCase()} · ${currentDoc.units.length} ${currentDoc.extension === 'pdf' ? 'pages' : 'sections'}</p>` : ''}</div></div>
              ${currentDoc ? html`<button class="icon-button" aria-label="Close document" title="Close document" ?disabled=${busy} @click=${this.handleCloseDoc}>${icon('close', 16)}</button>` : ''}
            </div>
            ${this.docError ? html`<p class="error-note" role="alert">${this.docError}</p>` : ''}
            ${this.isParsingDoc ? html`<div class="document-empty"><span class="loading-bar" role="status" aria-label="Preparing document"></span><p>Opening your document…</p></div>` : currentDoc ? html`
              <document-preview .document=${currentDoc} .scope=${chat.scope} .busy=${busy}
                @fullscreen-changed=${(event: CustomEvent<boolean>) => {this.isDocumentFullscreen = event.detail;}}
                @scope-changed=${(event: CustomEvent<string | null>) => chat.setScope(event.detail)}></document-preview>
              ${currentDoc.unreadableUnits.length ? html`<p class="document-footnote"><span class="error-note">No readable text: ${currentDoc.unreadableUnits.join(', ')}.</span></p>` : ''}
            ` : html`<div class="document-empty ${this.isDraggingOver ? 'dragging' : ''}">${this.documentIcon()}<h3>A place for your source</h3><p>Open a document to keep its original text beside the answers.</p>
              <label class="file-btn">Choose a document<input aria-label="Choose a document" type="file" ?disabled=${busy} accept=${ACCEPTED_FILE_TYPES} @change=${this.handleFileChosen}></label>
              <details class="inline-examples"><summary>Explore an example instead</summary>${this.renderExamples(true)}</details></div>`}
          </section>
          <div class="splitter" role="separator" aria-label="Resize document and assistant panes" aria-orientation="vertical" tabindex="0"
            aria-valuenow=${Math.round(this.readingWidth)} aria-valuemin="30" aria-valuemax="72"
            @pointerdown=${(event: PointerEvent) => {if (event.button !== 0) return; this.resizing = true; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); event.preventDefault();}}
            @pointermove=${this.resizeWorkspace} @pointerup=${() => {this.resizing = false;}}
            @pointercancel=${() => {this.resizing = false;}} @lostpointercapture=${() => {this.resizing = false;}}
            @keydown=${this.resizeWithKeyboard}><span></span></div>
          <aside class="pane pane-ai ${this.mobilePane === 'assistant' ? 'mobile-active' : ''}" aria-label="AI Tools">
            <div class="assistant-header">
              <h2>Find the thread.</h2>
              <div class="assistant-tabs" role="tablist" aria-label="Assistant tools">
              <button id="chat-tab" role="tab" aria-selected=${this.assistantTab === 'chat'} aria-controls="chat-panel" tabindex=${this.assistantTab === 'chat' ? 0 : -1}
                @click=${() => this.assistantTab = 'chat'} @keydown=${this.handleTabKey}>Ask a question</button>
              <button id="summary-tab" role="tab" aria-selected=${this.assistantTab === 'summary'} aria-controls="summary-panel" tabindex=${this.assistantTab === 'summary' ? 0 : -1}
                @click=${() => this.assistantTab = 'summary'} @keydown=${this.handleTabKey}>Summary${isSummarizing ? html`<span class="summary-streaming-indicator"></span>` : ''}</button>
              </div>
            </div>
            ${currentDoc || chat.missingDocument ? html`
              <details class="context-panel ${plan.error || chat.missingDocument ? 'context-warning' : ''}" ?open=${!!plan.error || chat.missingDocument}>
                <summary><span class="context-dot"></span><span>${plan.error ? 'Reading limit needs attention' : chat.missingDocument ? 'Reopen your document' : plan.mode === 'relevant' ? 'Reading relevant excerpts' : chat.scope ? chat.readingScopeLabel : 'Reading the full document'}</span><span class="context-percent" aria-hidden="true">${icon('chevron-down', 14)}</span></summary>
                <div class="context-details"><div class="context-heading"><strong>Context usage</strong><span>~${plan.inputTokens.toLocaleString()} / ${plan.limit.toLocaleString()}</span></div>
                  <progress max="100" value=${percentage} aria-label="Estimated context including reserves"></progress>
                  <small>Includes ${plan.outputReserve.toLocaleString()} tokens for the answer and ${plan.margin.toLocaleString()} safety margin.${chat.actualContextTokens !== null ? html` Last measured: ${chat.actualContextTokens.toLocaleString()} tokens.` : ''}</small>
                  ${plan.error ? html`<p class="error-note" role="alert">${plan.error}</p>` : ''}
                  ${chat.missingDocument ? html`<p class="error-note" role="alert">Reopen the original document to continue this saved chat.</p>` : ''}
                  ${plan.mode === 'relevant' ? html`<small>Use original-language keywords or select a page for precise coverage.</small>` : ''}</div>
              </details>` : ''}
            <div id="chat-panel" class="qa-block" role="tabpanel" aria-labelledby="chat-tab" ?hidden=${this.assistantTab !== 'chat'}>
              <document-chat-window .state=${this.state} .documentLoading=${this.isParsingDoc}
                @preview-html=${this.handlePreviewHtml} @source-selected=${this.selectSource}></document-chat-window>
            </div>
            <section id="summary-panel" class="summary-block" role="tabpanel" aria-labelledby="summary-tab" ?hidden=${this.assistantTab !== 'summary'}>
              <div class="summary-header"><h3>At a glance</h3>${currentDoc ? html`
                <button class="btn btn-primary btn-summarize" ?disabled=${busy} @click=${() => chat.summarizeDocument()}>
                  ${isSummarizing ? 'Generating…' : summaryText ? 'Regenerate' : 'Generate summary'}</button>` : ''}</div>
              <div class="summary-scroll">
                ${summaryText ? html`<div class="summary-body"><div @click=${this.handleSummaryCitation}>${renderHtml(marked.parse(chat.summaryMarkdown, {async: false}) as string)}</div>
                  <div class="source-links">${chat.summaryCitations.map((citation, index) => html`<button
                    aria-label=${`View source ${index + 1} · ${sourceLocation(citation.label)}`}
                    title=${`View source · ${sourceLocation(citation.label)}\n${citation.excerpt}`}
                    @click=${() => this.selectSource(new CustomEvent('source-selected', {detail: citation}))}>[${index + 1}] · ${sourceLocation(citation.label)}</button>`)}</div>
                  ${chat.summaryInvalidCitations.length ? html`<small class="error-note">Some source references could not be verified. Check the summary against the document.</small>` : ''}
                  ${!isSummarizing && !chat.summaryCitations.length ? html`<small>No source references were provided. Check the summary against the document.</small>` : ''}
                  ${isSummarizing ? html`<span class="summary-streaming-indicator"></span>` : ''}</div>` : html`
                    <div class="summary-empty"><span class="summary-illustration" aria-hidden="true">${icon('summary', 32)}</span><h3>${isSummarizing ? 'Connecting the main ideas…' : 'The bigger picture, in a few words.'}</h3>
                      <p>${!currentDoc ? 'Open a document to get an overview of its main ideas.' : isSummarizing ? 'Your summary will appear here as it is generated.' : 'Generate an overview, then follow the references to explore the details.'}</p></div>`}
                ${chat.summaryProgress ? html`<p class="text-note" role="status">${chat.summaryProgress}</p>` : ''}
              </div>
              ${isSummarizing ? html`<button class="btn btn-secondary" @click=${() => chat.cancelGeneration()}>Stop summary</button>` : ''}
            </section>
          </aside>
        </main>`}
      <div id="preview-overlay" class="preview-overlay" style=${`display: ${this.isPreviewOpen ? 'flex' : 'none'};`}>
        <button id="btn-close-preview" class="btn-close-preview" @click=${this.closePreview}>Exit Preview ${icon('close')}</button>
        <iframe id="preview-iframe" title="Generated HTML preview" sandbox="allow-scripts"></iframe>
      </div>`;
  }

  private handleTabKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.assistantTab = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'summary' : this.assistantTab === 'chat' ? 'summary' : 'chat';
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>(`#${this.assistantTab}-tab`)?.focus());
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'document-qa-app': DocumentQaApp;
  }
}
