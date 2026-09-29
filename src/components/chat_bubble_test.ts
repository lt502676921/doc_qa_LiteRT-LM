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

import {render} from 'lit';
import {ChatSessionStore} from '../stores/chat_session_store.js';
import {LlmChatStateController} from '../state_controller.js';
import {DocumentChatBubble} from './chat_bubble.js';
import {renderHtml} from './util.js';


describe('document-chat-bubble', () => {
  let element: DocumentChatBubble;
  let mockState: jasmine.SpyObj<LlmChatStateController>;
  let mockChatSession: jasmine.SpyObj<ChatSessionStore>;
  let mockClipboardWriteText: jasmine.Spy;

  beforeEach(async () => {
    // Mock clipboard
    if (!navigator.clipboard) {
      Object.assign(navigator, {
        clipboard: {
          writeText: () => Promise.resolve(),
        },
      });
    }
    mockClipboardWriteText = spyOn(navigator.clipboard, 'writeText')
                                 .and.returnValue(Promise.resolve());

    // Mock LlmChatStateController and its nested chatSession
    mockChatSession = jasmine.createSpyObj('ChatSessionStore', [
      'rewindAndEdit',
      'redoResponse',
    ]);
    mockState = {
      chatSession: mockChatSession,
    } as unknown as jasmine.SpyObj<LlmChatStateController>;

    element = document.createElement('document-chat-bubble');
    element.state = mockState;
    element.message = {role: 'user', text: '', senderName: ''};
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element) {
      element.remove();
    }
  });

  it('renders a user message', async () => {
    element.message = {
      role: 'user',
      text: 'Hello, this is a user message.',
      senderName: 'User',
    };
    element.index = 0;
    await element.updateComplete;

    const bubble = element.shadowRoot!.querySelector('.message-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble!.classList.contains('user')).toBeTrue();

    const sender = element.shadowRoot!.querySelector('.message-sender');
    expect(sender).toBeNull();

    const content = element.shadowRoot!.querySelector('.message-user-text');
    expect(content!.textContent!.trim()).toBe('Hello, this is a user message.');
  });

  it('renders an assistant message with markdown', async () => {
    element.message = {
      role: 'assistant',
      text: 'Hello *world*, this is **bold** and a [link](http://example.com).',
      senderName: 'Assistant (1.2 GB)',
    };
    element.index = 1;
    await element.updateComplete;

    const bubble = element.shadowRoot!.querySelector('.message-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble!.classList.contains('assistant')).toBeTrue();

    // Check sender name is cleaned
    const sender = element.shadowRoot!.querySelector('.message-sender');
    expect(sender!.textContent!.trim()).toBe('Assistant');

    const content = element.shadowRoot!.querySelector('.message-content');
    expect(content).toBeTruthy();

    // Check markdown rendering
    const em = content!.querySelector('em');
    expect(em!.textContent).toBe('world');

    const strong = content!.querySelector('strong');
    expect(strong!.textContent).toBe('bold');

    const link = content!.querySelector('a') as HTMLAnchorElement;
    expect(link!.href).toBe('http://example.com/');
    expect(link!.textContent).toBe('link');
  });

  it('renders thought process CoT blocks', async () => {
    element.message = {
      role: 'assistant',
      text: 'Final answer.',
      thoughtText: 'Thinking about the answer...',
      senderName: 'Assistant',
    };
    element.index = 2;
    await element.updateComplete;

    const details = element.shadowRoot!.querySelector('.thought-details');
    expect(details).toBeTruthy();

    const summary = details!.querySelector('.thought-summary');
    expect(summary!.querySelectorAll('span')[1]!.textContent!.trim()).toBe('Reasoning');
    expect((details as HTMLDetailsElement).open).toBeFalse();
    (summary as HTMLElement).click();
    expect((details as HTMLDetailsElement).open).toBeTrue();

    const thoughtContent = details!.querySelector('.thought-content');
    expect(thoughtContent!.textContent!.trim()).toBe('Thinking about the answer...');
  });

  it('renders code blocks with headers and copy buttons', async () => {
    element.message = {
      role: 'assistant',
      text: 'Here is some code:\n```typescript\nconst x = 5;\n```',
      senderName: 'Assistant',
    };
    element.index = 3;
    await element.updateComplete;

    const block = element.shadowRoot!.querySelector('document-code-block');
    expect(block).toBeTruthy();

    await block!.updateComplete;
    const container = block!.shadowRoot!.querySelector('.code-container');
    expect(container).toBeTruthy();

    const header = container!.querySelector('.code-header');
    expect(header).toBeTruthy();

    const lang = header!.querySelector('.code-lang');
    expect(lang!.textContent!.trim()).toBe('typescript');

    const copyBtn = header!.querySelector('.btn-copy-code');
    expect(copyBtn).toBeTruthy();
    expect(copyBtn!.textContent!.trim()).toBe('Copy');

    const code = block!.querySelector('code');
    expect(code!.textContent!.trim()).toBe('const x = 5;');
  });

  it('triggers rewindAndEdit when user clicks Edit', async () => {
    element.message = {
      role: 'user',
      text: 'Edit me',
      senderName: 'User',
    };
    element.index = 4;
    await element.updateComplete;

    const editBtn = element.shadowRoot!.querySelector('.btn-action') as HTMLButtonElement;
    expect(editBtn.getAttribute('aria-label')).toBe('Edit');

    // Setup spy return
    mockChatSession.rewindAndEdit.and.returnValue(Promise.resolve('Edit me'));

    let eventDetail: {prompt: string} | null = null;
    element.addEventListener('edit-prompt', (e: Event) => {
      eventDetail = (e as CustomEvent<{prompt: string}>).detail;
    });

    editBtn.click();
    
    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockState.chatSession.rewindAndEdit).toHaveBeenCalledWith(4);
    expect(eventDetail as {prompt: string} | null).toEqual({prompt: 'Edit me'});
  });

  it('triggers redoResponse when user clicks Regenerate', async () => {
    element.message = {
      role: 'assistant',
      text: 'Retry me',
      senderName: 'Assistant',
    };
    element.index = 5;
    await element.updateComplete;

    // The copy button is first, retry is second
    const actionBtns = element.shadowRoot!.querySelectorAll('.btn-action');
    const retryBtn = actionBtns[1] as HTMLButtonElement;
    expect(retryBtn.getAttribute('aria-label')).toBe('Regenerate');

    retryBtn.click();

    expect(mockState.chatSession.redoResponse).toHaveBeenCalledWith(5);
  });

  it('copies code to clipboard when copy button is clicked in code header', async () => {
    element.message = {
      role: 'assistant',
      text: 'Here is some code:\n```typescript\nconst x = 5;\n```',
      senderName: 'Assistant',
    };
    element.index = 6;
    await element.updateComplete;

    const block = element.shadowRoot!.querySelector('document-code-block');
    await block!.updateComplete;
    const copyBtn =
        block!.shadowRoot!.querySelector('.btn-copy-code') as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();

    copyBtn.click();
    
    // Wait for async copy handler
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockClipboardWriteText).toHaveBeenCalledWith('const x = 5;');
    expect(copyBtn.textContent!.trim()).toBe('Copied!');
  });

  it('dispatches preview-html event when preview button is clicked in HTML code header', async () => {
    element.message = {
      role: 'assistant',
      text: 'Here is HTML:\n```html\n<h1>Hello</h1>\n```',
      senderName: 'Assistant',
    };
    element.index = 7;
    await element.updateComplete;

    const block = element.shadowRoot!.querySelector('document-code-block');
    await block!.updateComplete;
    const previewBtn = block!.shadowRoot!.querySelector('.btn-preview-code') as
        HTMLButtonElement;
    expect(previewBtn).toBeTruthy();

    let eventDetail: { base64Code: string } | null = null;
    element.addEventListener('preview-html', (e: Event) => {
      eventDetail = (e as CustomEvent<{base64Code: string}>).detail;
    });

    previewBtn.click();

    expect(eventDetail as {base64Code: string} | null).toEqual({
      base64Code: jasmine.any(String),
    });
    
    expect(decodeURIComponent(escape(atob(eventDetail!.base64Code))).trim()).toBe('<h1>Hello</h1>');
  });

  it('renders inline and display LaTeX math', async () => {
    element.message = {
      role: 'assistant',
      text: 'Inline math $e^{i\\pi} + 1 = 0$ and display math:\n$$f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx$$',
      senderName: 'Assistant',
    };
    element.index = 8;
    await element.updateComplete;

    const content = element.shadowRoot!.querySelector('.message-content');
    expect(content).toBeTruthy();

    // Check KaTeX element exists
    const katexElements = content!.querySelectorAll('.katex');
    expect(katexElements.length).toBe(2);

    // One of them should be in display mode (wrapped in .katex-display)
    const displayKatex = content!.querySelector('.katex-display');
    expect(displayKatex).toBeTruthy();
    expect(displayKatex!.querySelector('.katex')).toBeTruthy();
  });

  it('does not render LaTeX math inside code blocks', async () => {
    element.message = {
      role: 'assistant',
      text: 'Here is code with dollar: `const x = $5;` and a block:\n```\n$y = 6$\n```',
      senderName: 'Assistant',
    };
    element.index = 9;
    await element.updateComplete;

    const content = element.shadowRoot!.querySelector('.message-content');
    expect(content).toBeTruthy();

    // There should be no KaTeX elements because they are in code blocks
    const katexElements = content!.querySelectorAll('.katex');
    expect(katexElements.length).toBe(0);
  });

  it('allows only safe code-block attributes in chat and keeps custom elements blocked in documents', async () => {
    const markup = '<document-code-block language="html" base-64-code="SGVsbG8=" onclick="alert(1)" style="position:fixed"><script>alert(1)</script><document-code-sandbox></document-code-sandbox><pre>Hello</pre></document-code-block>';
    element.message = {role: 'assistant', text: markup, senderName: 'Assistant'};
    await element.updateComplete;
    const block = element.shadowRoot!.querySelector('document-code-block')!;
    expect(block).toBeTruthy();
    expect(block.hasAttribute('onclick')).toBeFalse();
    expect(block.hasAttribute('style')).toBeFalse();
    expect(block.querySelector('script')).toBeNull();
    expect(block.querySelector('document-code-sandbox')).toBeNull();
    const documentHost = document.createElement('div');
    render(renderHtml(markup), documentHost);
    expect(documentHost.querySelector('document-code-block')).toBeNull();
  });

  it('uses a readable model label instead of a runtime filename', async () => {
    element.message = {role: 'assistant', text: 'Hello.', senderName: 'gemma-4-E4B-it-web.litertlm', state: 'complete'};
    await element.updateComplete;
    const sender = element.shadowRoot!.querySelector<HTMLElement>('.message-sender')!;
    expect(sender.textContent!.trim()).toBe('Gemma 4 E4B');
    expect(sender.title).toBe('gemma-4-E4B-it-web.litertlm');
  });

  it('keeps performance data collapsed but available', async () => {
    element.message = {role: 'assistant', text: 'Hello.', senderName: 'Assistant',
      prefillTokensCount: '73', prefillSpeed: '117.3 tk/s', decodeSpeed: '25.9 tk/s', tokensCount: '172', firstTokenSeconds: 0.7};
    await element.updateComplete;
    const details = element.shadowRoot!.querySelector<HTMLElement>('#response-details')!;
    const toggle = element.shadowRoot!.querySelector<HTMLButtonElement>('[aria-controls="response-details"]')!;
    expect(details.hidden).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await element.updateComplete;
    expect(details.hidden).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(details.textContent).toContain('73');
    expect(details.textContent).toContain('25.9 tk/s');
    expect(details.textContent).toContain('0.7s');
    toggle.click();
    await element.updateComplete;
    expect(details.hidden).toBeTrue();
  });

  it('copies the answer without losing its button icon', async () => {
    element.message = {role: 'assistant', text: 'The answer.', senderName: 'Assistant'};
    await element.updateComplete;
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('.btn-action')!;
    button.querySelector('svg')!.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(mockClipboardWriteText).toHaveBeenCalledWith('The answer.');
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(element.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('Copied');
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('locates the same source from an inline reference and a source chip', async () => {
    const citation = {id: 'S1', documentId: 'doc-1', documentName: 'paper.pdf', label: 'Page 1', excerpt: 'Evidence.'};
    element.message = {role: 'assistant', text: 'The answer [[S1]].', senderName: 'Assistant', citations: [citation]};
    await element.updateComplete;
    const selected: unknown[] = [];
    element.addEventListener('source-selected', event => selected.push((event as CustomEvent).detail));
    (element.shadowRoot!.querySelector('.message-content a') as HTMLAnchorElement).click();
    (element.shadowRoot!.querySelector('.source-citation') as HTMLButtonElement).click();
    expect(selected).toEqual([citation, citation]);
  });

  it('disables retry while the conversation is busy', async () => {
    Object.defineProperty(mockChatSession, 'isBusy', {value: true});
    element.message = {role: 'assistant', text: 'A response.', senderName: 'Assistant'};
    await element.updateComplete;
    const retry = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn-action')[1]!;
    expect(retry.disabled).toBeTrue();
    retry.click();
    expect(mockChatSession.redoResponse).not.toHaveBeenCalled();
  });

  it('updates historical message actions when the shared busy state changes', async () => {
    element.message = {role: 'assistant', text: 'A previous answer.', senderName: 'Assistant', state: 'complete'};
    element.busy = true;
    await element.updateComplete;
    const retry = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn-action')[1]!;
    expect(retry.disabled).toBeTrue();
    element.busy = false;
    await element.updateComplete;
    expect(retry.disabled).toBeFalse();
  });

  it('copies the original user question through its icon action', async () => {
    element.message = {role: 'user', text: 'My question\nWith a second line.', senderName: 'User'};
    await element.updateComplete;
    const actions = [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn-action')];
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual(['Edit', 'Copy']);
    expect(actions.every(button => button.textContent!.trim() === '' && button.querySelector('svg'))).toBeTrue();
    actions[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(mockClipboardWriteText).toHaveBeenCalledWith('My question\nWith a second line.');
    expect(actions[1].getAttribute('aria-label')).toBe('Copied');
  });

  it('reveals user actions and their tooltip on keyboard focus', async () => {
    element.message = {role: 'user', text: 'A question.', senderName: 'User'};
    await element.updateComplete;
    const actions = element.shadowRoot!.querySelector<HTMLElement>('.user-actions')!;
    const button = actions.querySelector<HTMLButtonElement>('button')!;
    button.focus();
    expect(getComputedStyle(actions).pointerEvents).toBe('auto');
    expect(getComputedStyle(actions.querySelector('.action-tooltip')!).visibility).toBe('visible');
    expect(element.shadowRoot!.activeElement).toBe(button);
  });

  it('shows three assistant icon actions and handles missing performance data', async () => {
    element.message = {role: 'assistant', text: 'A response.', senderName: 'Assistant', state: 'complete'};
    await element.updateComplete;
    const actions = [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn-action')];
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual(['Copy', 'Regenerate', 'Response details']);
    expect(actions.every(button => button.textContent!.trim() === '' && button.querySelector('svg'))).toBeTrue();
    actions[2].click();
    await element.updateComplete;
    const details = element.shadowRoot!.querySelector<HTMLElement>('#response-details')!;
    expect(details.hidden).toBeFalse();
    expect(details.textContent).toContain('Performance data is unavailable');
  });

  it('shows live generation only for the active response and stops it on completion', async () => {
    const message = {role: 'assistant' as const, text: '', senderName: 'Assistant', thoughtText: 'Considering the question.'};
    mockChatSession.isGenerating = true;
    mockChatSession.messages = [{role: 'user', text: 'Question', senderName: 'User'}, message];
    element.index = 1;
    element.message = message;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('.response-status')!.textContent!.trim()).toBe('Thinking');
    expect(element.shadowRoot!.querySelector('.generation-track')).toBeTruthy();
    mockChatSession.isGenerating = false;
    element.message = {...message, text: 'The answer.', state: 'complete'};
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('.generation-track')).toBeNull();
    expect(element.shadowRoot!.querySelector('.response-status')!.textContent!.trim()).toBe('Complete');
  });

});
