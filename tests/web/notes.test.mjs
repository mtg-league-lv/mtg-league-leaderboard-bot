import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizeNotes } from '../../web/lib/notes.js';

test('escapeHtml escapes the five dangerous characters', () => {
  assert.equal(escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  assert.equal(escapeHtml('</textarea><script>alert(1)</script>'),
    '&lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
});

test('sanitizeNotes strips control chars, trims, and caps length', () => {
  assert.equal(sanitizeNotes('  hello  '), 'hello');
  assert.equal(sanitizeNotes('a\u0000b\u0007c'), 'abc');           // control chars removed
  assert.equal(sanitizeNotes('line1\nline2\tcol'), 'line1\nline2\tcol'); // keeps \n and \t
  assert.equal(sanitizeNotes('x'.repeat(2500)).length, 2000);      // capped
  assert.equal(sanitizeNotes(''), '');
  assert.equal(sanitizeNotes(null), '');
});
