import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRules } from '../../web/ui/rules.js';

test('renderRules shows the season title and all six scoring rules', () => {
  const html = renderRules();
  assert.match(html, /Rules for the Summer 2026 season/);
  assert.match(html, /1st place[\s\S]*\+3/);
  assert.match(html, /2nd place[\s\S]*\+2/);
  assert.match(html, /3rd place[\s\S]*\+1/);
  assert.match(html, /win[\s\S]*\+2/);
  assert.match(html, /tie[\s\S]*\+1/);
  assert.match(html, /[Aa]ttend[\s\S]*\+1/);
});

test('renderRules renders exactly six rule rows', () => {
  const html = renderRules();
  assert.equal((html.match(/class="rule"/g) || []).length, 6);
});
