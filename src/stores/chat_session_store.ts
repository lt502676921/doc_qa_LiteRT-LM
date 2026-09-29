import {storageKey} from '../services/browser_state.js';
import {AutoToolChat, type ChatInterface, type Message, SamplerType} from '@litert-lm/core';
import {z} from 'zod';
import {CodeSandbox} from '../components/code_sandbox.js';
import type {ParsedDocument, DocumentBlock} from '../services/document_service.js';
import {citationMarkdown, type SourceCitation, validateCitations} from '../services/citation_service.js';
import {type ContextPlan, documentSystem, estimateTokens, evidenceText, planContext, summaryBatches} from '../services/context_planner.js';
import {readDocument, saveDocument} from '../services/document_repository.js';
import type {ModelLoaderService} from './model_loader_service.js';
import type {ModelSettings, SettingsStore} from './settings_store.js';

const CitationSchema = z.object({id: z.string(), documentId: z.string(), label: z.string(),
  documentName: z.string(), excerpt: z.string()});
const ConversationMetaSchema = z.object({id: z.string(), title: z.string(), createdAt: z.number(),
  modelPath: z.string(), documentId: z.string().optional(), documentName: z.string().optional(),
  scope: z.string().nullable().optional()});
const StoredMessageSchema = z.object({role: z.union([z.literal('user'), z.literal('assistant')]),
  text: z.string(), senderName: z.string(), thoughtText: z.string().optional(),
  prefillSpeed: z.string().optional(), decodeSpeed: z.string().optional(), tokensCount: z.string().optional(),
  inputTokensEstimate: z.number().int().nonnegative().optional(), prefillTokensCount: z.string().optional(),
  firstTokenSeconds: z.number().optional(), citations: z.array(CitationSchema).optional(),
  invalidCitations: z.array(z.string()).optional(), readingScope: z.string().optional(),
  state: z.enum(['complete', 'cancelled', 'error']).optional()});
export type StoredMessage = z.infer<typeof StoredMessageSchema>;
export type ConversationMeta = z.infer<typeof ConversationMetaSchema>;
interface Repository {save: typeof saveDocument; read: typeof readDocument;}

function responseText(message: Message): string {
  return typeof message.content === 'string' ? message.content :
    (message.content || []).filter(part => part.type === 'text').map(part => String(part.text || '')).join('');
}

export class ChatSessionStore {
  isGenerating = false;
  isSummarizing = false;
  isRestoring = false;
  isCancelled = false;
  activeSavedConvId: string | null = null;
  activeModelSettings: ModelSettings | null = null;
  conversationsList: ConversationMeta[] = [];
  messages: StoredMessage[] = [];
  activeConversation: ChatInterface | null = null;
  codeSandbox = new CodeSandbox();
  currentDoc: ParsedDocument | null = null;
  missingDocument = false;
  summaryText = '';
  summaryCitations: SourceCitation[] = [];
  summaryInvalidCitations: string[] = [];
  summaryProgress = '';
  scope: string | null = null;
  lastPlan: ContextPlan | null = null;
  actualContextTokens: number | null = null;
  private activeEvidenceKey = '';
  private inFlightConversation: ChatInterface | null = null;
  private documents = new Map<string, ParsedDocument>();
  private readonly CONVS_LIST_KEY = storageKey('conversations-list');

