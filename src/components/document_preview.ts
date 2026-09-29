import {css, html, LitElement, unsafeCSS, type PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer} from 'pdfjs-dist';
import pdfViewerStyles from 'pdfjs-dist/web/pdf_viewer.css?inline';
import type {DocumentBlock, ParsedDocument} from '../services/document_service.js';
import {renderHtml} from './util.js';

/** The original file is rendered independently of the text supplied to the LLM. */
@customElement('document-preview')
export class DocumentPreview extends LitElement {
  @property({attribute: false}) document: ParsedDocument | null = null;
  @property({attribute: false}) scope: string | null = null;
  @property({type: Boolean}) busy = false;
  @state() private mode: 'original' | 'text' = 'original';
  @state() private pageNumber = 1;
  @state() private pageCount = 0;
  @state() private zoom = 0; // 0 means fit width.
  @state() private loading = false;
  @state() private error = '';
  @state() private activeSource = '';
  @state() private locationMessage = '';
  private pdf?: PDFDocumentProxy;
  private loadingTask?: PDFDocumentLoadingTask;
  private renderTask?: RenderTask;
  private textLayer?: TextLayer;
  private loadEpoch = 0;
  private renderEpoch = 0;
  private ready: Promise<void> = Promise.resolve();
  private renderQueue: Promise<void> = Promise.resolve();
  private resizeObserver?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setTimeout>;
  private lastWidth = 0;
  @state() private downloadUrl = '';

  static override styles = [unsafeCSS(pdfViewerStyles), css`
    :host { display:flex; flex:1; flex-direction:column; min-height:0; min-width:0; overflow:hidden; }
    [hidden] { display:none !important; }
    .toolbar { display:flex; align-items:center; gap:5px; flex-wrap:wrap; padding:10px; border:1px solid var(--line); border-radius:11px 11px 0 0; background:var(--surface); font-size:12px; flex-shrink:0; }
    button, select, input { font:inherit; color:var(--ink); border:1px solid transparent; border-radius:6px; background:var(--surface); padding:6px 7px; min-height:30px; }
    button { cursor:pointer; } button:hover:not(:disabled) { background:var(--bg); }
    button:focus-visible, select:focus-visible, input:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    button:disabled { opacity:.4; cursor:default; }
    button[aria-pressed="true"] { color:var(--accent); background:var(--accent-soft); }
    .view-switch { display:flex; padding:2px; background:var(--bg); border-radius:7px; }
    .view-switch button { font-size:11px; min-height:28px; }
    .page-controls { display:flex; align-items:center; gap:3px; }
    .toolbar-options { margin-left:auto; position:relative; }
    .toolbar-options summary { list-style:none; padding:7px 10px; cursor:pointer; color:var(--ink-muted); border-radius:6px; }
    .toolbar-options summary::-webkit-details-marker { display:none; }
    .toolbar-options summary:hover { background:var(--bg); }
    .options-popover { position:absolute; top:calc(100% + 8px); right:0; width:230px; z-index:10; background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:14px; box-shadow:0 8px 24px #2427241a; display:flex; flex-direction:column; gap:12px; }
    .options-popover label { display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
    .options-popover select { border-color:var(--line); width:100%; }
    label { display:flex; align-items:center; gap:4px; color:var(--ink-muted); } input { width:3rem; padding:5px; text-align:center; border-color:var(--line); }
    a { color:var(--accent); font-size:12px; }
    .notice, .location { margin:0; padding:9px 12px; line-height:1.5; font-size:12px; color:var(--ink-muted); background:var(--surface); border-inline:1px solid var(--line); flex-shrink:0; }
    .location { color:var(--accent); background:var(--accent-soft); display:flex; gap:8px; align-items:center; }
    .location span { flex:1; } .location button { padding:2px 6px; background:transparent; }
    .pdf-scroll { flex:1; min-height:0; overflow:auto; background:#e8ebe5; padding:20px; border:1px solid var(--line); border-top:0; border-radius:0 0 11px 11px; position:relative; }
    @media (max-width:580px) { .toolbar { gap:3px; padding:7px; } .pdf-scroll { padding:10px; } .page-controls { gap:0; } .view-switch button { padding:6px; } .toolbar-options summary { padding:7px; } }
    @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
    .pdf-page { position:relative; margin:0 auto; background:white; box-shadow:0 3px 16px #0002;
      flex-shrink:0; color-scheme:light; }
    canvas { display:block; }
    .textLayer { z-index:1; }
    .highlight-layer { position:absolute; inset:0; pointer-events:none; z-index:2; }
    .source-highlight { position:absolute; background:rgba(242,191,64,.3); outline:1px solid rgba(185,135,32,.25);
      border-radius:2px; mix-blend-mode:multiply; scroll-margin:50px; }
    .loading { position:sticky; top:0; z-index:4; margin:0; padding:.6rem; background:var(--page); color:var(--accent); font-size:.8rem; }
    .error { margin:0; padding:.8rem; color:#a33e30; background:var(--page); font-size:.8rem; }
    .text-scroll { flex:1; min-height:0; overflow:auto; padding:20px; border:1px solid var(--line); background:#e8ebe5; border-radius:0 0 11px 11px; }
    article { max-width:48rem; margin:0 auto; padding:2rem; background:var(--page); font-family:var(--font-serif); font-size:1.05rem; line-height:1.7; overflow-wrap:anywhere; }
    .source-block { padding:.6rem .7rem; margin-bottom:.6rem; border-left:3px solid transparent; border-radius:5px; scroll-margin:25px; }
    .source-block > small { font-size:.65rem; color:var(--accent); }
    .source-block.highlighted { background:var(--accent-soft); border-left-color:var(--accent); }
    article table { border-collapse:collapse; } article td, article th { border:1px solid var(--line); padding:.4rem; }
  `];

