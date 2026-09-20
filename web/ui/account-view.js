import { playerLink } from './player-link.js';

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Account page. `user` is { name, email, avatarUrl } or null (signed out);
// `playerName` is the linked player's display name or null. Pure HTML string;
// the sign-in / sign-out buttons are wired by delegation in app.js.
export function renderAccount(user, playerName) {
  const back = '<a class="back-link" href="#">← Back</a>';
  if (!user) {
    return back +
      '<div class="account">' +
      '<h1 class="profile-name">Your account</h1>' +
      '<p class="profile-empty">Sign in to view your account.</p>' +
      '<button id="signin-btn" class="auth-signin" type="button">Sign in with Google</button>' +
      '</div>';
  }
  const avatar = user.avatarUrl
    ? `<img class="account-avatar" src="${user.avatarUrl}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="avatar">${initials(user.name)}</span>`;
  const linked = playerName
    ? `<p class="account-linked">Linked to ${playerLink(playerName)}</p>`
    : '<p class="profile-empty">Not linked yet — ask an admin to link your account to a player.</p>';
  return back +
    '<div class="account">' +
    `<div class="account-head">${avatar}` +
    `<div><h1 class="profile-name">${user.name}</h1>` +
    `<div class="account-email">${user.email ?? ''}</div></div></div>` +
    linked +
    '<button id="signout-btn" class="auth-signin" type="button">Sign out</button>' +
    '</div>';
}
