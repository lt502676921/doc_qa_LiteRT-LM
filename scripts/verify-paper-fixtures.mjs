import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {OfficeParser} from 'officeparser';

const fixtureRoot = new URL('../test/fixtures/papers/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', fixtureRoot), 'utf8'));
const qaCases = JSON.parse(await readFile(new URL('qa-cases.json', fixtureRoot), 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(qaCases.schemaVersion, 1);
assert.ok(manifest.papers.length > 0, 'No paper fixtures found');
assert.equal(new Set(manifest.papers.map(paper => paper.id)).size, manifest.papers.length,
    'Duplicate paper IDs');
assert.equal(new Set(qaCases.cases.map(testCase => testCase.id)).size, qaCases.cases.length,
    'Duplicate QA case IDs');

// Leaf traversal avoids counting a container's aggregated text twice.
function nodeText(node) {
  return node.children?.length ? node.children.map(nodeText).join(' ') : node.text || '';
}

function normalize(text) {
  return text.replace(/\s+/gu, ' ').toLowerCase();
}

for (const testCase of qaCases.cases) {
  const paper = manifest.papers.find(candidate => candidate.id === testCase.paperId);
  assert.ok(paper, `${testCase.id}: unknown paper ${testCase.paperId}`);
  assert.ok(testCase.question?.trim(), `${testCase.id}: empty question`);
  assert.ok(testCase.expectedPoints?.length || testCase.expectedBehavior?.trim(),
      `${testCase.id}: missing review criteria`);
  for (const page of testCase.referencePages) {
    assert.ok(Number.isInteger(page) && page >= 1 && page <= paper.expectedPages,
        `${testCase.id}: invalid reference page ${page}`);
  }
  if (testCase.minimumDistinctEvidencePages !== undefined) {
    assert.ok(testCase.minimumDistinctEvidencePages >= 2 &&
        testCase.minimumDistinctEvidencePages <= new Set(testCase.referencePages).size,
        `${testCase.id}: invalid evidence coverage requirement`);
  }
}

let failed = 0;
for (const paper of manifest.papers) {
  try {
    const bytes = await readFile(new URL(paper.file, fixtureRoot));
    assert.equal(bytes.length, paper.bytes, 'Fixture byte count changed');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), paper.sha256,
        'Fixture checksum changed; review and update its baseline explicitly');

    const ast = await OfficeParser.parseOffice(bytes, {ocr: false, extractAttachments: false});
    assert.equal(ast.type, 'pdf', 'Unexpected document format');
    const pages = ast.content.filter(node => node.type === 'page');
    assert.equal(pages.length, paper.expectedPages, 'Missing or additional PDF pages');
    assert.deepEqual(pages.map(page => page.metadata?.pageNumber),
        Array.from({length: paper.expectedPages}, (_, index) => index + 1),
        'Page numbers must remain contiguous and one-based');

    for (const page of pages) {
      assert.ok(nodeText(page).trim(), `No extracted text on page ${page.metadata.pageNumber}`);
    }
    for (const check of paper.sourceChecks) {
      const pageText = normalize(nodeText(pages[check.page - 1]));
      for (const anchor of check.contains) {
        assert.ok(pageText.includes(normalize(anchor)),
            `Missing evidence anchor ${JSON.stringify(anchor)} on page ${check.page}`);
      }
    }

    const markdown = await ast.to('md', {imageMode: 'none'});
    assert.equal(typeof markdown.value, 'string');
    assert.ok(markdown.value.length >= paper.minimumMarkdownChars,
        `Extracted Markdown is unusually short: ${markdown.value.length} characters`);

    console.log(`PASS ${paper.file}: ${pages.length} pages, ${markdown.value.length} text characters`);
    if (ast.warnings.length) {
      console.warn(`  Parser warnings: ${ast.warnings.map(warning => warning.code).join(', ')}`);
    }
  } catch (error) {
    failed++;
    console.error(`FAIL ${paper.file}: ${error.message}`);
  }
}

console.log(`${manifest.papers.length - failed}/${manifest.papers.length} paper fixtures passed; ` +
    `${qaCases.cases.length} manual model QA cases validated (model inference not run).`);
if (failed) process.exitCode = 1;
