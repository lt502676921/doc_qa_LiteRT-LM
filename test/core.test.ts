import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {OfficeParser, type OfficeParserAST} from 'officeparser';
import type {Engine, ChatInterface, ConversationConfig} from '@litert-lm/core';
import {extractDocumentStructure, parseDocumentFile, type ParsedDocument} from '../src/services/document_service.js';
import {citationMarkdown, validateCitations} from '../src/services/citation_service.js';
import {estimateTokens, planContext, summaryBatches} from '../src/services/context_planner.js';
import {ChatSessionStore} from '../src/stores/chat_session_store.js';
import {SettingsStore} from '../src/stores/settings_store.js';
import {sourceRegions, sourceText} from '../src/services/source_geometry.js';
import type {ModelLoaderService} from '../src/stores/model_loader_service.js';
import {directoryDatabaseName, modelCacheName, storageKey} from '../src/services/browser_state.js';

Object.defineProperty(globalThis, 'crypto', {value: webcrypto, configurable: true});
function storage() {
  const values = new Map<string, string>();
  return {get length() {return values.size;}, key: (index: number) => [...values.keys()][index] ?? null,
    clear: () => values.clear(), getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key)};
}
Object.defineProperty(globalThis, 'window', {value: {localStorage: storage()}, configurable: true});

test('renaming the application retains saved settings and conversation keys', () => {
  const existing = storage() as unknown as Storage;
  existing.setItem('previous-chat-settings', '{"contextLength":8192}');
  existing.setItem('previous-conversations-list', '[{"id":"chat-a"}]');
  existing.setItem('previous-chat-history-chat-a', '[{"text":"Saved answer"}]');
  assert.equal(existing.getItem(storageKey('chat-settings', existing)), '{"contextLength":8192}');
  assert.equal(existing.getItem(storageKey('chat-history-chat-a', existing)), '[{"text":"Saved answer"}]');
  existing.setItem(storageKey('summary-chat-a', existing), 'Saved summary');
  assert.equal(existing.getItem('previous-summary-chat-a'), 'Saved summary');
  const fresh = storage() as unknown as Storage;
  assert.equal(storageKey('chat-settings', fresh), 'document-qa-chat-settings');
  const ambiguous = storage() as unknown as Storage;
  ambiguous.setItem('first-chat-settings', '{}');
  ambiguous.setItem('second-chat-settings', '{}');
  assert.equal(storageKey('chat-settings', ambiguous), 'document-qa-chat-settings');
});

test('renaming keeps downloaded models and local directory handles available', async () => {
  const cacheStorage = (names: string[]) => ({keys: async () => names}) as unknown as CacheStorage;
  assert.equal(await modelCacheName(cacheStorage(['previous-models', 'previous-shell-v1'])), 'previous-models');
  assert.equal(await modelCacheName(cacheStorage([])), 'document-qa-models');
  assert.equal(await modelCacheName(cacheStorage(['previous-models', 'document-qa-models'])), 'document-qa-models');
  assert.equal(await modelCacheName(cacheStorage(['first-models', 'second-models'])), 'document-qa-models');
  const factory = (names: string[]) => ({databases: async () => names.map(name => ({name}))}) as unknown as IDBFactory;
  assert.equal(await directoryDatabaseName(factory(['previous-local-dir'])), 'previous-local-dir');
  assert.equal(await directoryDatabaseName(factory([])), 'document-qa-local-dir');
  assert.equal(await directoryDatabaseName(factory(['previous-local-dir', 'document-qa-local-dir'])), 'document-qa-local-dir');
});

function document(size = 3): ParsedDocument {
  const blocks = Array.from({length: size}, (_, index) => ({id: `S${index + 1}`, unitId: `page-${index + 1}`,
    label: `Page ${index + 1}`, page: index + 1, text: `Evidence ${index + 1}. ` + 'River bridges carry trains. '.repeat(30), markdown: ''}));
  for (const block of blocks) block.markdown = block.text;
  return {id: 'doc-a', name: 'sample.pdf', size: 100, extension: 'pdf', html: '', markdown: blocks.map(b => b.markdown).join('\n'),
    wordCount: 100, charCount: 2000, blocks, units: blocks.map(b => ({id: b.unitId, label: b.label})), unreadableUnits: [], warnings: []};
}
const budget = {contextLength: 16384, maxOutputTokens: 2048};

