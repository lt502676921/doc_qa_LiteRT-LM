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

import {storageKey} from '../services/browser_state.js';
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { LlmChatStateController } from '../state_controller.js';
import { MODELS, PartialSettingsSchema, Settings } from '../stores/settings_store.js';
import { sharedStyles } from '../styles/shared_styles.js';

import './custom_dropdown';
import type { CustomDropdown } from './custom_dropdown.js';

/* tslint:disable:no-new-decorators */

/** Component representing the sidebar drawer. */
@customElement('document-sidebar')
export class DocumentSidebar extends LitElement {
  @property({ type: Object })
  state!: LlmChatStateController;

  @query('custom-dropdown')
  private readonly dropdown!: CustomDropdown;

  static override styles = [
    sharedStyles, css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
        overflow: hidden;
      }

      .section-title {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: none;
        letter-spacing: 0;
        color: var(--accent);
        margin: 0 0 12px 0;
        border-bottom: 1px solid var(--border);
        padding-bottom: 8px;
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;
      }

      .status-card {
        background-color: var(--page);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        font-family: var(--font-mono);
        font-size: 0.75rem;
      }

      .status-header {
        font-weight: 700;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .status-indicator {
        height: 8px;
        width: 8px;
        border-radius: 50%;
        background-color: #64748b; 
      }

      .status-indicator.loading { background-color: #eab308; animation: pulse 1.5s infinite; }
      .status-indicator.ready { background-color: var(--accent); }
      .status-indicator.error { background-color: #c53030; }

      @keyframes pulse {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
      }

      .status-text {
        color: var(--text-muted);
        word-break: break-all;
        max-height: 100px;
        overflow-y: auto;
      }

      .metrics-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 0.75rem;
        font-family: var(--font-mono);
        color: var(--text-muted);
        margin-top: 12px;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
      }

      .metric-val {
        color: var(--ink);
        font-weight: 700;
      }

      .conversations-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1 1 0;
        min-height: 60px;
        overflow-y: auto;
        overscroll-behavior: contain;
        margin-top: 4px;
        padding: 0;
        background: none;
        border: none;
      }

      .sidebar-status-footer {
        flex-shrink: 0;
        margin-top: auto;
        padding-top: 12px;
        display: flex;
        flex-direction: column;
      }

      .conv-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.875rem;
        color: var(--text-muted);
        transition: background-color 0.15s, color 0.15s, border-color 0.15s;
        user-select: none;
        border: 1px solid transparent;
      }
      .conv-item:not(.active):hover {
        background-color: rgba(28, 27, 22, 0.05);
        color: var(--ink);
      }
      .conv-item.active {
        background-color: var(--accent-soft);
        color: var(--accent) !important;
        font-weight: 600;
      }
      .conv-item.active:hover {
        background-color: var(--accent-soft) !important;
        color: var(--accent) !important;
        cursor: default;
      }
      .new-chat-item {
        color: var(--accent) !important;
        border: 1px dashed var(--accent);
        margin-bottom: 6px;
        font-weight: bold;
      }
      .new-chat-item:not(.active):hover {
        background-color: var(--accent-soft) !important;
        color: var(--accent) !important;
      }
      button.new-chat-item { width:100%; font-family:inherit; background:var(--surface); justify-content:flex-start; text-align:left; }
      .conv-open { display:flex; align-items:center; min-width:0; flex:1; padding:4px 0; border:0; background:transparent; font:inherit; color:inherit; text-align:left; cursor:pointer; }
      .conv-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 6px;
      }
      .btn-delete-conv {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 0.7rem;
        padding: 2px 4px;
        border-radius: 4px;
        opacity: 0.5;
        transition: opacity 0.15s, color 0.15s;
      }
      .btn-delete-conv:hover {
        opacity: 1;
        color: #ef4444 !important;
      }

      .btn-dismiss-sidebar {
        display: none; 
      }

      .clear-all-btn {
        background: none;
        border: none;
        color: #ef4444;
        font-size: 0.65rem;
        font-weight: bold;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: background-color 0.15s;
      }

      .clear-all-btn:hover {
        background-color: rgba(239, 68, 68, 0.1);
      }

      @media (max-width: 768px) {
        .btn-dismiss-sidebar {
          display: block !important; 
          background: none;
          border: 1px solid rgba(0, 201, 158, 0.3);
          color: var(--teal);
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: bold;
          padding: 4px 10px;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s, color 0.15s;
        }
        .btn-dismiss-sidebar:hover {
          background-color: rgba(0, 201, 158, 0.08);
          border-color: var(--teal);
          color: #ffffff;
        }
      }


    `
  ];

  override connectedCallback() {
    super.connectedCallback();

    // Receive state updates from the centralized state controller.
    this.state.addHost(this);
  }

  override disconnectedCallback() {
    this.state.removeHost(this);
    super.disconnectedCallback();
  }

  private getTotalCacheSize(): string {
    let totalBytes = 0;
    for (const [_, size] of this.state.modelLoader.cachedModels) {
      totalBytes += size;
    }
    const sizeInGB = totalBytes / 1e9;
    return `${sizeInGB.toFixed(2)} GB`;
  }

  private isLargeModel(path: string): boolean {
    return path.includes('gemma-4-26B') || path.includes('gemma-4-31B');
  }

  private readonly LARGE_MODEL_WARNING_KEY = storageKey('large-model-warning-dismissed');

  private hasDismissedWarning(): boolean {
    return window.localStorage.getItem(this.LARGE_MODEL_WARNING_KEY) === 'true';
  }

  private dismissWarning() {
    window.localStorage.setItem(this.LARGE_MODEL_WARNING_KEY, 'true');
  }

  private handleModelChange(e: CustomEvent<string>) {
    const path = e.detail;
    if (path === 'upload') {
      this.triggerFileUpload();
      return;
    }
    if (path === 'select-dir') {
      void this.state.localDirService.mountDirectory();
      return;
    }

    if (this.isLargeModel(path) && !this.hasDismissedWarning()) {
      const proceed = confirm(
        'Warning: The selected model requires a significant amount of video memory (VRAM).\n' +
        'Running it may cause your browser tab to crash or your system to become unresponsive ' +
        'if you do not have enough VRAM.\n\n' +
        'Do you want to proceed?');
      if (!proceed) {
        if (this.dropdown) {
          this.dropdown.value = this.state.settings.selectedModelPath;
        }
        return;
      }
      this.dismissWarning();
    }

    if (this.state.settings.selectedModelPath !== path) {
      this.state.settings.selectedModelPath = path;
      this.state.settings.saveSettings();

      // Auto-trigger model loading compilation in background on settings change
      this.state.modelLoader.loadModelWeights(
        this.state.settings.modelSettings, async () => {
          await this.state.chatSession.createConversationSession();
        });
    }
  }

  private triggerFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.litertlm';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          const customModel =
            await this.state.modelLoader.importCustomModel(file);
          const exists = this.state.settings.customModels.some(
            m => m.path === customModel.path);
          if (!exists) {
            this.state.settings.customModels = [
              ...this.state.settings.customModels, customModel
            ];
          }
          this.state.settings.selectedModelPath = customModel.path;
          this.state.settings.saveSettings();

          await this.state.modelLoader.loadModelWeights(
            this.state.settings.modelSettings, async () => {
              await this.state.chatSession.createConversationSession();
            });
        } catch (e) {
          console.error('[Doc Q&A] Failed to import/load custom model:', e);
        }
      }
    };
    input.click();
  }

  private async handleRemoveCached(e: Event, modelPath: string) {
    e.stopPropagation();  // Stop click propagation to prevent selecting model
    const deleted =
      await this.state.modelLoader.deleteModelFromCache(modelPath);
    if (deleted) {
      let settingsChanged = false;
      if (modelPath.startsWith('https://local-model/')) {
        this.state.settings.customModels =
          this.state.settings.customModels.filter(m => m.path !== modelPath);
        settingsChanged = true;
      }
      if (this.state.settings.selectedModelPath === modelPath) {
        this.state.settings.selectedModelPath = MODELS[0]!.path;
        settingsChanged = true;
      }
      if (settingsChanged) {
        this.state.settings.saveSettings();
      }
    }
  }

  private handleSliderInput(e: Event, prop: keyof Settings) {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    let val: unknown;

    if (target instanceof HTMLInputElement) {
      if (target.type === 'checkbox') {
        val = target.checked;
      } else {
        val = target.type === 'number' ? Number(target.value) : target.value;
      }
    } else {
      val = target.value;
    }

    const parseResult = PartialSettingsSchema.safeParse({ [prop]: val });
    if (parseResult.success) {
      Object.assign(this.state.settings, parseResult.data);
      this.state.settings.saveSettings();
    } else {
      console.warn('[Doc Q&A] Invalid settings input:', parseResult.error);
    }
  }

  private dismissSidebar() {
    this.dispatchEvent(new CustomEvent('close', {
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    const activeModel =
      MODELS.find(m => m.path === this.state.settings.selectedModelPath) ||
      MODELS[1]!;
    const activeModelFilename = activeModel.filename;

    return html`
      <!-- Model Selection Group (Selector Hidden for Document Workspace) -->
      <div class="control-group" style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h2 class="section-title" style="margin: 0; border: none; padding: 0;">Active Model</h2>
          <button id="btn-dismiss-sidebar" class="btn-dismiss-sidebar" aria-label="Dismiss Configurations" @click=${this.dismissSidebar}>Done</button>
        </div>

        <div style="background: var(--accent-soft); border: 1px solid rgba(30, 107, 102, 0.25); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-weight: 600; color: var(--ink); font-size: 0.88rem;">${activeModel.name}</div>
            <span style="font-size: 0.65rem; color: var(--accent); background: rgba(30, 107, 102, 0.12); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-weight: 600;">WebGPU</span>
          </div>
        </div>
      </div>

      <!-- Static Inference Config Group (Only Context Length and Thinking exposed) -->
      <div class="control-group" style="border-top: 1px solid var(--border); padding-top: 14px;">
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label for="context-length" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">Context Length</label>
            <span style="font-size: 0.65rem; color: var(--accent); font-family: var(--font-mono); font-weight: 600;">${Math.round(this.state.settings.contextLength / 1024)}K tokens</span>
          </div>
          <input type="number" id="context-length" .value=${String(
      this.state.settings
        .contextLength)} min="1024" max="131072" step="1024" style="padding: 8px; font-size: 0.72rem; width: 100%; box-sizing: border-box; text-align: left;" @input=${(e: Event) => this.handleSliderInput(e, 'contextLength')}>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="enable-thinking" ?checked=${this.state.settings
        .enableThinking} style="width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer;" @change=${(e: Event) => this.handleSliderInput(e, 'enableThinking')}>
            <label for="enable-thinking" style="margin: 0; cursor: pointer; text-transform: none; font-size: 0.78rem; color: var(--ink);">Thinking</label>
          </div>
          <button id="btn-reset-settings" class="btn btn-secondary" style="font-size: 0.7rem; padding: 4px 8px; height: 22px; line-height: 1;" @click=${() => this.state.settings.resetDefaults()}>Reset</button>
        </div>
      </div>

      <!-- Saved Conversations List -->
      <div id="conversations-list" class="conversations-list" style="border-top: 1px solid var(--border); padding-top: 10px;">
        <!-- ➕ New Chat dashed list header -->
        <button class="conv-item new-chat-item ${this.state.chatSession.activeSavedConvId === null ? 'active' : ''}"
          @click=${async () => {
            await this.state.chatSession.startNewConversation();
            this.dispatchEvent(new CustomEvent('new-workspace', {bubbles:true, composed:true}));
            this.dismissSidebar();
          }}>
          <!-- SVG large plus icon for new chat -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span class="conv-title">New workspace</span>
        </button>

        <!-- Saved index loop -->
        ${this.state.chatSession.conversationsList.map(
          conv => html`
          <div class="conv-item ${this.state.chatSession.activeSavedConvId === conv.id ?
              'active' :
              ''}">
            <button class="conv-open" @click=${async () => {await this.state.chatSession.selectConversation(conv.id); this.dismissSidebar();}}>
              <span class="conv-title" title="${conv.title}">${conv.title}</span>
            </button>
            <button class="btn-delete-conv" aria-label="Delete Conversation" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; padding: 4px;" @click=${(e: Event) => {
              e.stopPropagation();
              this.state.chatSession.deleteConversation(conv.id);
            }}>✕</button>
          </div>
        `)}
      </div>

      <!-- Anchored Sidebar Status Footer -->
      <div class="sidebar-status-footer">
        <div class="status-card" style="background-color: var(--page); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div class="status-header" style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: bold; margin: 0;">
            <span id="status-dot" class="status-indicator ${this.state.modelLoader.isModelLoading ? 'loading' :
        this.state.modelLoader.engine ? 'ready' :
          ''}"></span>
            <span>Status:</span>
          </div>
          <div id="status-text" class="status-text" style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; word-break: break-word;">${this.state.statusText}</div>

          <!-- Loading Progress Bar Container -->
          ${this.state.modelLoader.isModelLoading &&
        this.state.modelLoader.downloadProgresses.has(
          activeModelFilename) ?
        html`
            <div id="progress-container" style="display: block; margin-top: 6px; border-top: 1px dashed var(--border); padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 4px;">
                <span id="progress-label">${this.state.statusText.includes('Downloading') ?
            'Downloading...' :
            'Compiling...'}</span>
                <span id="progress-percent">${this.state.modelLoader.downloadProgresses.get(
              activeModelFilename)}%</span>
              </div>
              <div style="width: 100%; height: 6px; background-color: var(--bg-input); border: 1px solid var(--border); border-radius: 3px; overflow: hidden;">
                <div id="progress-bar" style="width: ${this.state.modelLoader.downloadProgresses.get(
                activeModelFilename)}%; height: 100%; background-color: var(--accent); transition: width 0.1s ease;"></div>
              </div>
              <div id="progress-speed" style="font-size: 0.62rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 4px; text-align: right;">
                ${this.state.modelLoader.downloadSpeeds.get(activeModelFilename)}
              </div>
              
              <!-- Warning-red Cancel Download button -->
              ${this.state.modelLoader.downloadAbortController ?
            html`
                <button id="btn-cancel-download" class="btn btn-secondary" style="margin-top: 8px; width: 100%; font-size: 0.7rem; padding: 4px 8px; height: 22px; line-height: 1; color: #c53030; border-color: rgba(197, 48, 48, 0.35);" @click=${() => this.state.modelLoader.cancelDownload()}>
                  Cancel Download
                </button>
              ` :
            ''}
            </div>
          ` :
        ''}

          <!-- Metrics container showing only Load Time when measured -->
          ${this.state.modelLoader.metricLoadTime && this.state.modelLoader.metricLoadTime !== '-' ?
        html`
            <div class="metrics-container" style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--border); padding-top: 8px;">
              <div class="metric-row" style="display: flex; justify-content: space-between; font-size: 0.75rem; font-family: inherit;">
                <span style="color: var(--text-muted);">Load Time:</span>
                <span style="display: block; font-size: 0.65rem; color: var(--accent); font-weight: 600;">${this.state.modelLoader.metricLoadTime}</span>
              </div>
            </div>
          ` :
        ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'document-sidebar': DocumentSidebar;
  }
}
