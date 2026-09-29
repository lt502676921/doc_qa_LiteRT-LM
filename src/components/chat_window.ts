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

import './chat_bubble';

import {css, html, LitElement} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {LlmChatStateController} from '../state_controller.js';
import {sharedStyles} from '../styles/shared_styles.js';

/* tslint:disable:no-new-decorators */

/** Main chat window component managing messages and input. */
@customElement('document-chat-window')
export class DocumentChatWindow extends LitElement {
  @property({ type: Object })
  state!: LlmChatStateController;

  @property({type: Boolean}) documentLoading = false;

  @state()
  private shouldAutoScroll = true;

  @state() private draft = '';

  private wasGenerating = false;
  private isProgrammaticScroll = false;

  @query('#chat-messages') private msgBox!: HTMLDivElement;

  @query('#chat-input') private chatInput!: HTMLTextAreaElement;

  static override styles = [
    sharedStyles, css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        width: 100%;
        overflow: hidden;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain; 
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: radial-gradient(ellipse at top right, #eaf0fc60, transparent 60%), linear-gradient(180deg, #f7faf8, #fcfdfc);
      }

      .chat-welcome { margin:auto 0; padding:34px 2px 20px; }
      .chat-welcome .welcome-mark { color:#94ac9b; font-size:30px; display:block; margin-bottom:15px; }
      .chat-welcome h3 { font-family:var(--font-serif); font-size:25px; font-weight:400; line-height:1.25; letter-spacing:-.4px; margin:0 0 12px; }
      .chat-welcome > p { font-size:14px; color:var(--ink-muted); line-height:1.65; margin:0 0 22px; }
      .starters-container { display:flex; flex-direction:column; gap:8px; }
      .btn-starter { display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid var(--line); background:var(--surface); color:var(--ink); padding:12px 14px; border-radius:9px; font-size:13px; cursor:pointer; font-family:inherit; text-align:left; line-height:1.5; }
      .btn-starter::after { content:'↗'; color:#9aa79b; font-size:15px; }
      .btn-starter:hover:not(:disabled) { background:var(--accent-soft); border-color:#b0c7b8; }
      .composer-help { margin:6px 0 0; color:var(--ink-muted); font-size:11px; line-height:1.4; }
      .input-wrapper { display:flex; align-items:flex-end; gap:8px; padding:8px 10px; border:1px solid #d6ded3; border-radius:10px; background:var(--surface); }
      .input-wrapper:focus-within { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent-soft); }
      #chat-input { flex:1; min-width:0; height:28px; min-height:28px; max-height:140px; background:transparent; border:0; border-radius:0; color:var(--ink); padding:0; box-shadow:none; font-size:14px; font-family:inherit; line-height:1.6; resize:none; }
      .composer-actions { display:flex; flex-shrink:0; align-items:center; }
      .composer-button { height:34px; padding:0 14px; font-size:13px; border-radius:7px; white-space:nowrap; }
      @media (max-width:580px) {
        .chat-messages { padding:14px 12px; gap:12px; }
        .composer-button { max-width:128px; padding:0 10px; white-space:normal; line-height:1.2; }
      }
      @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }

      .chat-input-container {
        padding: 8px 16px 10px;
        background-color: var(--bg-card);
        border-top: none;
        display: block;
        gap: 12px;
        align-items: flex-end;
        flex-shrink: 0;
      }

      .input-textarea-wrapper {
        flex: 1;
        position: relative;
      }

      .btn-input-send {
        height: 40px;
        width: 80px;
        box-sizing: border-box;
        padding: 0;
        flex-shrink: 0;
        font-size: 0.8rem;
        border-radius: 8px;
        margin-bottom: 4px; 
      }
    `
  ];

  override connectedCallback() {
    super.connectedCallback();
    // Register this chat window as a host of our centralized state
    this.state.addHost(this);
  }

  override disconnectedCallback() {
    this.state.removeHost(this);
    super.disconnectedCallback();
  }

  override firstUpdated() {
    // Bind scroll event listener to manage user-driven auto-scroll anchoring
    if (this.msgBox) {
      this.msgBox.addEventListener('scroll', () => {
        // Ignore our own programmatic scrolls that follow the message stream.
        if (this.isProgrammaticScroll) {
          this.isProgrammaticScroll = false;
          return;
        }

        // Otherwise, it was a manual user scroll. Un-anchor if they scroll up.
        const threshold = 6;
        const atBottom = this.msgBox.scrollHeight - this.msgBox.scrollTop -
                this.msgBox.clientHeight <=
            threshold;

        if (!atBottom) {
          this.shouldAutoScroll = false;  // Manual scroll up, pause auto-scroll
        } else {
          this.shouldAutoScroll = true;  // Manual scroll down to bottom, resume
        }
      });
    }
  }

  protected override updated() {
    // Auto-scroll on new message.
    if (this.state.chatSession.isGenerating && !this.wasGenerating) {
      this.shouldAutoScroll = true;
    }
    this.wasGenerating = this.state.chatSession.isGenerating;

    if (this.state.chatSession.isGenerating && this.shouldAutoScroll) {
      requestAnimationFrame(() => {
        if (this.msgBox) {
          this.isProgrammaticScroll = true;
          this.msgBox.scrollTop = this.msgBox.scrollHeight;
        }
      });
    }
  }

  private handleInputHeight(e: Event) {
    const txtarea = e.target as HTMLTextAreaElement;
    this.draft = txtarea.value;
    txtarea.style.height = ''; // Measure content from the compact default height.
    const newHeight = Math.max(28, txtarea.scrollHeight);
    txtarea.style.height = Math.min(newHeight, 140) + 'px';
  }

  private handleEditPrompt(e: CustomEvent<{prompt: string}>) {
    const txtarea = this.chatInput;
    if (txtarea) {
      txtarea.value = e.detail.prompt;
      txtarea.focus();
      this.handleInputHeight({target: txtarea} as unknown as Event);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'j' && e.ctrlKey) {
      // Ctrl+J for a newline (like shift + enter) without sending the message.
      // because CLI apps use Ctrl+J to insert newlines.
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value =
          target.value.substring(0, start) + '\n' + target.value.substring(end);
      target.selectionStart = target.selectionEnd = start + 1;
      this.handleInputHeight(e);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // Shift+Enter for a newline, Enter to send the message.
      e.preventDefault();
      if ((e.target as HTMLTextAreaElement).value.trim()) this.triggerSendMessage();
    }
  }

  private triggerSendMessage() {
    if (this.documentLoading || this.state.chatSession.isBusy || this.state.modelLoader.isModelLoading || this.state.chatSession.missingDocument) return;
    const txtarea = this.chatInput;
    const hasText = Boolean(txtarea && txtarea.value.trim());

    if (!hasText) {
      if (!this.state.modelLoader.engine) {
        void this.state.modelLoader.loadModelWeights(this.state.settings.modelSettings, async () => {});
      }
      return;
    }

    if (txtarea && hasText && !this.state.chatSession.isGenerating) {
      const promptText = txtarea.value;
      this.draft = '';
      txtarea.value = '';
      txtarea.style.height = '';

      // Trigger centralized message generation
      void this.state.chatSession.sendMessage(promptText).then(submitted => {
        if (!submitted && !this.draft && !txtarea.value) {txtarea.value = promptText; this.handleInputHeight({target: txtarea} as unknown as Event);}
      });
    }
  }

  private useStarter(text: string) {
    const txtarea = this.chatInput;
    if (txtarea) {
      txtarea.value = text;
      txtarea.focus();

      // Trigger manual height adjustments
      this.handleInputHeight({target: txtarea} as unknown as Event);
    }
  }

  override render() {
    const isMessagesEmpty = this.state.chatSession.messages.length === 0;
    const activeModelFilename =
        this.state.settings.selectedModelPath.split('/').pop() || '';
    const isModelLoaded = Boolean(this.state.modelLoader.engine);
    const isLoading = this.state.modelLoader.isModelLoading;
    const hasDraft = Boolean(this.draft.trim());

    const startersDisabled = this.documentLoading || isLoading || this.state.chatSession.isBusy || this.state.chatSession.missingDocument;
    return html`
      <div id="chat-messages" class="chat-messages" role="log" aria-label="Conversation" aria-live="polite">
        ${isMessagesEmpty ? html`<div class="chat-welcome">
          <span class="welcome-mark" aria-hidden="true">↳</span>
          <h3>${this.state.chatSession.missingDocument ? 'Let’s reopen the source.' : this.state.chatSession.currentDoc ? 'What would you like to understand?' : 'Start with a question.'}</h3>
          <p>${this.state.chatSession.missingDocument ? 'Open the original document to continue this saved conversation.' : this.state.chatSession.currentDoc ? 'Explore the ideas, ask about the details, and check the passages behind each answer.' : 'Ask a question, or open a document to explore its ideas together.'}</p>
          <div class="starters-container">
            ${this.state.chatSession.currentDoc ? html`
              <button class="btn-starter" ?disabled=${startersDisabled} @click=${() => this.useStarter('What are the core findings and main points of this document?')}>What are the main ideas?</button>
              <button class="btn-starter" ?disabled=${startersDisabled} @click=${() => this.useStarter('Can you break down the key data and methodology in this document?')}>Explain the key data and methods</button>
              <button class="btn-starter" ?disabled=${startersDisabled} @click=${() => this.useStarter('What conclusions or recommendations does the document make?')}>What does the document conclude?</button>` : html`
              <button class="btn-starter" ?disabled=${startersDisabled} @click=${() => this.useStarter('What types of documents can I upload and analyze?')}>Which documents can I explore?</button>
              <button class="btn-starter" ?disabled=${startersDisabled} @click=${() => this.useStarter('How does local WebGPU document intelligence work?')}>How does local analysis work?</button>`}
          </div>
        </div>` : ''}
        ${this.state.chatSession.messages.map((msg, idx) => html`<document-chat-bubble .message=${msg} .index=${idx} .state=${this.state} .busy=${this.state.chatSession.isBusy} @edit-prompt=${this.handleEditPrompt}></document-chat-bubble>`)}
      </div>
      ${isLoading ? html`<div role="status" style="padding:10px 20px;font-size:12px;color:var(--accent);background:var(--accent-soft);">
        ${this.state.statusText} ${this.state.modelLoader.downloadProgresses.get(activeModelFilename) !== undefined ? `${this.state.modelLoader.downloadProgresses.get(activeModelFilename)}%` : ''}
      </div>` : ''}
      <div class="chat-input-container">
        <div class="input-wrapper">
          <textarea id="chat-input" aria-label="Ask a question" rows="1"
            .value=${live(this.draft)}
            placeholder=${isLoading ? 'Preparing…' : 'Ask a question…'}
            ?disabled=${this.documentLoading || isLoading || this.state.chatSession.isSummarizing || this.state.chatSession.isRestoring || this.state.chatSession.missingDocument}
            @input=${this.handleInputHeight} @keydown=${this.handleKeyDown}></textarea>
          <div class="composer-actions">
            ${this.state.chatSession.isGenerating ? html`<button class="btn btn-stop composer-button" @click=${() => this.state.chatSession.cancelGeneration()}>Stop</button>` : html`
              <button id="btn-send" class="btn btn-primary composer-button"
                ?disabled=${(isModelLoaded && !hasDraft) || this.documentLoading || isLoading || this.state.chatSession.isSummarizing || this.state.chatSession.isRestoring || this.state.chatSession.missingDocument}
                @click=${this.triggerSendMessage}>${isLoading ? 'Loading…' : !isModelLoaded ? hasDraft ? 'Load model and send' : 'Load model' : 'Send'} <span aria-hidden="true">↑</span></button>`}
          </div>
        </div>
        <p class="composer-help">Check answers against the source. Shift + Enter for a new line.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'document-chat-window': DocumentChatWindow;
  }
}
