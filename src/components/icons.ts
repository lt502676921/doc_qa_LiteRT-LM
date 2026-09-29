import {html} from 'lit';
import {unsafeSVG} from 'lit/directives/unsafe-svg.js';
import {
  AlignLeft, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Brain,
  Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Eye, FileText,
  Info, LoaderCircle, Maximize2, MessageCircle, Minimize2, PanelLeft, Pencil, Plus,
  RotateCcw, SlidersHorizontal, Square, TextSelect, Trash2, X, ZoomIn,
} from 'lucide';

// Named imports keep the bundle limited to the icons used by the interface.
const icons = {
  summary: AlignLeft, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight,
  send: ArrowUp, 'arrow-up-right': ArrowUpRight, reasoning: Brain,
  check: Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, chevron: ChevronRight,
  copy: Copy, download: Download, preview: Eye, file: FileText,
  info: Info, loading: LoaderCircle, message: MessageCircle,
  sidebar: PanelLeft, edit: Pencil, plus: Plus, retry: RotateCcw,
  stop: Square, trash: Trash2, close: X, options: SlidersHorizontal,
  scope: TextSelect, zoom: ZoomIn, maximize: Maximize2, minimize: Minimize2,
};

export type IconName = keyof typeof icons;

// Only trusted geometry from the Lucide dependency is passed to unsafeSVG.
const shapes = Object.fromEntries(Object.entries(icons).map(([name, nodes]) => [name,
  nodes.map(([tag, attributes]) => `<${tag} ${Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value}"`).join(' ')}></${tag}>`).join(''),
])) as Record<IconName, string>;

/** Decorative icon; the surrounding control supplies its accessible name. */
export function icon(name: IconName, size = 16, className = '') {
  return html`<svg class=${`lucide lucide-${name} ${className}`} width=${size} height=${size}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
    style="display:inline-block;vertical-align:middle;flex-shrink:0;pointer-events:none;">
    ${unsafeSVG(shapes[name])}
  </svg>`;
}
