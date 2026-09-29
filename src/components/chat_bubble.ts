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

import './code_block';

import {html, nothing, svg, LitElement} from 'lit';
import {customElement, property, state as localState} from 'lit/decorators.js';
import {marked, type Tokens} from 'marked';

import {LlmChatStateController, type StoredMessage} from '../state_controller.js';
import {sharedStyles} from '../styles/shared_styles.js';
import {replyStyles} from '../styles/reply_styles.js';
import {citationMarkdown} from '../services/citation_service.js';

import {getLanguage, highlight, highlightAuto, hljsStyles} from './hljs_util.js';
import {katexStyles, renderHtml} from './util.js';
import * as katex from 'katex';

const MATH_START = 'DocumentQaMathStart';
const MATH_END = 'DocumentQaMathEnd';
const MATH_RESTORE_RE = /DocumentQaMathStart(\d+)DocumentQaMathEnd/g;



marked.use({
  renderer: {
    code(token: Tokens.Code) {
      const originalCode = token.text;
      // Extract first word of the lang string (e.g., "python info" -> "python")
      let language = (token.lang || '').match(/\S*/)?.[0]?.toLowerCase() || '';
      let highlightedCode: string;

      try {
        if (language && getLanguage(language)) {
          highlightedCode = highlight(originalCode, language);
        } else {
          const result = highlightAuto(originalCode);
          highlightedCode = result.value;
          if (!language && result.language) {
            language = result.language;
          }
        }
      } catch (e) {
        highlightedCode = originalCode.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');
      }

      if (!language) {
        language = 'code';
      }

      language = language.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const bytes = new TextEncoder().encode(originalCode);
      const base64Code =
          btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
      return `<document-code-block base-64-code="${base64Code}" language="${
          language}">
<pre class="code-content-pre"><code class="hljs language-${language}">${
          highlightedCode}</code></pre>
</document-code-block>`;
    }
  }
});

/* tslint:disable:no-new-decorators */

/** Component representing a single chat message bubble. */
@customElement('document-chat-bubble')
export class DocumentChatBubble extends LitElement {
  @property({ type: Object })
  message!: StoredMessage;

  @property({ type: Number })
  index!: number;

  @property({ type: Object })
  state!: LlmChatStateController;

  @property({type: Boolean})
  busy?: boolean;

  @localState() private copyStatus: 'idle' | 'copied' | 'failed' = 'idle';
  @localState() private detailsOpen = false;
  private copyTimer?: ReturnType<typeof setTimeout>;

