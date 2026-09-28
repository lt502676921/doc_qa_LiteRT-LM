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

import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { marked } from 'marked';

import {
  ACCEPTED_FILE_TYPES,
  parseDocumentFile,
} from '../services/document_service.js';
import { LlmChatStateController } from '../state_controller.js';
import { sharedStyles } from '../styles/shared_styles.js';
import { registerAppServiceWorker, renderHtml, setIframeHtml } from './util.js';

/* tslint:disable:no-new-decorators */

/**
 * Main application container for the Document Q&A & Intelligence interface,
 * powered by LiteRT-LM running Gemma 4 on WebGPU.
 */
@customElement('litert-lm-chat-app')
export class LitertLmChatApp extends LitElement {
  // Central source of truth state controller
  private state = new LlmChatStateController(this);

  // Drawer & Overlay UI State
  @property({ type: Boolean }) isSidebarOpen = false;
  @property({ type: Boolean }) isPreviewOpen = false;

  @state() private isParsingDoc = false;
  @state() private docError: string | null = null;
  @state() private isDraggingOver = false;

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        width: 100%;
        height: 100%;
        overflow: hidden;
        color: var(--ink);
      }

      /* Topbar Header */
      .topbar {
        height: var(--topbar-h);
        flex: 0 0 var(--topbar-h);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0 1.25rem;
        border-bottom: 1px solid var(--line);
        background: rgba(250, 248, 243, 0.88);
        backdrop-filter: blur(10px);
        z-index: 20;
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .btn-toggle-sidebar {
        background: none;
        border: 1px solid var(--line);
        color: var(--ink);
        font-size: 1.15rem;
        cursor: pointer;
        padding: 6px 10px;
        border-radius: 6px;
        transition: background-color 0.15s, border-color 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .btn-toggle-sidebar:hover {
        background-color: rgba(28, 27, 22, 0.06);
        border-color: var(--accent);
      }

      .brand-group {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: nowrap;
      }

      .brand {
        margin: 0;
        font-family: var(--font-serif);
        font-size: 1.35rem;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--ink);
        white-space: nowrap;
      }

      .brand-badge {
        font-size: 0.68rem;
        font-family: var(--font-mono);
        color: var(--accent);
        background: var(--accent-soft);
        border: 1px solid rgba(30, 107, 102, 0.25);
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .topbar-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        height: 24px;
        box-sizing: border-box;
        border-radius: 999px;
        font-size: 0.72rem;
        font-family: var(--font-mono);
        color: var(--ink-muted);
        background: rgba(28, 27, 22, 0.04);
        border: 1px solid var(--line);
        cursor: pointer;
        transition: all 0.15s ease;
        line-height: 1;
        user-select: none;
        max-width: 280px;
        white-space: nowrap;
      }

      .topbar-status-badge:hover {
        background: rgba(28, 27, 22, 0.08);
        border-color: var(--accent);
        color: var(--ink);
      }

      .topbar-status-badge.ready {
        border-color: rgba(30, 107, 102, 0.3);
        background: rgba(30, 107, 102, 0.06);
        color: var(--accent);
      }

      .topbar-status-badge.loading {
        border-color: rgba(234, 179, 8, 0.35);
        background: rgba(234, 179, 8, 0.08);
        color: #854d0e;
      }

      .topbar-status-badge.error {
        border-color: rgba(197, 48, 48, 0.35);
        background: rgba(197, 48, 48, 0.08);
        color: #c53030;
      }

      .topbar-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: #64748b;
        flex-shrink: 0;
      }

      .topbar-status-dot.loading {
        background-color: #eab308;
        animation: pulseDot 1.4s infinite;
      }

      .topbar-status-dot.ready {
        background-color: var(--accent);
      }

      .topbar-status-dot.error {
        background-color: #c53030;
      }

      .topbar-status-label {
        font-weight: 600;
        color: inherit;
        flex-shrink: 0;
      }

      .topbar-status-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @keyframes pulseDot {
        0%, 100% { opacity: 0.35; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.15); }
      }

      .topbar-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .doc-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--surface);
        border: 1px solid var(--line);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.78rem;
        max-width: 280px;
      }

      .doc-pill-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        color: var(--ink);
      }

      .doc-pill-size {
        font-size: 0.7rem;
        color: var(--ink-muted);
        font-family: var(--font-mono);
      }

      .btn-close-doc {
        background: none;
        border: none;
        color: var(--ink-muted);
        cursor: pointer;
        font-size: 0.85rem;
        padding: 0 2px;
        border-radius: 4px;
        line-height: 1;
        display: flex;
        align-items: center;
      }

      .btn-close-doc:hover {
        color: #c53030;
      }

      .file-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 1rem;
        border-radius: 999px;
        background: var(--accent);
        color: #ffffff;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 160ms ease, transform 160ms ease;
      }

      .file-btn:hover {
        background: var(--accent-hover);
      }

      .file-btn:active {
        transform: translateY(1px);
      }

      .file-btn input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        width: 100%;
        height: 100%;
      }

      .file-btn-secondary {
        background: transparent;
        color: var(--accent);
        border: 1.5px solid var(--accent);
      }

      .file-btn-secondary:hover {
        background: var(--accent-soft);
      }

      /* Workspace Split Screen Layout */
      .workspace {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
        overflow: hidden;
        position: relative;
      }

      .pane {
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Left Pane: Document Reading */
      .pane-document {
        border-right: 1px solid var(--line);
        padding: 1.1rem 1.25rem 1.25rem;
        background: rgba(255, 253, 248, 0.4);
      }

      .pane-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
        flex-shrink: 0;
      }

      .pane-title {
        margin: 0;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .pane-meta {
        margin: 0;
        font-size: 0.82rem;
        color: var(--ink-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--font-mono);
      }

      /* Empty State */
      .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        text-align: center;
        color: var(--ink-muted);
        border: 1.5px dashed var(--line);
        border-radius: var(--radius);
        background: rgba(255, 253, 248, 0.6);
        padding: 2.5rem 1.5rem;
        transition: border-color 0.2s, background-color 0.2s;
      }

      .empty-state.dragging {
        border-color: var(--accent);
        background: var(--accent-soft);
      }

      .empty-state p {
        margin: 0;
        max-width: 22rem;
        line-height: 1.5;
        font-size: 0.95rem;
      }

      .empty-state-compact {
        flex: 0 0 auto;
        min-height: 4.5rem;
        padding: 1rem;
      }

      .empty-state-icon {
        width: 48px;
        height: 48px;
        stroke: var(--accent);
        opacity: 0.8;
      }

      /* Document Reading Page */
      .document-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0.5rem 0.5rem 1.5rem;
      }

      .document-page {
        max-width: 48rem;
        margin: 0 auto;
        min-height: 100%;
        padding: 2.5rem 3rem;
        background: var(--page);
        border: 1px solid var(--line);
        border-radius: 4px;
        box-shadow: var(--shadow-page);
        font-family: var(--font-serif);
        font-size: 1.05rem;
        line-height: 1.7;
        animation: fadeIn 280ms ease;
        overflow-x: auto;
      }

      .document-page h1,
      .document-page h2,
      .document-page h3,
      .document-page h4 {
        font-family: var(--font-serif);
        color: var(--ink);
        letter-spacing: -0.015em;
        line-height: 1.3;
      }

      .document-page h1 {
        font-size: 1.85rem;
        margin: 0 0 1rem;
        border-bottom: 1px solid var(--line);
        padding-bottom: 0.5rem;
      }

      .document-page h2 {
        font-size: 1.35rem;
        margin: 1.75rem 0 0.75rem;
      }

      .document-page h3 {
        font-size: 1.15rem;
        margin: 1.25rem 0 0.5rem;
      }

      .document-page p {
        margin: 0 0 1rem;
      }

      .document-page table {
        border-collapse: collapse;
        width: 100%;
        margin: 1.25rem 0;
        font-family: var(--font-sans);
        font-size: 0.88rem;
      }

      .document-page th,
      .document-page td {
        border: 1px solid var(--line);
        padding: 0.5rem 0.75rem;
        text-align: left;
        vertical-align: top;
      }

      .document-page th {
        background-color: rgba(28, 27, 22, 0.04);
        font-weight: 600;
      }

      .document-page blockquote {
        margin: 1.25rem 0;
        padding: 0.75rem 1.25rem;
        border-left: 3px solid var(--accent);
        background: var(--accent-soft);
        color: var(--ink-muted);
        font-style: italic;
      }

      .document-page pre {
        background: rgba(28, 27, 22, 0.05);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 1rem;
        overflow-x: auto;
        font-family: var(--font-mono);
        font-size: 0.88rem;
        line-height: 1.5;
      }

      .document-page code {
        font-family: var(--font-mono);
        font-size: 0.9em;
        background: rgba(28, 27, 22, 0.05);
        padding: 2px 5px;
        border-radius: 4px;
      }

      /* Right Pane: AI Tools (Summary + Q&A) */
      .pane-ai {
        gap: 0.85rem;
        padding: 1.1rem 1.25rem 1.25rem;
        background: rgba(250, 248, 243, 0.65);
      }

      /* Summary Block */
      .summary-block {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .summary-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .btn-summarize {
        background: none;
        border: 1px solid var(--accent);
        color: var(--accent);
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 3px 10px;
        cursor: pointer;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .btn-summarize:hover:not(:disabled) {
        background: var(--accent);
        color: #ffffff;
      }

      .btn-summarize:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .summary-body {
        padding: 0.9rem 1.1rem;
        border-radius: var(--radius);
        background: var(--surface);
        border: 1px solid var(--line);
        font-size: 0.9rem;
        line-height: 1.6;
        max-height: 200px;
        overflow-y: auto;
        animation: fadeIn 300ms ease;
      }

      .summary-body p {
        margin: 0 0 0.65rem;
      }

      .summary-body p:last-child {
        margin-bottom: 0;
      }

      .summary-body ul,
      .summary-body ol {
        margin: 0 0 0.65rem;
        padding-left: 1.25rem;
      }

      .summary-body li + li {
        margin-top: 0.25rem;
      }

      .summary-streaming-indicator {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--accent);
        margin-left: 4px;
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 0.2; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.1); }
      }

      /* Q&A Block */
      .qa-block {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      litert-chat-window {
        flex: 1;
        min-height: 0;
        width: 100%;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
      }

      /* Collapsible Configurations & Chat History Drawer */
      .sidebar-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(28, 27, 22, 0.4);
        z-index: 999;
        backdrop-filter: blur(4px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .sidebar-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }

      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 320px;
        max-width: 85vw;
        height: 100vh;
        z-index: 1000;
        background-color: var(--surface);
        border-right: 1px solid var(--line);
        padding: 20px;
        box-sizing: border-box;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: none;
      }

      .sidebar.open {
        transform: translateX(0);
        box-shadow: 12px 0 32px rgba(28, 27, 22, 0.15);
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }

      .drawer-title {
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ink-muted);
        margin: 0;
      }

      .btn-close-drawer {
        background: none;
        border: none;
        font-size: 1.1rem;
        color: var(--ink-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        line-height: 1;
      }

      .btn-close-drawer:hover {
        color: var(--ink);
      }

      litert-sidebar {
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      /* HTML Preview Overlay */
      .preview-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(28, 27, 22, 0.8);
        z-index: 9999;
        display: flex;
        flex-direction: column;
      }

      .preview-overlay iframe {
        width: 100%;
        height: 100%;
        border: none;
        background-color: #ffffff;
      }

      .btn-close-preview {
        position: absolute;
        top: 16px;
        right: 24px;
        background-color: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 16px;
        color: var(--ink);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        backdrop-filter: blur(4px);
        z-index: 10000;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Mobile & Tablet Responsive */
      @media (max-width: 860px) {
        .workspace {
          grid-template-columns: 1fr;
          grid-template-rows: minmax(45vh, auto) minmax(45vh, auto);
          overflow-y: auto;
        }

        .pane-document {
          border-right: none;
          border-bottom: 1px solid var(--line);
          min-height: 45vh;
        }

        .document-page {
          padding: 1.5rem 1.25rem;
        }

        .pane-ai {
          min-height: 45vh;
        }
      }
    `,
  ];

  override firstUpdated() {
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

  private async processSelectedFile(file: File) {
    this.isParsingDoc = true;
    this.docError = null;

    try {
      const parsedDoc = await parseDocumentFile(file);
      await this.state.chatSession.setDocument(parsedDoc);

      // Auto-trigger executive summary after document parse
      void this.state.chatSession.summarizeDocument();
    } catch (err: unknown) {
      console.error('[LiteRT-LM] Failed to parse document:', err);
      this.docError = (err as Error).message || 'Failed to parse file';
    } finally {
      this.isParsingDoc = false;
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
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
      console.error('[LiteRT-LM] Failed to decode HTML content:', err);
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
    const currentDoc = this.state.chatSession.currentDoc;
    const isSummarizing = this.state.chatSession.isSummarizing;
    const isGenerating = this.state.chatSession.isGenerating;
    const isModelLoading = this.state.modelLoader.isModelLoading;
    const isReady = !!this.state.modelLoader.engine;
    const isError =
      this.state.statusText.toLowerCase().includes('failed') ||
      this.state.statusText.toLowerCase().includes('error');

    let statusType = 'idle';
    if (isError) {
      statusType = 'error';
    } else if (isModelLoading || isGenerating || isSummarizing) {
      statusType = 'loading';
    } else if (isReady) {
      statusType = 'ready';
    }

    const summaryText = this.state.chatSession.summaryText;

    return html`
      <!-- Left Drawer Overlay & Panel -->
      <div
        class="sidebar-overlay ${this.isSidebarOpen ? 'open' : ''}"
        @click=${this.toggleSidebar}
      ></div>

      <aside class="sidebar ${this.isSidebarOpen ? 'open' : ''}">
        <div class="drawer-header">
          <h2 class="drawer-title">Model &amp; Chat History</h2>
          <button
            class="btn-close-drawer"
            aria-label="Close Drawer"
            @click=${this.toggleSidebar}
          >
            ✕
          </button>
        </div>
        <litert-sidebar
          .state=${this.state}
          @close=${this.toggleSidebar}
        ></litert-sidebar>
      </aside>

      <!-- Top Header Navigation -->
      <header class="topbar">
        <div class="topbar-left">
          <button
            id="btn-toggle-sidebar"
            class="btn-toggle-sidebar"
            aria-label="Toggle Menu"
            title="Model Status, Parameters & Chat History"
            @click=${this.toggleSidebar}
          >
            ☰
          </button>
          <div class="brand-group">
            <h1 class="brand">Doc Q&amp;A</h1>
            <span class="brand-badge">Gemma 4 E4B · WebGPU</span>
            <div
              class="topbar-status-badge ${statusType}"
              title="Status: ${this.state.statusText} (Click to open drawer)"
              @click=${this.toggleSidebar}
            >
              <span class="topbar-status-dot ${statusType}"></span>
              <span class="topbar-status-label">Status:</span>
              <span class="topbar-status-text">${this.state.statusText}</span>
            </div>
          </div>
        </div>

        <div class="topbar-right">
          ${currentDoc
            ? html`
                <div class="doc-pill" title="${currentDoc.name}">
                  <span class="doc-pill-name">${currentDoc.name}</span>
                  <span class="doc-pill-size"
                    >${(currentDoc.size / 1024).toFixed(0)} KB</span
                  >
                  <button
                    class="btn-close-doc"
                    title="Close document"
                    @click=${this.handleCloseDoc}
                  >
                    ✕
                  </button>
                </div>
              `
            : ''}

          <label class="file-btn">
            Choose file…
            <input
              type="file"
              accept=${ACCEPTED_FILE_TYPES}
              @change=${this.handleFileChosen}
            />
          </label>
        </div>
      </header>

      <!-- Main Split Workspace -->
      <main class="workspace">
        <!-- Left Pane: Document Preview -->
        <section
          class="pane pane-document"
          aria-label="Document Preview"
          @dragover=${this.handleDragOver}
          @dragleave=${this.handleDragLeave}
          @drop=${this.handleDrop}
        >
          <div class="pane-header">
            <h2 class="pane-title">Document</h2>
            ${currentDoc
              ? html`
                  <p class="pane-meta">
                    ${currentDoc.extension.toUpperCase()} ·
                    ~${currentDoc.wordCount.toLocaleString()} words
                  </p>
                `
              : ''}
          </div>

          ${this.isParsingDoc
            ? html`
                <div class="empty-state">
                  <div
                    class="summary-streaming-indicator"
                    style="width: 16px; height: 16px;"
                  ></div>
                  <p>Parsing and extracting document content...</p>
                </div>
              `
            : this.docError
            ? html`
                <div class="empty-state" style="border-color: #c53030;">
                  <p style="color: #c53030; font-weight: 600;">
                    ${this.docError}
                  </p>
                  <label class="file-btn file-btn-secondary">
                    Try another file…
                    <input
                      type="file"
                      accept=${ACCEPTED_FILE_TYPES}
                      @change=${this.handleFileChosen}
                    />
                  </label>
                </div>
              `
            : !currentDoc
            ? html`
                <div
                  class="empty-state ${this.isDraggingOver ? 'dragging' : ''}"
                >
                  <svg
                    class="empty-state-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    ></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  <p>
                    Select or drag &amp; drop a PDF, DOCX, XLSX, PPTX, or Markdown file to preview it here.
                  </p>
                  <label class="file-btn file-btn-secondary">
                    Choose file…
                    <input
                      type="file"
                      accept=${ACCEPTED_FILE_TYPES}
                      @change=${this.handleFileChosen}
                    />
                  </label>
                </div>
              `
            : html`
                <div class="document-scroll">
                  <article class="document-page">
                    ${renderHtml(currentDoc.html)}
                  </article>
                </div>
              `}
        </section>

        <!-- Right Pane: AI Tools (Summary & Q&A) -->
        <aside class="pane pane-ai" aria-label="AI Tools">
          <!-- Executive Summary Section -->
          <div class="summary-block">
            <div class="summary-header">
              <h2 class="pane-title">Summary</h2>
              ${currentDoc
                ? html`
                    <button
                      class="btn-summarize"
                      ?disabled=${isSummarizing}
                      @click=${() =>
                        this.state.chatSession.summarizeDocument()}
                    >
                      ${isSummarizing
                        ? html`Generating...
                            <span class="summary-streaming-indicator"></span>`
                        : summaryText
                        ? '⟳ Regenerate'
                        : '✨ Summarize'}
                    </button>
                  `
                : ''}
            </div>

            ${!currentDoc
              ? html`
                  <div class="empty-state empty-state-compact">
                    <p style="font-size: 0.85rem;">
                      A summary of the selected document will appear here.
                    </p>
                  </div>
                `
              : isSummarizing && !summaryText
              ? html`
                  <div class="summary-body" style="font-style: italic; color: var(--ink-muted);">
                    Analyzing document and generating executive summary with Gemma 4 E4B...
                    <span class="summary-streaming-indicator"></span>
                  </div>
                `
              : summaryText
              ? html`
                  <div class="summary-body">
                    ${renderHtml(marked.parse(summaryText, { async: false }) as string)}
                    ${isSummarizing
                      ? html`<span class="summary-streaming-indicator"></span>`
                      : ''}
                  </div>
                `
              : html`
                  <div class="empty-state empty-state-compact">
                    <p style="font-size: 0.85rem;">
                      Click <b>✨ Summarize</b> to generate an executive overview.
                    </p>
                  </div>
                `}
          </div>

          <!-- Document Q&A Section -->
          <div class="qa-block">
            <div class="pane-header" style="margin-bottom: 0.5rem;">
              <h2 class="pane-title">Ask about this document</h2>
            </div>
            <litert-chat-window
              .state=${this.state}
              @preview-html=${this.handlePreviewHtml}
            ></litert-chat-window>
          </div>
        </aside>
      </main>

      <!-- Fullscreen HTML Preview Overlay (if triggered) -->
      <div
        id="preview-overlay"
        class="preview-overlay"
        style="display: ${this.isPreviewOpen ? 'flex' : 'none'};"
      >
        <button
          id="btn-close-preview"
          class="btn-close-preview"
          @click=${this.closePreview}
        >
          Exit Preview ✕
        </button>
        <iframe id="preview-iframe" sandbox="allow-scripts"></iframe>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'litert-lm-chat-app': LitertLmChatApp;
  }
}
