import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPersonalNotes } from '../../web/ui/notes-view.js';

test('renders the hint placeholder and a Save button', () => {
  const html = renderPersonalNotes('');
  assert.ok(html.includes('Personal notes'));
  assert.ok(html.includes('track your League Credit'));
  assert.ok(html.includes('id="notes-text"'));
  assert.ok(html.includes('id="notes-save"'));
});

test('escapes saved notes so markup cannot break out of the textarea', () => {
  const html = renderPersonalNotes('</textarea><script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;/textarea&gt;&lt;script&gt;'));
});

test('shows the saved notes text (escaped) inside the textarea', () => {
  const html = renderPersonalNotes('owes me 3 credit');
  assert.ok(html.includes('>owes me 3 credit</textarea>'));
});
