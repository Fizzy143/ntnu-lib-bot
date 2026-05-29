import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibraryMessage } from '../src/bot/naturalLanguage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const casesPath = path.resolve(__dirname, '..', 'tests', 'natural-language-cases.json');

const raw = await readFile(casesPath, 'utf8');
const cases = JSON.parse(raw);

let passed = 0;

for (const testCase of cases) {
  const result = parseLibraryMessage(testCase.input, {
    today: testCase.today
  });

  try {
    if (testCase.expectNull) {
      assert.equal(result, null, `Expected null but got ${JSON.stringify(result)}`);
    } else {
      assert.ok(result, 'Expected a parsed result');
      const actual = pickExpectedFields(result, testCase.expected);
      assert.deepEqual(actual, testCase.expected);
    }
    passed += 1;
    console.log(`[pass] ${testCase.name}`);
  } catch (error) {
    console.error(`[fail] ${testCase.name}`);
    console.error(`  input: ${testCase.input}`);
    console.error(`  ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Passed ${passed}/${cases.length} natural-language cases.`);

function pickExpectedFields(result, expected) {
  return Object.fromEntries(
    Object.keys(expected).map(key => [key, result[key]])
  );
}
