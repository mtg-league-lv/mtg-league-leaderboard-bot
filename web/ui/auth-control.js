// Top-right topbar control: a "Sign in" button when signed out, or the Google
// avatar (photo, else initials) linking to the Account route when signed in.
// Pure HTML string; click wiring lives in app.js.
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function renderAuthControl(user) {
  if (!user) {
    return '<button id="signin-btn" class="auth-signin" type="button">Sign in</button>';
  }
  const inner = user.avatarUrl
    ? `<img class="auth-avatar-img" src="${user.avatarUrl}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="avatar">${initials(user.name)}</span>`;
  return `<a class="auth-avatar" href="#account" aria-label="Account" title="${user.name}">${inner}</a>`;
}