  private get hasOriginalPdf() {return this.document?.extension === 'pdf' && !!this.document.originalFile;}

  override firstUpdated() {
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width || 0;
      if (Math.abs(width - this.lastWidth) < 2) return;
      this.lastWidth = width;
      if (!this.pdf || this.zoom || this.mode !== 'original') return;
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {void this.queueRender();}, 120);
    });
    this.resizeObserver.observe(this);
  }

  override willUpdate(changes: PropertyValues<this>) {
    if (changes.has('document')) this.ready = this.loadDocument();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeTimer);
    this.releaseDocument();
  }

  private releaseDocument() {
    this.loadEpoch++; this.renderEpoch++;
    this.renderTask?.cancel(); this.textLayer?.cancel();
    if (this.loadingTask) void this.loadingTask.destroy().catch(() => {});
    this.loadingTask = undefined; this.pdf = undefined;
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    this.downloadUrl = '';
  }

  private async loadDocument() {
    this.releaseDocument();
    const epoch = this.loadEpoch, document = this.document;
    this.pageNumber = 1; this.pageCount = 0; this.zoom = 0;
    this.activeSource = ''; this.locationMessage = ''; this.error = ''; this.loading = false;
    this.mode = this.hasOriginalPdf ? 'original' : 'text';
    if (document?.originalFile) this.downloadUrl = URL.createObjectURL(document.originalFile);
    if (!this.hasOriginalPdf) return;
    this.loading = true;
    try {
      const [pdfjs, buffer] = await Promise.all([import('pdfjs-dist'), document!.originalFile!.arrayBuffer()]);
      if (epoch !== this.loadEpoch) return;
      const base = import.meta.env.BASE_URL;
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}workers/pdf.worker.min.mjs`;
      this.loadingTask = pdfjs.getDocument({data: new Uint8Array(buffer),
        cMapUrl: `${base}pdf-assets/cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${base}pdf-assets/standard_fonts/`, wasmUrl: `${base}pdf-assets/wasm/`});
      const pdf = await this.loadingTask.promise;
      if (epoch !== this.loadEpoch) return;
      this.pdf = pdf; this.pageCount = pdf.numPages;
      await this.updateComplete;
      await this.queueRender();
    } catch (error) {
      if (epoch === this.loadEpoch) this.error = `Unable to display the original PDF: ${(error as Error).message}`;
    } finally {
      if (epoch === this.loadEpoch) this.loading = false;
    }
  }

  /** Serialized rendering avoids reusing a canvas while its old render is still running. */
  private queueRender(scrollToSource = false): Promise<void> {
    const generation = ++this.renderEpoch;
    this.renderTask?.cancel(); this.textLayer?.cancel();
    const work = this.renderQueue.catch(() => {}).then(async () => {
      if (generation !== this.renderEpoch || !this.pdf || this.mode !== 'original') return;
      try {await this.renderPage(generation, scrollToSource);}
      catch (error) {
        if (generation === this.renderEpoch && (error as Error).name !== 'RenderingCancelledException')
          this.error = `Unable to render this page: ${(error as Error).message}`;
      }
    });
    this.renderQueue = work;
    return work;
  }

  private async renderPage(generation: number, scrollToSource: boolean) {
    const page = await this.pdf!.getPage(this.pageNumber);
    if (generation !== this.renderEpoch) return;
    const scroll = this.renderRoot.querySelector<HTMLElement>('.pdf-scroll')!;
    const stage = this.renderRoot.querySelector<HTMLElement>('.pdf-page')!;
    const canvas = stage.querySelector('canvas')!;
    const textContainer = stage.querySelector<HTMLElement>('.textLayer')!;
    const original = page.getViewport({scale: 1});
    const scale = this.zoom || Math.max(.2, (scroll.clientWidth - 30) / original.width);
    const viewport = page.getViewport({scale});
    // Cap backing pixels to keep unusually large pages from exhausting browser memory.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(viewport.width, viewport.height),
      Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
    stage.style.width = `${viewport.width}px`; stage.style.height = `${viewport.height}px`;
    stage.style.setProperty('--scale-factor', String(scale));
    stage.style.setProperty('--total-scale-factor', String(scale));
    canvas.width = Math.ceil(viewport.width * pixelRatio); canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    textContainer.replaceChildren();
    stage.querySelector('.highlight-layer')!.replaceChildren();
    this.error = '';
    const pdfjs = await import('pdfjs-dist');
    if (generation !== this.renderEpoch) return;
    this.renderTask = page.render({canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]});
    await this.renderTask.promise;
    if (generation !== this.renderEpoch) return;
    const content = await page.getTextContent();
    if (generation !== this.renderEpoch) return;
    this.textLayer = new pdfjs.TextLayer({textContentSource: content, container: textContainer, viewport});
    await this.textLayer.render();
    if (generation !== this.renderEpoch) return;
    this.drawSource(scrollToSource);
    this.dispatchEvent(new CustomEvent('page-rendered', {detail: {page: this.pageNumber}, bubbles: true, composed: true}));
  }

  private drawSource(scrollToSource: boolean) {
    const stage = this.renderRoot.querySelector<HTMLElement>('.pdf-page')!;
    const layer = stage.querySelector<HTMLElement>('.highlight-layer')!;
    layer.replaceChildren();
    const block = this.document?.blocks.find(block => block.id === this.activeSource);
    if (!block || block.page !== this.pageNumber) return;
    for (const region of block.regions || []) {
      const highlight = window.document.createElement('div');
      highlight.className = 'source-highlight'; highlight.dataset.sourceId = block.id;
      highlight.style.left = `${region.x * 100}%`; highlight.style.top = `${region.y * 100}%`;
      highlight.style.width = `${region.width * 100}%`; highlight.style.height = `${region.height * 100}%`;
      layer.appendChild(highlight);
    }
    this.locationMessage = layer.children.length ? `${block.id} · ${block.label} · highlighted in the original document`
      : `${block.id} · ${block.label} · page located; exact highlight coordinates are unavailable`;
    if (scrollToSource) {
      layer.firstElementChild?.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
      this.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }
  }

  async revealSource(id: string): Promise<void> {
    const document = this.document;
    const block = document?.blocks.find(block => block.id === id);
    if (!block) return;
    await this.ready;
    if (document !== this.document) return;
    this.activeSource = id;
    if (this.pdf && this.hasOriginalPdf && block.page) {
      this.mode = 'original'; this.pageNumber = block.page;
      await this.updateComplete;
      await this.queueRender(true);
    } else {
      this.mode = 'text'; await this.updateComplete;
      this.highlightText(block);
    }
  }

  private highlightText(block: DocumentBlock) {
    this.renderRoot.querySelectorAll('.source-block.highlighted').forEach(element => element.classList.remove('highlighted'));
    const target = this.renderRoot.querySelector(`#source-${block.id}`);
    target?.classList.add('highlighted'); target?.scrollIntoView({behavior: 'smooth', block: 'center'});
    this.locationMessage = `${block.id} · ${block.label} · located in extracted text`;
  }

  private async showPage(value: number) {
    if (!Number.isFinite(value) || !this.pageCount) return;
    this.pageNumber = Math.max(1, Math.min(this.pageCount, Math.trunc(value)));
    this.activeSource = ''; this.locationMessage = '';
    await this.updateComplete;
    const scroll = this.renderRoot.querySelector<HTMLElement>('.pdf-scroll');
    if (scroll) scroll.scrollTop = 0;
    await this.queueRender();
  }

  private async setMode(mode: 'original' | 'text') {
    this.mode = mode; await this.updateComplete;
    if (mode === 'original') await this.queueRender(!!this.activeSource);
    else {
      const block = this.document?.blocks.find(block => block.id === this.activeSource);
      if (block) this.highlightText(block);
    }
  }

  private clearHighlight() {
    this.activeSource = ''; this.locationMessage = '';
    this.renderRoot.querySelector('.highlight-layer')?.replaceChildren();
    this.renderRoot.querySelectorAll('.source-block.highlighted').forEach(element => element.classList.remove('highlighted'));
  }

  override render() {
    const document = this.document;
    return html`
      <div class="toolbar" aria-label="Document viewer controls">
        ${this.hasOriginalPdf ? html`
          <div class="view-switch"><button aria-pressed=${this.mode === 'original'} @click=${() => this.setMode('original')}>Original PDF</button>
          <button aria-pressed=${this.mode === 'text'} @click=${() => this.setMode('text')}>Text</button></div>
        ` : html`<strong>${document?.extension === 'pdf' ? 'Original file unavailable' : 'Text preview'}</strong>`}
        ${this.mode === 'original' ? html`
          <div class="page-controls"><button aria-label="Previous page" ?disabled=${this.pageNumber <= 1 || !this.pageCount} @click=${() => this.showPage(this.pageNumber - 1)}>←</button>
          <label>Page <input aria-label="PDF page number" type="number" min="1" max=${this.pageCount || 1}
            .value=${String(this.pageNumber)} ?disabled=${!this.pageCount}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const input = event.target as HTMLInputElement;
                void this.showPage(input.valueAsNumber); input.value = String(this.pageNumber);
              }
            }}
            @change=${(event: Event) => {
              const input = event.target as HTMLInputElement;
              void this.showPage(input.valueAsNumber); input.value = String(this.pageNumber);
            }}> / ${this.pageCount || '…'}</label>
          <button aria-label="Next page" ?disabled=${this.pageNumber >= this.pageCount} @click=${() => this.showPage(this.pageNumber + 1)}>→</button>
          </div>` : ''}
        <details class="toolbar-options"><summary aria-label="Reading options">Options <span aria-hidden="true">⌄</span></summary>
          <div class="options-popover">
            <label>Answer using<select aria-label="Reading range" .value=${this.scope || ''} ?disabled=${this.busy}
              @change=${(event: Event) => this.dispatchEvent(new CustomEvent('scope-changed', {detail:(event.target as HTMLSelectElement).value || null, bubbles:true, composed:true}))}>
              <option value="">All readable text</option>${document?.units.map(unit => html`<option value=${unit.id}>${unit.label}</option>`)}</select></label>
            ${this.mode === 'original' ? html`<label>Zoom<select aria-label="PDF zoom" .value=${String(this.zoom)} @change=${async (event: Event) => {
              this.zoom = Number((event.target as HTMLSelectElement).value); await this.updateComplete; await this.queueRender(!!this.activeSource);
            }}><option value="0">Fit width</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>` : ''}
            ${this.downloadUrl ? html`<a href=${this.downloadUrl} download=${document?.name}>Download original ↗</a>` : ''}
          </div>
        </details>
      </div>
      ${!this.hasOriginalPdf ? html`<p class="notice">${document?.extension === 'pdf'
        ? 'This saved document predates original-file storage. Upload the same PDF again to restore its layout.'
        : ['docx', 'xlsx', 'pptx'].includes(document?.extension || '')
        ? 'This format uses an extracted text preview. Export it as PDF for original layout, physical pages and page highlights.'
        : 'Text preview · citations locate the corresponding source paragraph.'}</p>` : ''}
      ${this.locationMessage ? html`<div class="location" role="status"><span>${this.locationMessage}</span>
        <button aria-label="Clear source highlight" @click=${this.clearHighlight}>×</button></div>` : ''}
      <div class="pdf-scroll" ?hidden=${this.mode !== 'original'}>
        ${this.loading ? html`<p class="loading" role="status">Loading original PDF…</p>` : ''}
        ${this.error ? html`<p class="error" role="alert">${this.error} Switch to Text to continue reading.</p>` : ''}
        <div class="pdf-page" role="region" aria-label=${`Original PDF page ${this.pageNumber}`}>
          <canvas aria-label=${`PDF page ${this.pageNumber}`}></canvas>
          <div class="textLayer"></div><div class="highlight-layer" aria-hidden="true"></div>
        </div>
      </div>
      <div class="text-scroll" ?hidden=${this.mode !== 'text'}><article>${document ? renderHtml(document.html) : ''}</article></div>
    `;
  }
}

declare global {interface HTMLElementTagNameMap {'document-preview': DocumentPreview;}}
