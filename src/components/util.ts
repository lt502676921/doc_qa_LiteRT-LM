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
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {unsafeCSS} from 'lit';
import katexStylesText from 'katex/dist/katex.min.css?inline';

/** KaTeX styles to be used in Lit components. */
export const katexStyles = unsafeCSS(katexStylesText);


/** Sets the HTML content of an iframe using standard srcdoc. */
export function setIframeHtml(iframe: HTMLIFrameElement, html: string) {
  iframe.srcdoc = html;
}

/** Sets the HTML content of a sandboxed iframe using standard srcdoc and sandbox attribute. */
export function setSandboxIframeHtml(iframe: HTMLIFrameElement, html: string) {
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.srcdoc = html;
}

/** Registers the app service worker using standard navigator.serviceWorker. */
export function registerAppServiceWorker(container: ServiceWorkerContainer): Promise<ServiceWorkerRegistration> {
  return container.register('./sw.js', {scope: './'});
}

/** Treat both uploaded documents and model output as untrusted HTML. */
export function renderHtml(htmlText: string, {codeBlocks = false}: {codeBlocks?: boolean} = {}) {
  const template = document.createElement('template');
  template.innerHTML = htmlText;
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
    'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO',
    'FOREIGNOBJECT', 'ANIMATE', 'ANIMATETRANSFORM', 'ANIMATEMOTION', 'SET', 'USE', 'IMAGE', 'TEMPLATE']);
  for (const element of template.content.querySelectorAll('*')) {
    // Only chat markdown can use this inert, known component. Documents and
    // other custom elements stay blocked; code previews still require a click.
    const isCodeBlock = codeBlocks && element.tagName === 'DOCUMENT-CODE-BLOCK';
    if (blocked.has(element.tagName.toUpperCase()) || (element.tagName.includes('-') && !isCodeBlock)) {element.remove(); continue;}
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if ((isCodeBlock && !['base-64-code', 'language'].includes(name)) ||
          name.startsWith('on') || ['src', 'srcdoc', 'action', 'formaction', 'srcset'].includes(name) ||
          (name === 'style' && /url\s*\(|expression\s*\(|@import/i.test(value)) ||
          (['href', 'xlink:href'].includes(name) && !/^(?:#[\w-]+|https?:\/\/|mailto:)/i.test(value)))
        element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'A') element.setAttribute('rel', 'noopener noreferrer');
  }
  return unsafeHTML(template.innerHTML);
}
