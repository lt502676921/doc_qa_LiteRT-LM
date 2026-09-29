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

import {css, html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';

import {sharedStyles} from '../styles/shared_styles.js';
/* tslint:disable:no-new-decorators */

/** Component for the right sidebar drawer with "Learn More" information. */
@customElement('document-learn-more')
export class DocumentLearnMore extends LitElement {
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
      
      .section-title {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--teal);
        margin: 0 0 12px 0;
        border-bottom: 1px solid var(--border);
        padding-bottom: 8px;
      }
      
      .btn-dismiss-right-drawer {
        display: block;
        background: none;
        border: 1px solid rgba(0, 201, 158, 0.3);
        color: var(--teal);
        border-radius: 4px;
        font-size: 0.68rem;
        font-weight: bold;
        padding: 4px 10px;
        cursor: pointer;
        transition: background-color 0.15s, border-color 0.15s, color 0.15s;
        font-family: inherit;
        outline: none;
      }
      
      .btn-dismiss-right-drawer:hover {
        background-color: rgba(0, 201, 158, 0.08);
        border-color: var(--teal);
        color: var(--text);
      }
      
      a {
        transition: opacity 0.15s;
      }
      
      a:hover {
        opacity: 0.8;
      }
    `
  ];



  private dismissLearnMore() {
    this.dispatchEvent(new CustomEvent('close', {
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    return html`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 class="section-title" style="margin:0;border:none;">About Doc Q&amp;A</h2>
        <button class="btn-dismiss-right-drawer" @click=${this.dismissLearnMore}>Done</button>
      </div>
      <div style="flex:1;overflow-y:auto;line-height:1.6;color:var(--text);">
        <h3>Read and ask</h3>
        <p>Open a document or choose a built-in example, then ask questions about its readable text.</p>
        <h3>Check the sources</h3>
        <p>Use the answer's source references to locate the evidence in your document.
          The reading range shows which parts were available for the answer.</p>
        <h3>Local processing</h3>
        <p>Document parsing and model inference run in your browser. The model must be
          available locally or downloaded before you can generate answers.</p>
        <h3>Reading limits</h3>
        <p>Scanned pages and image details may be unavailable without readable text.
          Long documents may use selected excerpts or a summary in batches.
          Review the original sources when accuracy matters.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'document-learn-more': DocumentLearnMore;
  }
}
