import {css, html, LitElement, unsafeCSS, type PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer} from 'pdfjs-dist';
import pdfViewerStyles from 'pdfjs-dist/web/pdf_viewer.css?inline';
import {sourceLocation, type DocumentBlock, type ParsedDocument} from '../services/document_service.js';
import {renderHtml} from './util.js';
import {icon} from './icons.js';

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
  @state() private fullscreen = false;
  private windowedZoom = 0;
  private layoutEpoch = 0;
  private pendingScrollPosition?: {mode: 'original' | 'text'; page: number; top: number; left: number};
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
    button { cursor:pointer; display:inline-flex; align-items:center; justify-content:center; } button:hover:not(:disabled) { background:var(--bg); }
    button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible, a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    button:disabled { opacity:.4; cursor:default; }
    .view-switch { display:flex; padding:2px; background:var(--bg); border-radius:7px; }
    .view-switch button { font-size:11px; min-height:28px; background:transparent; color:var(--ink-muted); }
    .view-switch button[aria-pressed="true"] { background:var(--surface); color:var(--accent); box-shadow:0 1px 3px #24272410; font-weight:600; }
    .page-controls { display:flex; align-items:center; gap:4px; margin-left:4px; font-variant-numeric:tabular-nums; }
    .page-controls .page-nav { box-sizing:border-box; width:28px; height:28px; min-height:28px; padding:0; color:#59665e; border-radius:6px; }
    .page-controls .page-nav:hover:not(:disabled) { color:var(--accent); background:var(--accent-soft); }
    .page-controls .page-nav:disabled { opacity:.35; }
    .page-controls label { gap:5px; font-size:12px; line-height:1; }
    .page-controls input { appearance:textfield; -moz-appearance:textfield; box-sizing:border-box; width:32px; height:28px; min-height:28px; padding:0 3px; background:#fafbf9; font-size:12px; font-variant-numeric:tabular-nums; line-height:normal; }
    .page-controls input::-webkit-inner-spin-button, .page-controls input::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
    .page-controls input:hover:not(:disabled) { border-color:#b6cabe; }
    .page-total { white-space:nowrap; color:var(--ink-muted); }
    @media (pointer:coarse) { .page-controls .page-nav { width:40px; height:40px; min-height:40px; } .page-controls input { width:36px; height:36px; min-height:36px; } }
    .toolbar-options { margin-left:auto; position:relative; }
    .fullscreen-toggle { width:32px; min-height:32px; padding:0; color:var(--ink-muted); flex-shrink:0; }
    .fullscreen-toggle[aria-pressed="true"] { background:var(--accent-soft); color:var(--accent); }
    .toolbar-options > summary { display:flex; align-items:center; gap:6px; box-sizing:border-box; min-height:32px; line-height:1; list-style:none; padding:7px 9px; cursor:pointer; color:var(--ink-muted); border:1px solid transparent; border-radius:7px; transition:background .15s,color .15s,border-color .15s; }
    .toolbar-options > summary::-webkit-details-marker { display:none; }
    .toolbar-options > summary:hover { background:var(--bg); color:var(--ink); }
    .toolbar-options[open] > summary { color:var(--accent); background:var(--accent-soft); border-color:#d6e5dc; }
    .options-chevron { width:12px; height:12px; flex-shrink:0; transition:transform .15s; }
    .toolbar-options[open] .options-chevron { transform:rotate(180deg); }
    .options-popover { position:absolute; top:calc(100% + 9px); right:0; box-sizing:border-box; width:272px; max-width:calc(100vw - 48px); z-index:10; background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:0 12px 32px #243d3214,0 2px 6px #243d3208; overflow:hidden; }
    .options-title { margin:0; padding:14px 16px 0; color:var(--ink); font-size:13px; line-height:1.4; font-weight:600; }
    .options-fields { display:flex; flex-direction:column; gap:16px; padding:14px 16px 16px; }
    .options-popover .option-field { display:flex; flex-direction:column; align-items:stretch; gap:7px; }
    .option-label { display:flex; align-items:center; gap:7px; color:var(--ink-muted); font-size:12px; line-height:1.4; font-weight:500; }
    .option-label svg { color:#83958a; }
    .option-select { display:block; position:relative; }
    .option-select select { appearance:none; -webkit-appearance:none; box-sizing:border-box; display:block; width:100%; min-height:40px; padding:9px 36px 9px 12px; border:1px solid var(--line); border-radius:8px; background:#f8faf7; color:var(--ink); font:inherit; font-size:13px; line-height:1.4; cursor:pointer; text-overflow:ellipsis; transition:border-color .15s,background .15s,box-shadow .15s; }
    .option-select select:hover:not(:disabled) { border-color:#b6cabe; background:var(--surface); }
    .option-select select:focus-visible { outline:2px solid var(--accent); outline-offset:2px; background:var(--surface); }
    .option-select select:disabled { opacity:.5; cursor:default; }
    .option-select > svg { position:absolute; right:12px; top:50%; transform:translateY(-50%); color:var(--ink-muted); }
    .option-select select:disabled + svg { opacity:.5; }
    .options-footer { border-top:1px solid var(--line); padding:8px; background:#fafbf9; }
    .download-action { display:flex; align-items:center; gap:9px; min-height:40px; box-sizing:border-box; padding:9px 8px; border-radius:7px; color:var(--accent); text-decoration:none; font-size:13px; line-height:1.4; font-weight:500; transition:background .15s; }
    .download-action:hover { background:var(--accent-soft); }
    .download-label { flex:1; }
    .download-format { padding:2px 5px; border:1px solid var(--line); border-radius:4px; color:var(--ink-muted); font-size:10px; line-height:1.4; letter-spacing:.03em; font-weight:600; }
    label { display:flex; align-items:center; gap:4px; color:var(--ink-muted); } input { width:3rem; padding:5px; text-align:center; border-color:var(--line); }
    a { color:var(--accent); font-size:12px; }
    .notice, .location { margin:0; padding:9px 12px; line-height:1.5; font-size:12px; color:var(--ink-muted); background:var(--surface); border-inline:1px solid var(--line); flex-shrink:0; }
    .location { color:var(--accent); background:var(--accent-soft); display:flex; gap:8px; align-items:center; }
    .location span { flex:1; } .location button { padding:2px 6px; background:transparent; }
    .pdf-scroll { flex:1; min-height:0; overflow:auto; scrollbar-gutter:stable; background:#e8ebe5; padding:20px; border:1px solid var(--line); border-top:0; border-radius:0 0 11px 11px; position:relative; }
    @media (max-width:580px) { .toolbar { gap:3px; padding:7px; } .pdf-scroll { padding:10px; } .page-controls { margin-left:0; } .view-switch button { padding:6px; } .toolbar-options summary { padding:7px; } }
    @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
    .pdf-page { position:relative; margin:0 auto; overflow:hidden; background:white; box-shadow:0 3px 16px #0002;
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

  override connectedCallback() {
    super.connectedCallback();
    window.document.addEventListener('keydown', this.handleFullscreenKey);
  }

  private handleFullscreenKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.fullscreen && !event.isComposing) {
      event.preventDefault();
      void this.setFullscreen(false);
    }
  };

  private notifyFullscreen() {
    this.dispatchEvent(new CustomEvent('fullscreen-changed', {
      detail: this.fullscreen, bubbles: true, composed: true,
    }));
  }

  private async setFullscreen(fullscreen: boolean) {
    if (this.fullscreen === fullscreen) return;
    const epoch = ++this.layoutEpoch;
    const scroll = this.renderRoot.querySelector<HTMLElement>(this.mode === 'original' ? '.pdf-scroll' : '.text-scroll')!;
    const stage = this.renderRoot.querySelector<HTMLElement>('.pdf-page')!;
    this.pendingScrollPosition = {mode: this.mode, page: this.pageNumber,
      top: this.mode === 'original' ? (scroll.scrollTop - stage.offsetTop) / Math.max(1, stage.clientHeight)
        : scroll.scrollTop / Math.max(1, scroll.scrollHeight),
      left: this.mode === 'original' ? (scroll.scrollLeft - stage.offsetLeft) / Math.max(1, stage.clientWidth) : 0};
    if (fullscreen) {this.windowedZoom = this.zoom; this.zoom = 0;}
    else this.zoom = this.windowedZoom;
    this.fullscreen = fullscreen;
    this.renderRoot.querySelector<HTMLDetailsElement>('.toolbar-options')!.open = false;
    this.notifyFullscreen();
    await this.updateComplete;
    // Let the parent apply the expanded layout before measuring the viewer.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!this.isConnected || epoch !== this.layoutEpoch) return;
    clearTimeout(this.resizeTimer);
    this.renderRoot.querySelector<HTMLButtonElement>('.fullscreen-toggle')?.focus({preventScroll: true});
    if (this.mode === 'original') await this.queueRender();
    else {
      const position = this.pendingScrollPosition;
      if (position?.mode === 'text') scroll.scrollTop = position.top * scroll.scrollHeight;
      this.pendingScrollPosition = undefined;
    }
  }

  override firstUpdated() {
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width || 0;
      if (Math.abs(width - this.lastWidth) < 2) return;
      this.lastWidth = width;
      if (!this.pdf || this.zoom || this.mode !== 'original') return;
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {void this.queueRender();}, 120);
    });
    // The scroll area's content width also changes when a vertical scrollbar appears.
    this.resizeObserver.observe(this.renderRoot.querySelector<HTMLElement>('.pdf-scroll')!);
  }

  override willUpdate(changes: PropertyValues<this>) {
    if (changes.has('document')) this.ready = this.loadDocument();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.document.removeEventListener('keydown', this.handleFullscreenKey);
    this.layoutEpoch++;
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
    this.layoutEpoch++;
    this.pendingScrollPosition = undefined;
    if (this.fullscreen) {this.fullscreen = false; this.notifyFullscreen();}
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
    const scrollStyle = getComputedStyle(scroll);
    const availableWidth = Math.max(1, Math.floor(scroll.clientWidth -
      parseFloat(scrollStyle.paddingLeft) - parseFloat(scrollStyle.paddingRight)));
    const scale = this.zoom || availableWidth / original.width;
    const viewport = page.getViewport({scale});
    // Cap backing pixels to keep unusually large pages from exhausting browser memory.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(viewport.width, viewport.height),
      Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
    stage.style.width = `${viewport.width}px`; stage.style.height = `${viewport.height}px`;
    if (!this.zoom) scroll.scrollLeft = 0;
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
    const position = this.pendingScrollPosition;
    if (position?.mode === 'original' && position.page === this.pageNumber && !scrollToSource) {
      scroll.scrollTop = stage.offsetTop + position.top * viewport.height;
      scroll.scrollLeft = this.zoom ? stage.offsetLeft + position.left * viewport.width : 0;
    }
    this.pendingScrollPosition = undefined;
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
    this.locationMessage = layer.children.length ? `${sourceLocation(block.label)} · source passage highlighted`
      : `${sourceLocation(block.label)} · source page opened; this passage could not be highlighted`;
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
    this.locationMessage = `${sourceLocation(block.label)} · source passage highlighted in text`;
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
          <div class="page-controls" role="group" aria-label="Page navigation"><button class="page-nav" aria-label="Previous page" title="Previous page" ?disabled=${this.pageNumber <= 1 || !this.pageCount} @click=${() => this.showPage(this.pageNumber - 1)}>${icon('chevron-left', 14)}</button>
          <label><input aria-label="PDF page number" type="number" min="1" max=${this.pageCount || 1}
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
            }}><span class="page-total">/ ${this.pageCount || '…'}</span></label>
          <button class="page-nav" aria-label="Next page" title="Next page" ?disabled=${this.pageNumber >= this.pageCount} @click=${() => this.showPage(this.pageNumber + 1)}>${icon('chevron', 14)}</button>
          </div>` : ''}
        <details class="toolbar-options"><summary aria-label="Reading options">${icon('options', 15)}Options ${icon('chevron-down', 12, 'options-chevron')}</summary>
          <div class="options-popover" role="group" aria-labelledby="reading-options-title">
            <h3 class="options-title" id="reading-options-title">Reading options</h3>
            <div class="options-fields">
              <label class="option-field"><span class="option-label">${icon('scope', 14)}Answer using</span>
                <span class="option-select"><select aria-label="Reading range" .value=${this.scope || ''} ?disabled=${this.busy}
                  @change=${(event: Event) => this.dispatchEvent(new CustomEvent('scope-changed', {detail:(event.target as HTMLSelectElement).value || null, bubbles:true, composed:true}))}>
                  <option value="">All readable text</option>${document?.units.map(unit => html`<option value=${unit.id}>${unit.label}</option>`)}</select>${icon('chevron-down', 14)}</span>
              </label>
              ${this.mode === 'original' ? html`<label class="option-field"><span class="option-label">${icon('zoom', 14)}Zoom</span>
                <span class="option-select"><select aria-label="PDF zoom" .value=${String(this.zoom)} @change=${async (event: Event) => {
                  this.zoom = Number((event.target as HTMLSelectElement).value); await this.updateComplete; await this.queueRender(!!this.activeSource);
                }}><option value="0">Fit width</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select>${icon('chevron-down', 14)}</span>
              </label>` : ''}
            </div>
            ${this.downloadUrl ? html`<div class="options-footer"><a class="download-action" href=${this.downloadUrl} download=${document?.name}>
              ${icon('download', 16)}<span class="download-label">Download original</span>
              ${document?.extension ? html`<span class="download-format">${document.extension.toUpperCase()}</span>` : ''}
            </a></div>` : ''}
          </div>
        </details>
        <button type="button" class="fullscreen-toggle" aria-pressed=${this.fullscreen}
          aria-label=${this.fullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
          title=${this.fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen preview'}
          @click=${() => this.setFullscreen(!this.fullscreen)}>${icon(this.fullscreen ? 'minimize' : 'maximize', 16)}</button>
      </div>
      ${!this.hasOriginalPdf ? html`<p class="notice">${document?.extension === 'pdf'
        ? 'This saved document predates original-file storage. Upload the same PDF again to restore its layout.'
        : ['docx', 'xlsx', 'pptx'].includes(document?.extension || '')
        ? 'This format uses an extracted text preview. Export it as PDF for original layout, physical pages and page highlights.'
        : 'Text preview · citations locate the corresponding source paragraph.'}</p>` : ''}
      ${this.locationMessage ? html`<div class="location" role="status"><span>${this.locationMessage}</span>
        <button aria-label="Clear source highlight" @click=${this.clearHighlight}>${icon('close')}</button></div>` : ''}
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