  constructor(private readonly updateCallback: () => void, private readonly settings: SettingsStore,
      private readonly modelLoader: ModelLoaderService, private readonly updateStatus: (message: string) => void,
      private readonly repository: Repository = {save: saveDocument, read: readDocument}) {
    this.loadSavedConversationsIndex();
  }
  get isBusy() {return this.isGenerating || this.isSummarizing || this.isRestoring;}
  get effectiveSettings() {
    return {...this.settings.modelSettings,
      contextLength: this.modelLoader.loadedSettings?.contextLength || this.settings.contextLength};
  }
  get contextPreview(): ContextPlan {
    return this.lastPlan || planContext(this.currentDoc, '', this.history(), this.effectiveSettings, this.scope);
  }
  get readingScopeLabel(): string {
    const plan = this.contextPreview;
    if (plan.mode === 'relevant') return plan.evidence.length
      ? `Relevant excerpts · ${plan.evidence.length}/${plan.totalBlocks} text blocks`
      : 'Long document · excerpts will be selected for your question';
    return this.scope ? this.currentDoc?.units.find(unit => unit.id === this.scope)?.label || 'Selected range'
      : this.currentDoc ? 'Full readable text' : 'Conversation';
  }
  loadSavedConversationsIndex() {
    try {
      this.conversationsList = z.array(ConversationMetaSchema).parse(JSON.parse(window.localStorage.getItem(this.CONVS_LIST_KEY) || '[]'));
    } catch {this.conversationsList = [];}
  }
  private saveSavedConversationsIndex() {
    try {window.localStorage.setItem(this.CONVS_LIST_KEY, JSON.stringify(this.conversationsList));}
    catch {this.updateStatus('Browser storage is full. This conversation remains available for this session.');}
  }
  private async resetSession() {
    const previous = this.activeConversation;
    this.activeConversation = null;
    this.activeEvidenceKey = '';
    this.actualContextTokens = null;
    if (previous) await previous.delete();
  }
  private clearDocumentState() {
    this.currentDoc = null; this.missingDocument = false; this.scope = null;
    this.summaryText = ''; this.summaryCitations = []; this.summaryInvalidCitations = [];
    this.summaryProgress = ''; this.lastPlan = null;
  }
  async startNewConversation() {
    if (this.isBusy) return;
    this.isRestoring = true;
    try {
      await this.resetSession();
      this.activeSavedConvId = null;
      window.localStorage.removeItem(storageKey('active-conv-id'));
      this.messages = []; this.clearDocumentState();
      this.updateStatus('Ready for a new conversation.');
    } finally {this.isRestoring = false; this.updateCallback();}
  }
  async selectConversation(id: string) {
    if (this.isBusy) return;
    const metadata = this.conversationsList.find(item => item.id === id);
    if (!metadata) return;
    this.isRestoring = true; this.updateCallback();
    try {
      const messages = z.array(StoredMessageSchema).parse(JSON.parse(window.localStorage.getItem(storageKey(`chat-history-${id}`)) || '[]'));
      await this.resetSession(); this.clearDocumentState();
      this.messages = messages; this.activeSavedConvId = id;
      window.localStorage.setItem(storageKey('active-conv-id'), id);
      this.settings.selectedModelPath = metadata.modelPath; this.settings.saveSettings();
      if (metadata.documentId) {
        this.currentDoc = this.documents.get(metadata.documentId) || await this.repository.read(metadata.documentId).catch(() => null);
        this.missingDocument = !this.currentDoc;
        this.scope = metadata.scope || null;
        if (this.currentDoc && this.scope && !this.currentDoc.units.some(unit => unit.id === this.scope)) this.scope = null;
      }
      const summary = JSON.parse(window.localStorage.getItem(storageKey(`summary-${id}`)) || 'null');
      if (this.currentDoc && summary?.documentId === this.currentDoc.id && summary?.scope === this.scope) {
        this.summaryText = typeof summary.text === 'string' ? summary.text : '';
        this.summaryCitations = z.array(CitationSchema).catch([]).parse(summary.citations);
      }
      this.updateStatus(this.missingDocument ? `Reopen ${metadata.documentName || 'the original document'} to continue this chat.` : 'Conversation and document restored.');
    } catch (error) {this.updateStatus(`Could not restore conversation: ${(error as Error).message}`);}
    finally {this.isRestoring = false; this.updateCallback();}
  }
  deleteConversation(id: string) {
    if (this.isBusy) return;
    this.conversationsList = this.conversationsList.filter(item => item.id !== id);
    this.saveSavedConversationsIndex();
    window.localStorage.removeItem(storageKey(`chat-history-${id}`));
    window.localStorage.removeItem(storageKey(`summary-${id}`));
    if (this.activeSavedConvId === id) void this.startNewConversation();
    else this.updateCallback();
  }
  private commitActiveChatHistory() {
    try {
      if (!this.activeSavedConvId) {
        this.activeSavedConvId = crypto.randomUUID();
        const title = this.currentDoc?.name || this.messages[0]?.text || 'Untitled conversation';
        this.conversationsList.unshift({id: this.activeSavedConvId, title: title.slice(0, 50),
          createdAt: Date.now(), modelPath: this.settings.selectedModelPath});
      }
      const metadata = this.conversationsList.find(item => item.id === this.activeSavedConvId)!;
      metadata.modelPath = this.settings.selectedModelPath;
      if (this.currentDoc) {
        metadata.documentId = this.currentDoc.id; metadata.documentName = this.currentDoc.name; metadata.scope = this.scope;
      }
      this.saveSavedConversationsIndex();
      window.localStorage.setItem(storageKey('active-conv-id'), this.activeSavedConvId);
      window.localStorage.setItem(storageKey(`chat-history-${this.activeSavedConvId}`), JSON.stringify(this.messages));
      if (this.currentDoc) window.localStorage.setItem(storageKey(`summary-${this.activeSavedConvId}`), JSON.stringify({
        documentId: this.currentDoc.id, scope: this.scope, text: this.summaryText, citations: this.summaryCitations}));
    } catch {this.updateStatus('Browser storage is full. This conversation remains available for this session.');}
    this.updateCallback();
  }
  async setDocument(document: ParsedDocument) {
    if (this.isBusy) throw new Error('Finish or stop the current task before changing documents.');
    this.isRestoring = true; this.updateCallback();
    try {
      await this.resetSession();
      const metadata = this.conversationsList.find(item => item.id === this.activeSavedConvId);
      const reattach = metadata?.documentId === document.id &&
        (this.missingDocument || this.currentDoc?.id === document.id);
      if (!reattach) {
        this.activeSavedConvId = null; this.messages = []; this.clearDocumentState();
      }
      this.currentDoc = document; this.missingDocument = false; this.lastPlan = null;
      this.documents.set(document.id, document);
      let persisted = true;
      try {await this.repository.save(document);} catch {persisted = false;}
      this.commitActiveChatHistory();
      this.updateStatus(`Loaded ${document.name} · ${document.blocks.length} text blocks${persisted ? '' : ' · available for this session only'}.`);
    } finally {this.isRestoring = false; this.updateCallback();}
  }
  async clearDocument() {await this.startNewConversation();}
  async setScope(scope: string | null) {
    if (this.isBusy || (scope && !this.currentDoc?.units.some(unit => unit.id === scope))) return;
    this.isRestoring = true;
    try {
      await this.resetSession(); this.scope = scope; this.lastPlan = null;
      this.summaryText = ''; this.summaryCitations = []; this.summaryInvalidCitations = [];
      this.summaryProgress = '';
      this.commitActiveChatHistory(); this.updateStatus('Reading range updated.');
    } finally {this.isRestoring = false; this.updateCallback();}
  }
  private history() {
    const result: Array<{role: 'user' | 'assistant'; text: string}> = [];
    for (let index = 0; index < this.messages.length - 1; index++) {
      const user = this.messages[index], assistant = this.messages[index + 1];
      if (user.role === 'user' && assistant.role === 'assistant' && assistant.text &&
          (!assistant.state || assistant.state === 'complete')) {
        result.push({role: 'user', text: user.text}, {role: 'assistant', text: assistant.text}); index++;
      }
    }
    return result;
  }
  private samplerType() {
    return this.settings.samplerType === 'top_k' ? SamplerType.TOP_K :
      this.settings.samplerType === 'top_p' ? SamplerType.TOP_P : SamplerType.GREEDY;
  }
  private async ensureEngine() {
    if (this.modelLoader.needsModelReload(this.settings.modelSettings)) {
      await this.resetSession();
      await this.modelLoader.loadModelWeights(this.settings.modelSettings, async () => {});
    }
    if (!this.modelLoader.engine) throw new Error('The model could not be loaded.');
    if (this.isCancelled) throw new Error('Task stopped.');
  }
  async createConversationSession(plan?: ContextPlan) {
    if (!this.modelLoader.engine || (!plan && this.isBusy)) return;
    const input = plan || planContext(this.currentDoc, '', this.history(), this.effectiveSettings, this.scope);
    if (input.error || (this.currentDoc && !input.evidence.length)) return;
    await this.resetSession();
    const config = {
      sessionConfig: {maxOutputTokens: this.settings.maxOutputTokens, samplerParams: {
        type: this.samplerType(), temperature: this.settings.temperature, p: this.settings.topP, k: this.settings.topK}},
      preface: {messages: [
        {role: 'system', content: input.system},
        ...(this.currentDoc ? [{role: 'user', content: `Source text from ${this.currentDoc.name}:\n${input.evidenceText}`},
          {role: 'assistant', content: 'I will answer using the supplied source text and cite its IDs.'}] : []),
        ...input.history.map(message => ({role: message.role, content: message.text})),
      ], extra_context: {enable_thinking: this.settings.enableThinking}},
    };
    if (this.currentDoc) this.activeConversation = await this.modelLoader.engine.createConversation(config);
    else this.activeConversation = new AutoToolChat({engine: this.modelLoader.engine, config,
      recurringToolCallLimit: 3, tools: [{type: 'function', function: {name: 'run_javascript',
        description: 'Run JavaScript for calculations.', parameters: {type: 'object', properties: {code: {type: 'string'}}, required: ['code']}},
        execute: async args => typeof args.code === 'string' ? this.codeSandbox.run(args.code) : {error: 'Expected code string'}}]});
    this.activeModelSettings = structuredClone(this.settings.modelSettings);
    this.activeEvidenceKey = input.evidence.map(block => block.id).join(',');
  }
  /** Returns whether the question was submitted, even if the response later stops or fails. */
  async sendMessage(promptText: string): Promise<boolean> {
    if (this.isBusy || this.modelLoader.isModelLoading || !promptText.trim()) return false;
    if (this.missingDocument) {this.updateStatus('Reopen the original document before continuing this chat.'); return false;}
    this.isGenerating = true; this.isCancelled = false; this.updateCallback();
    let answer: StoredMessage | undefined;
    let submitted = false;
    try {
      let plan = planContext(this.currentDoc, promptText, this.history(), this.effectiveSettings, this.scope);
      this.lastPlan = plan; this.updateCallback();
      if (plan.error) throw new Error(plan.error);
      await this.ensureEngine();
      plan = planContext(this.currentDoc, promptText, this.history(), this.effectiveSettings, this.scope);
      this.lastPlan = plan;
      if (plan.error) throw new Error(plan.error);
      const key = plan.evidence.map(block => block.id).join(',');
      const currentCost = (this.actualContextTokens ?? this.effectiveSettings.contextLength) + estimateTokens(promptText) + 32;
      if (!this.activeConversation || key !== this.activeEvidenceKey ||
          JSON.stringify(this.activeModelSettings) !== JSON.stringify(this.settings.modelSettings) ||
          currentCost + plan.outputReserve + plan.margin > plan.limit) await this.createConversationSession(plan);
      else {plan.inputTokens = currentCost; this.lastPlan = plan;}
      if (!this.activeConversation || this.isCancelled) throw new Error('Task stopped.');
      this.messages.push({role: 'user', text: promptText, senderName: 'User',
        inputTokensEstimate: estimateTokens(promptText)});
      submitted = true;
      answer = {role: 'assistant', text: '', thoughtText: '', senderName: this.settings.selectedModelPath.split('/').pop() || 'Assistant',
        citations: [], invalidCitations: [], readingScope: this.readingScopeLabel};
      this.messages.push(answer); this.commitActiveChatHistory(); this.updateCallback();
      const started = performance.now();
      let firstToken: number | undefined;
      this.inFlightConversation = this.activeConversation;
      this.updateStatus('Reading source text and generating an answer...');
      const reader = this.activeConversation.sendMessageStreaming(promptText).getReader();
      try {
        while (!this.isCancelled) {
          const {done, value} = await reader.read();
          if (done) break;
          firstToken ??= (performance.now() - started) / 1000;
          answer.text += responseText(value);
          answer.thoughtText += value.channels?.thought || '';
          if (this.currentDoc) {
            const result = validateCitations(answer.text, this.currentDoc, plan.evidence);
            answer.citations = result.citations; answer.invalidCitations = result.invalid;
          }
          this.messages = [...this.messages.slice(0, -1), {...answer}]; this.updateCallback();
        }
        if (this.isCancelled) await reader.cancel();
      } finally {reader.releaseLock();}
      if (this.isCancelled) throw new Error('Task stopped.');
      answer.firstTokenSeconds = firstToken;
      try {
        const benchmark = await this.activeConversation.getBenchmarkInfo();
        answer.prefillTokensCount = String(benchmark.lastPrefillTokenCount);
        answer.prefillSpeed = `${benchmark.lastPrefillTokensPerSecond.toFixed(1)} tk/s`;
        answer.decodeSpeed = `${benchmark.lastDecodeTokensPerSecond.toFixed(1)} tk/s`;
        answer.tokensCount = String(benchmark.lastDecodeTokenCount);
        answer.firstTokenSeconds = benchmark.timeToFirstTokenInSecond || firstToken;
      } catch { /* Performance metrics are optional; the question estimate remains available. */ }
      try {this.actualContextTokens = await this.activeConversation.getTokenCount();}
      catch {this.actualContextTokens = null;}
      answer.state = 'complete';
      this.updateStatus('Generation completed.');
    } catch (error) {
      if (answer) {
        answer.state = this.isCancelled ? 'cancelled' : 'error';
        answer.text += this.isCancelled ? '\n\n*Stopped by user.*' : '\n\n*Generation failed. Retry this question.*';
      }
      this.updateStatus(this.isCancelled ? 'Task stopped.' : (error as Error).message);
      await this.resetSession().catch(() => {});
    } finally {
      this.inFlightConversation = null; this.isGenerating = false;
      if (answer) {
        this.messages = [...this.messages.slice(0, -2), {...this.messages.at(-2)!}, {...answer}];
        this.commitActiveChatHistory();
      }
      this.updateCallback();
    }
    return submitted;
  }
  async summarizeDocument() {
    if (!this.currentDoc || this.isBusy || this.modelLoader.isModelLoading) return;
    this.isSummarizing = true; this.isCancelled = false; this.summaryText = '';
    this.summaryCitations = []; this.summaryInvalidCitations = []; this.updateCallback();
    const document = this.currentDoc;
    let conversation: ChatInterface | null = null;
    try {
      await this.ensureEngine(); await this.resetSession();
      const settings = this.effectiveSettings;
      const batches = summaryBatches(document, settings, this.scope);
      let covered = 0;
      for (let index = 0; index < batches.length; index++) {
        if (this.isCancelled) throw new Error('Task stopped.');
        const blocks = batches[index];
        this.summaryProgress = `Batch ${index + 1}/${batches.length} · ${covered}/${batches.flat().length} text blocks covered`;
        this.updateStatus(`Summarizing ${index + 1}/${batches.length} batches...`); this.updateCallback();
        conversation = await this.modelLoader.engine!.createConversation({
          sessionConfig: {maxOutputTokens: settings.maxOutputTokens, samplerParams: {type: SamplerType.GREEDY}},
          preface: {messages: [{role: 'system', content: documentSystem(true)},
            {role: 'user', content: `Summarize these source blocks from ${document.name}:\n${evidenceText(blocks)}`}],
            extra_context: {enable_thinking: false}},
        });
        this.inFlightConversation = conversation;
        if (this.isCancelled) throw new Error('Task stopped.');
        const prefix = this.summaryText + (batches.length > 1 ? `\n\n### Part ${index + 1} · ${blocks[0].label} — ${blocks.at(-1)!.label}\n\n` : '');
        let part = '';
        const reader = conversation.sendMessageStreaming('Provide a concise structured summary, key findings and conclusions. Cite source IDs for each factual point. Do not invent information.').getReader();
        try {
          while (!this.isCancelled) {
            const {done, value} = await reader.read();
            if (done) break;
            part += responseText(value); this.summaryText = prefix + part;
            const result = validateCitations(part, document, blocks);
            const previous = this.summaryCitations.filter(citation => !blocks.some(block => block.id === citation.id));
            this.summaryCitations = [...previous, ...result.citations];
            this.summaryInvalidCitations = [...new Set([...this.summaryInvalidCitations, ...result.invalid])];
            this.updateCallback();
          }
          if (this.isCancelled) await reader.cancel();
        } finally {reader.releaseLock();}
        if (this.isCancelled) throw new Error('Task stopped.');
        covered += blocks.length;
        await conversation.delete(); conversation = null; this.inFlightConversation = null;
      }
      this.summaryProgress = `Summary covers all ${covered} readable text blocks in ${this.scope ? 'the selected range' : 'the document'}.`;
      this.updateStatus('Summary completed.'); this.commitActiveChatHistory();
    } catch (error) {
      this.summaryProgress = this.isCancelled ? 'Summary stopped · coverage is incomplete.' : `Summary incomplete: ${(error as Error).message}`;
      this.updateStatus(this.summaryProgress);
    } finally {
      if (conversation) await conversation.delete().catch(() => {});
      this.inFlightConversation = null; this.isSummarizing = false; this.updateCallback();
    }
  }
  get summaryMarkdown() {return citationMarkdown(this.summaryText, this.summaryCitations);}
  cancelGeneration() {
    this.isCancelled = true; this.inFlightConversation?.cancel();
    if (this.modelLoader.isModelLoading) this.modelLoader.cancelDownload();
    this.updateStatus('Stopping task...'); this.updateCallback();
  }
  async redoResponse(index: number) {
    if (this.isBusy || index < 1 || this.messages[index]?.role !== 'assistant') return;
    const prompt = this.messages[index - 1];
    if (prompt?.role !== 'user') return;
    this.isRestoring = true; this.updateCallback();
    try {
      this.messages = this.messages.slice(0, index - 1); await this.resetSession();
      this.commitActiveChatHistory();
    } finally {this.isRestoring = false; this.updateCallback();}
    await this.sendMessage(prompt.text);
  }
  async rewindAndEdit(index: number): Promise<string | null> {
    if (this.isBusy || index < 0) return null;
    const target = this.messages[index]?.role === 'user' ? index : index - 1;
    const prompt = this.messages[target];
    if (prompt?.role !== 'user') return null;
    this.isRestoring = true; this.updateCallback();
    try {
      this.messages = this.messages.slice(0, target); await this.resetSession(); this.commitActiveChatHistory();
    } finally {this.isRestoring = false; this.updateCallback();}
    return prompt.text;
  }
}
