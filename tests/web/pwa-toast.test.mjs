import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mobilePlatform, shouldShowPwaToast, renderPwaToast } from '../../web/ui/pwa-toast.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

test('detects iOS, iPadOS and Android; desktop is not mobile', () => {
  assert.equal(mobilePlatform(IPHONE), 'ios');
  assert.equal(mobilePlatform(IPADOS, 5), 'ios');
  assert.equal(mobilePlatform(IPADOS, 0), null);
  assert.equal(mobilePlatform(ANDROID), 'android');
  assert.equal(mobilePlatform(DESKTOP), null);
  assert.equal(mobilePlatform(undefined), null);
});

test('shows only on a first mobile visit outside the installed app', () => {
  assert.equal(shouldShowPwaToast({ platform: 'ios', standalone: false, seen: false }), true);
  assert.equal(shouldShowPwaToast({ platform: 'ios', standalone: false, seen: true }), false);
  assert.equal(shouldShowPwaToast({ platform: 'android', standalone: true, seen: false }), false);
  assert.equal(shouldShowPwaToast({ platform: null, standalone: false, seen: false }), false);
});

test('iOS toast explains Share → Add to Home Screen, with a dismiss button', () => {
  const html = renderPwaToast('ios');
  assert.ok(html.includes('Add to Home Screen'));
  assert.ok(html.includes('Share'));
  assert.ok(html.includes('data-pwa-dismiss'));
  assert.ok(!html.includes('data-pwa-install'));
});

test('Android toast points at the browser menu', () => {
  const html = renderPwaToast('android');
  assert.ok(html.includes('Add to Home screen'));
  assert.ok(!html.includes('data-pwa-install'));
});

test('offers an Install button when the browser supports the install prompt', () => {
  const html = renderPwaToast('android', { canInstall: true });
  assert.ok(html.includes('data-pwa-install'));
  assert.ok(html.includes('data-pwa-dismiss'));
});

test('manifest is installable: standalone, start url and 192/512 icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../web/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url);
  const sizes = manifest.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
});