test('all five real PDFs retain physical pages and usable source blocks', async () => {
  const manifest = JSON.parse(await readFile(new URL('./fixtures/papers/manifest.json', import.meta.url), 'utf8'));
  for (const paper of manifest.papers) {
    const ast = await OfficeParser.parseOffice(await readFile(new URL(`./fixtures/papers/${paper.file}`, import.meta.url)), {ocr: false, extractAttachments: false});
    const structure = extractDocumentStructure(ast);
    assert.equal(structure.units.length, paper.expectedPages, paper.file);
    assert.deepEqual([...new Set(structure.blocks.map(block => block.page))], Array.from({length: paper.expectedPages}, (_, i) => i + 1));
    for (const check of paper.sourceChecks) {
      const text = structure.blocks.filter(block => block.page === check.page).map(block => block.text).join(' ').replace(/\s+/g, ' ').toLowerCase();
      for (const anchor of check.contains) assert.ok(text.includes(anchor.toLowerCase()), `${paper.file}: ${anchor} on page ${check.page}`);
    }
    assert.equal(structure.unreadableUnits.length, 0);
    assert.equal(new Set(structure.blocks.map(block => block.id)).size, structure.blocks.length);
    // One GFS footnote marker has a zero-height font box; do not manufacture its geometry.
    assert.ok(structure.blocks.filter(block => /[\p{L}\p{N}]/u.test(block.text)).every(block => block.regions?.length),
      `${paper.file}: all substantive citations have physical coordinates`);
    for (const block of structure.blocks) for (const region of block.regions || []) {
      assert.ok(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0);
      assert.ok(region.x + region.width <= 1.000001 && region.y + region.height <= 1.000001);
    }
  }
});
test('image-only pages are reported without manufacturing evidence', () => {
  const ast = {type: 'pdf', content: [{type: 'page', metadata: {pageNumber: 1}, children: [{type: 'image', text: 'not evidence'}]}]} as unknown as OfficeParserAST;
  const result = extractDocumentStructure(ast);
  assert.equal(result.blocks.length, 0); assert.deepEqual(result.unreadableUnits, ['Page 1']);
});
test('same filename with different contents has a different document identity', async () => {
  const a = await parseDocumentFile(new File(['First source'], 'same.txt'));
  const b = await parseDocumentFile(new File(['Different source'], 'same.txt'));
  assert.notEqual(a.id, b.id); assert.ok(a.html.includes('id="source-S1"'));
  assert.equal(await a.originalFile?.text(), 'First source');
});
test('source geometry preserves table text and excludes other chunks and image regions', () => {
  const node = {type: 'table', children: [
    {type: 'row', children: [{type: 'cell', children: [{type: 'text', text: 'First', bounds: {x: 10, y: 20, width: 30, height: 10}}]},
      {type: 'cell', children: [{type: 'text', text: 'Second', bounds: {x: 60, y: 20, width: 30, height: 10}}]}]},
    {type: 'row', children: [{type: 'cell', children: [{type: 'text', text: 'Third', bounds: {x: 10, y: 40, width: 30, height: 10}}]}]},
    {type: 'image', text: 'Untrusted image description', bounds: {x: 0, y: 0, width: 100, height: 100}},
  ]} as any;
  const source = sourceText(node);
  assert.equal(source.text, 'First | Second\nThird');
  assert.deepEqual(sourceRegions(source, 0, 5, 100, 200), [{x: .1, y: .1, width: .3, height: .05}]);
  const start = source.text.indexOf('Third');
  assert.deepEqual(sourceRegions(source, start, start + 5, 100, 200), [{x: .1, y: .2, width: .3, height: .05}]);
  assert.deepEqual(sourceRegions(source, 0, 10, NaN, 200), []);
});
test('splitting a long positioned paragraph highlights only the source lines in each chunk', () => {
  const ast = {type: 'pdf', content: [{type: 'page', metadata: {pageNumber: 1, pageWidth: 100, pageHeight: 100}, children: [
    {type: 'paragraph', children: [
      {type: 'text', text: 'A'.repeat(1300) + ' ', bounds: {x: 10, y: 10, width: 80, height: 10}},
      {type: 'text', text: 'B'.repeat(1300), bounds: {x: 10, y: 30, width: 80, height: 10}},
    ]},
  ]}]} as unknown as OfficeParserAST;
  const {blocks} = extractDocumentStructure(ast);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].regions?.length, 1); assert.equal(blocks[0].regions?.[0].y, .1);
  assert.equal(blocks[1].regions?.length, 1); assert.equal(blocks[1].regions?.[0].y, .3);
});
test('both citation grammars reject absent and excluded sources', () => {
  const doc = document();
  const result = validateCitations('Valid [[S1]] [S1], excluded [[S2]] [S2], invented [[fake#p99]].', doc, [doc.blocks[0]]);
  assert.deepEqual(result.citations.map(item => item.id), ['S1']);
  assert.deepEqual(result.invalid, ['S2', 'fake#p99']);
  assert.equal(citationMarkdown('[[S1]] [[S2]]', result.citations), '[\\[1\\]](#source-S1 "View source · Page 1") \\[Source unavailable\\]');
  assert.deepEqual(validateCitations('[[S', doc, doc.blocks).citations, []);
});
test('short documents use full text while reserves remain inside the configured limit', () => {
  const plan = planContext(document(), 'Explain the evidence', [], budget);
  assert.equal(plan.mode, 'full'); assert.equal(plan.evidence.length, 3);
  assert.ok(plan.inputTokens + plan.outputReserve + plan.margin <= plan.limit);
});
test('long documents retrieve a late fact rather than silently cutting off the end', () => {
  const doc = document(100);
  doc.blocks[95].text = doc.blocks[95].markdown = 'Secret vault password: PURPLE-COMET.';
  const plan = planContext(doc, 'What is the secret vault password?', [], budget);
  assert.equal(plan.mode, 'relevant'); assert.ok(plan.evidence.some(block => block.id === 'S96'));
  assert.ok(plan.inputTokens + plan.outputReserve + plan.margin <= plan.limit);
});
test('unmatched retrieval and oversized questions stop before inference', () => {
  assert.ok(planContext(document(100), 'zqxv unobtainium', [], budget).error);
  assert.ok(planContext(document(), 'Long question. '.repeat(4000), [], budget).error);
});
test('selected range never includes an excluded source', () => {
  const plan = planContext(document(), 'Evidence', [], budget, 'page-2');
  assert.deepEqual(plan.evidence.map(block => block.id), ['S2']); assert.equal(plan.mode, 'scope');
});
test('summary batching covers every source exactly once within capacity', () => {
  const doc = document(100), batches = summaryBatches(doc, budget, null);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat().map(block => block.id), doc.blocks.map(block => block.id));
  for (const blocks of batches) {
    const subset = {...doc, blocks};
    assert.equal(planContext(subset, 'Summarize these source blocks', [], budget).error, undefined);
  }
});
test('dense Unicode script estimates are conservative and orphan messages are not replayed', () => {
  const denseScriptSample = String.fromCodePoint(0x4e00, 0x3042, 0x30a2, 0xac00).repeat(25);
  assert.ok(estimateTokens(denseScriptSample) > estimateTokens('a'.repeat(100)));
  const plan = planContext(document(), 'Evidence', [{role: 'assistant', text: 'orphan'},
    {role: 'user', text: 'Question'}, {role: 'assistant', text: 'Answer'}], budget);
  assert.deepEqual(plan.history.map(item => item.text), ['Question', 'Answer']);
});

