# Mobile "add to home screen" toast — design

## Goal

On the first visit from a phone, show a toast telling the user the site is
available as a PWA and recommending they save it to the home screen.

## Behaviour

- Shown only when the device is mobile (iOS / iPadOS / Android, by user agent),
  the page is **not** already running as an installed app
  (`display-mode: standalone` / `navigator.standalone`), and it hasn't been
  shown before (`localStorage.pwaToastSeen`).
- Marked as seen as soon as it is shown, so it appears once. Storage access is
  wrapped in try/catch; in private modes it may show again, which is harmless.
- Platform-specific hint: iOS → Share → Add to Home Screen; Android → browser
  menu ⋮ → Add to Home screen / Install app.
- If the browser fires `beforeinstallprompt` (Chrome/Edge on Android), the toast
  swaps to an **Install** button that opens the native prompt.
- Dismissed with ×, after installing, or on `appinstalled`.

## Installability

- `web/manifest.webmanifest` (relative `start_url`/`scope` so it works under the
  GitHub Pages sub-path), `display: standalone`, 192/512 icons.
- `apple-touch-icon`, `theme-color` and Apple web-app meta tags in `index.html`.
- Icons are the pixel-art favicon upscaled (nearest-neighbour) on the dark
  background. No service worker: not required for installing, and avoids stale
  caching of live league data.

## Components

- `web/ui/pwa-toast.js` — pure `mobilePlatform`, `shouldShowPwaToast`,
  `renderPwaToast` (unit-tested in `tests/web/pwa-toast.test.mjs`).
- `app.js` `setupPwaToast()` — DOM, storage and install-prompt wiring; runs
  independently of data loading.