  static override styles = [sharedStyles, hljsStyles, katexStyles, replyStyles];

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.copyTimer);
  }

  private renderMath(latex: string, displayMode: boolean): string {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: 'html',
      });
    } catch (e) {
      console.error('[Doc Q&A] Failed to render math:', e);
      return `<code>${latex}</code>`;
    }
  }

  private renderMarkdown(text: string): string {
    // Note: This is called in the render function for each token we receive
    // from the model.
    // It's not efficient to re-render the entire markdown from scratch for
    // each token, but it's fast enough for now.
    // A better solution would incrementally render new chunks of the markdown.
    if (!text) return '';
    text = citationMarkdown(text, this.message.citations || []);

    const mathStore: string[] = [];

    // Split by code blocks and inline code to avoid processing math inside them
    const codePattern = /(```[\s\S]*?```|`[^`]*`)/g;
    const parts = text.split(codePattern);

    const processedParts = parts.map((part, i) => {
      // Odd indices are code blocks/inline code - leave them alone
      if (i % 2 === 1) return part;

      // Even indices are regular text - process math
      // 1. Extract and render display math: $$...$$
      let processed = part.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
        const idx = mathStore.length;
        mathStore.push(this.renderMath(tex.trim(), true));
        return `${MATH_START}${idx}${MATH_END}`;
      });

      // 2. Extract and render inline math: $...$
      processed = processed.replace(/\$([^\s$](?:[^$]*[^\s$])?)\$/g, (_, tex: string) => {
        const idx = mathStore.length;
        mathStore.push(this.renderMath(tex.trim(), false));
        return `${MATH_START}${idx}${MATH_END}`;
      });

      return processed;
    });

    const processedText = processedParts.join('');

    try {
      let htmlResult = marked.parse(processedText, {async: false}) as string;

      // 3. Restore rendered math blocks
      htmlResult = htmlResult.replace(MATH_RESTORE_RE, (_, idx: string) => {
        return mathStore[Number(idx)] || '';
      });

      return htmlResult;
    } catch (e) {
      console.error('[Doc Q&A] Failed to parse markdown:', e);
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  }

  private async handleCopyMessage() {
    clearTimeout(this.copyTimer);
    try {
      await navigator.clipboard.writeText(this.message.text);
      this.copyStatus = 'copied';
    } catch (error) {
      this.copyStatus = 'failed';
      console.error('[Doc Q&A] Failed to copy message:', error);
    }
    if (this.isConnected) this.copyTimer = setTimeout(() => this.copyStatus = 'idle', 2000);
  }

  private handleSourceClick(event: MouseEvent) {
    const link = (event.target as Element).closest('a[href^="#source-"]');
    if (!link) return;
    event.preventDefault();
    this.openSource(link.getAttribute('href')!.slice('#source-'.length));
  }

  private openSource(id: string) {
    const citation = this.message.citations?.find(item => item.id === id);
    if (citation) this.dispatchEvent(new CustomEvent('source-selected', {detail: citation, bubbles: true, composed: true}));
  }

  private async handleRewindEdit() {
    const originalPrompt =
        await this.state.chatSession.rewindAndEdit(this.index);
    if (originalPrompt) {
      this.dispatchEvent(new CustomEvent('edit-prompt', {
        detail: {prompt: originalPrompt},
        bubbles: true,
        composed: true,
      }));
    }
  }

  private icon(name: 'copy' | 'check' | 'retry' | 'edit' | 'chevron' | 'info' | 'file') {
    const paths = {
      copy: svg`<rect x="8" y="8" width="11" height="12" rx="2"></rect><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"></path>`,
      check: svg`<path d="m5 12 4 4L19 6"></path>`,
      retry: svg`<path d="M3 12a9 9 0 0 1 15.5-6.5L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.5L3 16M3 21v-5h5"></path>`,
      edit: svg`<path d="m15 4 5 5M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"></path>`,
      chevron: svg`<path d="m8 5 7 7-7 7"></path>`,
      info: svg`<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>`,
      file: svg`<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"></path>`,
    };
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  }

  private senderLabel() {
    const sender = (this.message.senderName || 'Assistant')
      .replace(/,?\s*\(?\d+(?:\.\d+)?\s*GB\)$/, '')
      .replace(/\.(?:litertlm|bin|gguf)$/i, '');
    const gemma = sender.match(/gemma[-_ ]*(\d+)[-_ ]*([eE]?\d+[bB])/i);
    return gemma ? `Gemma ${gemma[1]} ${gemma[2].toUpperCase()}` : sender;
  }

  private actionButton(label: string, icon: Parameters<DocumentChatBubble['icon']>[0], action: () => void,
      {disabled = false, expanded, className = ''}: {disabled?: boolean; expanded?: boolean; className?: string} = {}) {
    return html`<span class="action-control">
      <button type="button" class="btn-action ${className}" aria-label=${label}
        aria-expanded=${expanded === undefined ? nothing : String(expanded)}
        aria-controls=${expanded === undefined ? nothing : 'response-details'}
        ?disabled=${disabled} @click=${action}>${this.icon(icon)}</button>
      <span class="action-tooltip" role="tooltip">${label}</span>
    </span>`;
  }

  override render() {
    const msg = this.message;
    if (!msg || !this.state) return html``;
    const isUser = msg.role === 'user';
    const chat = this.state.chatSession;
    const streaming = !isUser && !msg.state && chat.isGenerating && this.index === (chat.messages?.length || 0) - 1;
    const thinking = streaming && !msg.text;
    const busy = this.busy ?? chat.isBusy;
    const status = streaming ? thinking ? 'Thinking' : 'Answering' : msg.state === 'cancelled' ? 'Stopped' :
      msg.state === 'error' ? 'Interrupted' : msg.state === 'complete' ? 'Complete' : 'Response';
    const metrics = [
      {label: 'Input tokens', value: msg.prefillTokensCount},
      {label: 'Output tokens', value: msg.tokensCount},
      {label: 'Prefill', value: msg.prefillSpeed},
      {label: 'Decode', value: msg.decodeSpeed},
      {label: 'First token', value: msg.firstTokenSeconds !== undefined ? `${msg.firstTokenSeconds.toFixed(1)}s` : undefined},
    ].filter(metric => metric.value !== undefined && metric.value !== '');
    const hasScope = !!msg.readingScope && msg.readingScope !== 'Conversation';
    const copyLabel = this.copyStatus === 'copied' ? 'Copied' : this.copyStatus === 'failed' ? 'Copy failed' : 'Copy';

    return html`
      <article class="message-bubble ${msg.role} ${streaming ? 'is-streaming' : ''}" data-raw-text=${msg.text} aria-label=${isUser ? 'Your question' : 'Assistant response'}>
        ${isUser ? nothing : html`
          <header class="response-header">
            <span class="message-sender assistant" title=${msg.senderName}>${this.senderLabel()}</span>
            <span class="response-status ${streaming ? 'live' : msg.state || ''}"><span class="status-dot" aria-hidden="true"></span>${status}</span>
          </header>
          ${streaming ? html`<div class="generation-track" aria-hidden="true"><span></span></div>` : ''}
        `}
        <div class="message-content" @click=${this.handleSourceClick}>
          ${!isUser && (msg.thoughtText || thinking) ? html`
            <details class="thought-details ${thinking ? 'thinking' : ''}">
              <summary class="thought-summary"><span class="reasoning-icon" aria-hidden="true"><i></i><i></i><i></i></span>
                <span>${thinking ? 'Thinking through your question' : 'Reasoning'}</span>
                <span class="reasoning-hint">${thinking ? 'Live' : 'View steps'}</span>${this.icon('chevron')}</summary>
              <div class="thought-content">${msg.thoughtText ? renderHtml(this.renderMarkdown(msg.thoughtText), {codeBlocks: true}) : 'Preparing the context…'}</div>
            </details>` : ''}
          ${isUser ? html`<div class="message-user-text">${msg.text}</div>` : msg.text ? html`
            <div class="reply-prose">${renderHtml(this.renderMarkdown(msg.text), {codeBlocks: true})}</div>` : streaming ? html`
              <div class="answer-placeholder" role="status"><span>Preparing an answer…</span>
                <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>` : ''}
        </div>
        ${!isUser && (hasScope || msg.citations?.length) ? html`
          <div class="evidence-section">
            <div class="evidence-heading"><span>${this.icon('file')}${msg.citations?.length ? 'Sources' : 'Reading scope'}</span>
              ${hasScope ? html`<span class="reading-scope" title=${msg.readingScope}>${msg.readingScope}</span>` : ''}</div>
            ${msg.citations?.length ? html`<div class="source-citations" role="group" aria-label="Sources">
              ${msg.citations.map(citation => html`<button type="button" class="source-citation" title=${citation.excerpt} @click=${() => this.openSource(citation.id)}>
                <span class="source-citation-id">${citation.id}</span><span class="source-citation-label">${citation.label}</span>${this.icon('chevron')}</button>`)}
            </div>` : ''}
          </div>` : ''}
        ${msg.invalidCitations?.length ? html`<p class="response-notice error">Unrecognized references: ${msg.invalidCitations.join(', ')}</p>` : ''}
        ${!isUser && msg.state === 'complete' && hasScope && chat.currentDoc && !msg.citations?.length
          ? html`<p class="response-notice">No source references were provided. Check this answer against the document.</p>` : ''}
        <footer class="message-actions ${isUser ? 'user-actions' : ''}" aria-label="Message actions">
          ${isUser ? html`
            ${this.actionButton('Edit', 'edit', () => this.handleRewindEdit(), {disabled: busy})}
            ${this.actionButton(copyLabel, this.copyStatus === 'copied' ? 'check' : 'copy', () => this.handleCopyMessage(), {disabled: !msg.text, className: this.copyStatus})}` : html`
            ${this.actionButton(copyLabel, this.copyStatus === 'copied' ? 'check' : 'copy', () => this.handleCopyMessage(), {disabled: !msg.text, className: this.copyStatus})}
            ${this.actionButton('Regenerate', 'retry', () => chat.redoResponse(this.index), {disabled: busy})}
            ${this.actionButton('Response details', 'info', () => {this.detailsOpen = !this.detailsOpen;}, {expanded: this.detailsOpen, className: this.detailsOpen ? 'active' : ''})}
          `}
          <span class="sr-only" role="status">${this.copyStatus === 'idle' ? '' : copyLabel}</span>
        </footer>
        ${!isUser ? html`<section id="response-details" class="response-details-panel" aria-label="Response details" ?hidden=${!this.detailsOpen}>
          <h4>Response details</h4>
          ${metrics.length ? html`<dl class="message-stats">${metrics.map(metric => html`<div><dt>${metric.label}</dt><dd>${metric.value}</dd></div>`)}</dl>` :
            html`<p>${streaming ? 'Performance data will appear here when available.' : 'Performance data is unavailable for this response.'}</p>`}
        </section>` : ''}
      </article>`;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'document-chat-bubble': DocumentChatBubble;
  }
}
