// First-visit mobile toast suggesting the site be saved to the home screen as a
// PWA. Pure helpers (platform detection, show decision, HTML); the DOM wiring
// and localStorage live in app.js.
export const PWA_TOAST_SEEN_KEY = 'pwaToastSeen';

// 'ios' | 'android' | null (desktop / unknown — no toast).
export function mobilePlatform(userAgent, maxTouchPoints = 0) {
  const ua = userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports a desktop Safari UA; touch support gives it away.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

export function shouldShowPwaToast({ platform, standalone, seen }) {
  return Boolean(platform) && !standalone && !seen;
}

const HINTS = {
  ios: 'Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.',
  android: 'Open the browser menu <strong>⋮</strong> then <strong>Add to Home screen</strong> (or <strong>Install app</strong>).',
};

// canInstall: the browser offered a native install prompt (beforeinstallprompt).
export function renderPwaToast(platform, { canInstall = false } = {}) {
  const hint = canInstall
    ? 'Install it for quick, full-screen access from your home screen.'
    : HINTS[platform] ?? '';
  const install = canInstall
    ? '<button type="button" class="pwa-toast-install" data-pwa-install>Install</button>'
    : '';
  return `<div class="pwa-toast-body">`
    + `<div class="pwa-toast-title">📱 Add this site to your home screen</div>`
    + `<div class="pwa-toast-text">The league site works as an app. ${hint}</div>`
    + `</div>`
    + `<div class="pwa-toast-actions">${install}`
    + `<button type="button" class="pwa-toast-close" data-pwa-dismiss aria-label="Dismiss">×</button>`
    + `</div>`;
}