function setup(options: {failBenchmark?: boolean; failTokenCount?: boolean; failStream?: boolean} = {}) {
  Object.defineProperty(globalThis, 'window', {value: {localStorage: storage()}, configurable: true});
  const settings = new SettingsStore(() => {});
  const configs: ConversationConfig[] = [];
  const controllers: ReadableStreamDefaultController<any>[] = [];
  let delayResponse = false, deleted = 0;
  const engine = {createConversation: async (config: ConversationConfig) => {
    configs.push(config);
    const source = config.preface?.messages?.find(message => message.role === 'user')?.content as string || '';
    const id = source.match(/\[\[(S\d+)\]\]/)?.[1] || 'S1';
    return {sendMessageStreaming: () => new ReadableStream({start(controller) {
      controllers.push(controller);
      if (!delayResponse) {
        controller.enqueue({content: [{type: 'text', text: `Answer [[${id}]]`}], channels: {thought: 'Hidden tokens'}});
        if (options.failStream) controller.error(new Error('Stream failed'));
        else controller.close();
      }
    }}), cancel() {controllers.at(-1)?.close();}, delete: async () => {deleted++;},
      getTokenCount: async () => {
        if (options.failTokenCount) throw new Error('Context count unavailable');
        return 3500;
      }, getBenchmarkInfo: async () => {
        if (options.failBenchmark) throw new Error('Benchmark unavailable');
        return {lastPrefillTokenCount: 1000, lastPrefillTokensPerSecond: 100,
          lastDecodeTokenCount: 30, lastDecodeTokensPerSecond: 20, timeToFirstTokenInSecond: 1.25};
      },
    } as unknown as ChatInterface;
  }} as unknown as Engine;
  const loader = {engine, loadedSettings: structuredClone(settings.modelSettings), isModelLoading: false,
    needsModelReload: () => false, cancelDownload() {}, loadModelWeights: async () => {}} as unknown as ModelLoaderService;
  const saved = new Map<string, ParsedDocument>();
  const repository = {save: async (doc: ParsedDocument) => {saved.set(doc.id, doc);}, read: async (id: string) => saved.get(id) || null};
  let status = '';
  const store = new ChatSessionStore(() => {}, settings, loader, text => {status = text;}, repository);
  return {store, settings, loader, configs, saved, repository, getStatus: () => status,
    emit(text: string) {controllers.at(-1)?.enqueue({content: [{type: 'text', text}]});},
    delay() {delayResponse = true;}, deleted: () => deleted};
}
test('document chat validates sources, measures actual tokens and reuses a safe session', async () => {
  const {store, configs} = setup(); await store.setDocument(document());
  assert.equal(await store.sendMessage('Explain Evidence 1'), true);
  assert.equal(store.actualContextTokens, 3500);
  assert.equal(store.messages[0].inputTokensEstimate, estimateTokens('Explain Evidence 1'));
  assert.equal(store.messages[0].tokensCount, undefined, 'Do not report the entire prefill as the question count');
  assert.equal(store.messages[1].prefillTokensCount, '1000');
  assert.equal(store.messages[1].tokensCount, '30');
  assert.equal(store.messages[1].firstTokenSeconds, 1.25);
  assert.equal(store.messages[1].citations?.[0].documentId, 'doc-a');
  assert.equal(await store.sendMessage('Explain it again'), true);
  assert.equal(configs.length, 1);
  assert.equal(configs[0].preface?.tools, undefined, 'Document mode must not include executable tools');
});
test('question estimates persist when optional benchmark or context metrics fail independently', async () => {
  for (const options of [{failTokenCount: true}, {failBenchmark: true}]) {
    const context = setup(options); await context.store.setDocument(document());
    assert.equal(await context.store.sendMessage('Please explain Evidence 1'), true);
    const [question, answer] = context.store.messages;
    assert.equal(question.inputTokensEstimate, estimateTokens(question.text));
    assert.equal(question.tokensCount, undefined);
    assert.equal(answer.state, 'complete');
    assert.equal(answer.prefillTokensCount, options.failBenchmark ? undefined : '1000');
    assert.equal(answer.tokensCount, options.failBenchmark ? undefined : '30');
    assert.equal(context.store.actualContextTokens, options.failTokenCount ? null : 3500);
    const restored = new ChatSessionStore(() => {}, context.settings, context.loader, () => {}, context.repository);
    await restored.selectConversation(context.store.activeSavedConvId!);
    assert.equal(restored.messages[0].inputTokensEstimate, question.inputTokensEstimate);
    assert.equal(restored.messages[1].prefillTokensCount, answer.prefillTokensCount);
  }
});
test('changing scope rebuilds context; changing document never replays old text', async () => {
  const {store, configs} = setup(); await store.setDocument(document());
  await store.sendMessage('Evidence'); await store.setScope('page-2'); await store.sendMessage('Evidence');
  assert.equal(configs.length, 2);
  assert.equal(store.messages.at(-1)?.citations?.[0].id, 'S2');
  const next = document(); next.id = 'doc-b'; next.blocks[0].text = next.blocks[0].markdown = 'New document only';
  await store.setDocument(next);
  assert.equal(store.messages.length, 0); assert.equal(store.scope, null);
});
test('summary and chat are mutually exclusive and cancellation releases the task', async () => {
  const context = setup(); await context.store.setDocument(document()); context.delay();
  const pending = context.store.sendMessage('Evidence');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.store.isGenerating, true);
  await context.store.summarizeDocument(); await context.store.startNewConversation();
  assert.equal(context.store.currentDoc?.id, 'doc-a'); assert.equal(context.configs.length, 1);
  context.store.cancelGeneration();
  assert.equal(await pending, true, 'The question was submitted even though the answer was stopped');
  assert.equal(context.store.isBusy, false); assert.equal(context.store.messages.at(-1)?.state, 'cancelled');
  assert.equal(context.store.activeConversation, null);
});
test('streaming updates replace the rendered message object and preserve final metrics', async () => {
  const context = setup(); await context.store.setDocument(document()); context.delay();
  const pending = context.store.sendMessage('Evidence');
  await new Promise(resolve => setImmediate(resolve));
  const initial = context.store.messages.at(-1);
  assert.ok(context.store.messages[0].inputTokensEstimate! > 0, 'Question count is available before the first output token');
  context.emit('A visible answer [[S1]]');
  await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(context.store.messages.at(-1), initial);
  assert.equal(context.store.messages.at(-1)?.text, 'A visible answer [[S1]]');
  context.store.cancelGeneration(); await pending;
  assert.equal(context.store.messages.at(-1)?.state, 'cancelled');
  assert.ok(context.store.messages[0].inputTokensEstimate! > 0, 'Cancellation keeps the question estimate');
});
test('a response failure does not mark an already submitted question as unsent', async () => {
  const context = setup({failStream: true});
  await context.store.setDocument(document());
  assert.equal(await context.store.sendMessage('Evidence'), true);
  assert.equal(context.store.messages[0].text, 'Evidence');
  assert.equal(context.store.messages[1].state, 'error');
  assert.equal(context.store.isBusy, false);
});
test('restoring a chat restores its source; missing source blocks further questions', async () => {
  const context = setup(); await context.store.setDocument(document()); await context.store.sendMessage('Evidence');
  const id = context.store.activeSavedConvId!;
  const restored = new ChatSessionStore(() => {}, context.settings, context.loader, () => {}, context.repository);
  await restored.selectConversation(id); assert.equal(restored.currentDoc?.id, 'doc-a');
  context.saved.clear();
  const missing = new ChatSessionStore(() => {}, context.settings, context.loader, () => {}, context.repository);
  await missing.selectConversation(id); assert.equal(missing.missingDocument, true);
  assert.equal(await missing.sendMessage('Evidence'), false);
  await missing.setDocument(document()); assert.equal(missing.messages.length, 2);
});
test('reopening the same file to restore its original preview preserves the conversation and scope', async () => {
  const context = setup(); await context.store.setDocument(document()); await context.store.setScope('page-2');
  await context.store.sendMessage('Evidence');
  const id = context.store.activeSavedConvId;
  const replacement = {...document(), originalFile: new Blob(['Original file bytes'])};
  await context.store.setDocument(replacement);
  assert.equal(context.store.activeSavedConvId, id); assert.equal(context.store.messages.length, 2);
  assert.equal(context.store.scope, 'page-2'); assert.equal(context.store.currentDoc?.originalFile, replacement.originalFile);
});
test('long summaries cover all batches, cite their own sources and release sessions', async () => {
  const context = setup(); await context.store.setDocument(document(100));
  await context.store.summarizeDocument();
  assert.ok(context.configs.length > 1); assert.equal(context.deleted(), context.configs.length);
  assert.ok(context.store.summaryProgress.includes('all 100'));
  assert.equal(context.store.summaryInvalidCitations.length, 0);
});
test('cancelling a summary releases the session and reports incomplete coverage', async () => {
  const context = setup(); await context.store.setDocument(document(100)); context.delay();
  const pending = context.store.summarizeDocument();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.store.isSummarizing, true);
  assert.equal(await context.store.sendMessage('Evidence'), false);
  await context.store.setScope('page-2'); assert.equal(context.store.scope, null);
  context.store.cancelGeneration(); await pending;
  assert.equal(context.store.isBusy, false);
  assert.ok(context.store.summaryProgress.includes('incomplete'));
  assert.equal(context.deleted(), 1);
});
test('saved settings restore successfully', () => {
  setup();
  window.localStorage.setItem('document-qa-chat-settings', JSON.stringify({contextLength: 8192, maxOutputTokens: 500, enableThinking: false}));
  const settings = new SettingsStore(() => {});
  assert.equal(settings.contextLength, 8192); assert.equal(settings.maxOutputTokens, 500); assert.equal(settings.enableThinking, false);
});
