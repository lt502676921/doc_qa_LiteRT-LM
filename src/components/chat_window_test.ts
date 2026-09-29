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

import './chat_window';

import {LlmChatStateController} from '../state_controller.js';
import {ChatSessionStore} from '../stores/chat_session_store.js';
import {ModelLoaderService} from '../stores/model_loader_service.js';
import {SettingsStore} from '../stores/settings_store.js';
import {DocumentChatWindow} from './chat_window.js';

describe('document-chat-window', () => {
  let element: DocumentChatWindow;
  let mockState: jasmine.SpyObj<LlmChatStateController>;
  let mockChatSession: jasmine.SpyObj<ChatSessionStore>;
  let mockSettings: jasmine.SpyObj<SettingsStore>;
  let mockModelLoader: jasmine.SpyObj<ModelLoaderService>;
  let cachedModelsMap: Map<string, number>;

  beforeEach(async () => {
    mockChatSession = jasmine.createSpyObj('ChatSessionStore', [
      'sendMessage',
      'cancelGeneration',
    ]);
    // Initialize properties used during render
    mockChatSession.isGenerating = false;
    mockChatSession.messages = [];
    mockChatSession.sendMessage.and.returnValue(Promise.resolve(true));

    mockSettings = jasmine.createSpyObj('SettingsStore', ['saveSettings']);
    mockSettings.selectedModelPath = 'path/to/model_file.litertlm';

    cachedModelsMap = new Map<string, number>();
    mockModelLoader = jasmine.createSpyObj('ModelLoaderService', [
      'loadModelWeights',
    ]);
    mockModelLoader.isModelLoading = false;
    mockModelLoader.cachedModels = cachedModelsMap;

    mockState = {
      chatSession: mockChatSession,
      settings: mockSettings,
      modelLoader: mockModelLoader,
      statusText: 'Idle',
      addHost: jasmine.createSpy('addHost'),
      removeHost: jasmine.createSpy('removeHost'),
      requestUpdate: jasmine.createSpy('requestUpdate'),
    } as unknown as jasmine.SpyObj<LlmChatStateController>;

    element = document.createElement('document-chat-window');
    element.state = mockState;
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
  });

  it('renders quick starters when messages are empty', () => {
    const starters = element.shadowRoot!.querySelectorAll('.btn-starter');
    expect(starters.length).toBe(3);
    expect(starters[0]!.textContent!.trim()).toBe('Explain WebGPU');
  });

  it('does not render quick starters when messages exist', async () => {
    mockChatSession.messages = [
      {role: 'user', text: 'Hi', senderName: 'User'},
    ];
    element.requestUpdate();
    await element.updateComplete;

    const starters = element.shadowRoot!.querySelectorAll('.btn-starter');
    expect(starters.length).toBe(0);

    const bubbles = element.shadowRoot!.querySelectorAll('document-chat-bubble');
    expect(bubbles.length).toBe(1);
  });

  it('disables input when model is loading', async () => {
    mockModelLoader.isModelLoading = true;
    element.requestUpdate();
    await element.updateComplete;

    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    expect(textarea.disabled).toBeTrue();
    expect(textarea.placeholder).toBe('Model is preparing, please wait...');

    const sendBtn = element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBeTrue();
  });

  it('enables input when model is not loading', () => {
    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    expect(textarea.disabled).toBeFalse();
    expect(textarea.placeholder).toBe('Ask a question about this document...');

    const sendBtn = element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBeFalse();
  });

  it('shows "Send" when model is cached', async () => {
    cachedModelsMap.set('model_file.litertlm', 1000);
    element.requestUpdate();
    await element.updateComplete;

    const sendBtn = element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement;
    expect(sendBtn.textContent!.trim()).toBe('Send');
  });

  it('shows "Download & Send" when model is not cached', () => {
    const sendBtn = element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement;
    expect(sendBtn.textContent!.trim()).toBe('Download & Send');
  });

  it('shows "Stop" button during generation', async () => {
    mockChatSession.isGenerating = true;
    element.requestUpdate();
    await element.updateComplete;

    const sendBtn = element.shadowRoot!.querySelector('#btn-send');
    expect(sendBtn).toBeNull();

    const stopBtn = element.shadowRoot!.querySelector('.btn-stop') as HTMLButtonElement;
    expect(stopBtn).toBeTruthy();
    expect(stopBtn.textContent!.trim()).toBe('Stop');

    stopBtn.click();
    expect(mockChatSession.cancelGeneration).toHaveBeenCalled();
  });

  it('sends message on send button click', async () => {
    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    textarea.value = 'Test prompt';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    
    const sendBtn = element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement;
    sendBtn.click();
    await element.updateComplete;

    expect(mockChatSession.sendMessage).toHaveBeenCalledWith('Test prompt');
    expect(textarea.value).toBe('');
  });

  it('sends message on Enter key press', async () => {
    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    textarea.value = 'Test prompt Enter';
    
    const event = new KeyboardEvent('keydown', {key: 'Enter', shiftKey: false});
    textarea.dispatchEvent(event);
    await element.updateComplete;

    expect(mockChatSession.sendMessage).toHaveBeenCalledWith('Test prompt Enter');
    expect(textarea.value).toBe('');
  });

  it('does not send message on Shift+Enter key press', async () => {
    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    textarea.value = 'Test prompt Shift Enter';
    
    const event = new KeyboardEvent('keydown', {key: 'Enter', shiftKey: true});
    textarea.dispatchEvent(event);
    await element.updateComplete;

    expect(mockChatSession.sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe('Test prompt Shift Enter');
  });

  it('inserts newline on Ctrl+J key press', async () => {
    const textarea =
        element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    textarea.value = 'Line 1Line 2';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;

    const event = new KeyboardEvent('keydown', {key: 'j', ctrlKey: true});
    textarea.dispatchEvent(event);
    await element.updateComplete;

    expect(textarea.value).toBe('Line 1\nLine 2');
    expect(textarea.selectionStart).toBe(7);
    expect(textarea.selectionEnd).toBe(7);
  });

  it('populates input when clicking quick starter', async () => {
    const starters = element.shadowRoot!.querySelectorAll('.btn-starter');
    const firstStarter = starters[0] as HTMLButtonElement;
    
    firstStarter.click();
    await element.updateComplete;

    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Explain WebGPU in simple terms.');
    expect(element.shadowRoot!.activeElement).toBe(textarea);
  });

  it('keeps the submitted draft empty while the reply is still generating', async () => {
    let finish!: (submitted: boolean) => void;
    mockChatSession.sendMessage.and.callFake(prompt => {
      mockChatSession.isGenerating = true;
      mockChatSession.messages = [{role: 'user', text: prompt, senderName: 'User'},
        {role: 'assistant', text: '', senderName: 'Assistant'}];
      element.requestUpdate();
      return new Promise(resolve => finish = resolve);
    });
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    textarea.value = 'hi';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    (element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement).click();
    await element.updateComplete;
    expect(mockChatSession.sendMessage).toHaveBeenCalledWith('hi');
    expect(textarea.value).toBe('');
    expect(textarea.style.height).toBe('');
    expect(element.shadowRoot!.querySelector('.btn-stop')).toBeTruthy();
    // Reconcile a stale native value when streaming triggers another render.
    textarea.value = 'hi';
    element.requestUpdate();
    await element.updateComplete;
    expect(textarea.value).toBe('');
    mockChatSession.isGenerating = false;
    finish(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    element.requestUpdate();
    await element.updateComplete;
    expect(textarea.value).toBe('');
  });

  it('restores the draft when the question was not submitted', async () => {
    mockChatSession.sendMessage.and.returnValue(Promise.resolve(false));
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    textarea.value = 'An unsent question';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    (element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(textarea.value).toBe('An unsent question');
  });

  it('preserves a newer draft when an earlier question was not submitted', async () => {
    let finish!: (submitted: boolean) => void;
    mockChatSession.sendMessage.and.returnValue(new Promise(resolve => finish = resolve));
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    textarea.value = 'Original question';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    (element.shadowRoot!.querySelector('#btn-send') as HTMLButtonElement).click();
    textarea.value = 'A new draft';
    textarea.dispatchEvent(new Event('input'));
    finish(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(textarea.value).toBe('A new draft');
  });

  it('keeps Enter from submitting text during input method composition', async () => {
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    textarea.value = '正在输入';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', isComposing: true}));
    await element.updateComplete;
    expect(mockChatSession.sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe('正在输入');
  });

  it('disables Send for empty or whitespace drafts and enables it for a question', async () => {
    mockModelLoader.engine = {} as NonNullable<ModelLoaderService['engine']>;
    element.requestUpdate();
    await element.updateComplete;
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    const send = element.shadowRoot!.querySelector<HTMLButtonElement>('#btn-send')!;
    expect(send.textContent).toContain('Send');
    expect(send.disabled).toBeTrue();
    send.click();
    textarea.value = ' \n\t ';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    expect(send.disabled).toBeTrue();
    textarea.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    expect(mockChatSession.sendMessage).not.toHaveBeenCalled();
    textarea.value = 'A question';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    expect(send.disabled).toBeFalse();
    send.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(mockChatSession.sendMessage).toHaveBeenCalledWith('A question');
    expect(textarea.value).toBe('');
    expect(send.disabled).toBeTrue();
  });

  it('offers Load model without a draft and Load model and send with a draft', async () => {
    const textarea = element.shadowRoot!.querySelector<HTMLTextAreaElement>('#chat-input')!;
    const send = element.shadowRoot!.querySelector<HTMLButtonElement>('#btn-send')!;
    expect(send.textContent).toContain('Load model');
    expect(send.textContent).not.toContain('and send');
    expect(send.disabled).toBeFalse();
    textarea.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    expect(mockModelLoader.loadModelWeights).not.toHaveBeenCalled();
    send.click();
    expect(mockModelLoader.loadModelWeights).toHaveBeenCalledTimes(1);
    expect(mockChatSession.sendMessage).not.toHaveBeenCalled();
    textarea.value = 'First question';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    expect(send.textContent).toContain('Load model and send');
    expect(send.disabled).toBeFalse();
    send.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(mockChatSession.sendMessage).toHaveBeenCalledWith('First question');
    expect(send.textContent).not.toContain('and send');
    expect(send.disabled).toBeFalse();
    textarea.value = ' \n\t ';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    expect(send.textContent).not.toContain('and send');
    expect(send.disabled).toBeFalse();
    textarea.value = '';
    textarea.dispatchEvent(new Event('input'));
    await element.updateComplete;
    expect(send.disabled).toBeFalse();
    mockModelLoader.engine = {} as NonNullable<ModelLoaderService['engine']>;
    element.requestUpdate();
    await element.updateComplete;
    expect(send.textContent).toContain('Send');
    expect(send.disabled).toBeTrue();
  });

  it('handles edit-prompt event', async () => {
    // Add a message to render a bubble
    mockChatSession.messages = [
      {role: 'assistant', text: 'Some response', senderName: 'Assistant'},
    ];
    element.requestUpdate();
    await element.updateComplete;

    const bubble = element.shadowRoot!.querySelector('document-chat-bubble');
    expect(bubble).toBeTruthy();

    const textarea = element.shadowRoot!.querySelector('#chat-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');

    bubble!.dispatchEvent(new CustomEvent('edit-prompt', {
      detail: {prompt: 'Edited Prompt'},
      bubbles: true,
      composed: true,
    }));
    await element.updateComplete;

    expect(textarea.value).toBe('Edited Prompt');
    expect(element.shadowRoot!.activeElement).toBe(textarea);
  });
});
