import { playerLink } from './player-link.js';
import { manaIcons } from './mana.js';

function statList(items, render, emptyText) {
  if (items.length === 0) return `<div class="profile-empty">${emptyText}</div>`;
  return `<ul class="profile-list">${items.map(render).join('')}</ul>`;
}

export function renderProfile(name, profile) {
  const back = '<a class="back-link" href="#">← Back</a>';
  const header = `<div class="profile-header"><h1 class="profile-name">${name}</h1></div>`;

  if (profile.tournaments === 0) {
    return `${back}${header}<div class="profile-empty">No data for this player yet.</div>`;
  }

  const r = profile.record;
  const summary =
    `<div class="profile-summary">${profile.tournaments} ` +
    `${profile.tournaments === 1 ? 'tournament' : 'tournaments'} · ${r.wins}-${r.draws}-${r.losses}</div>`;

  const p = profile.placements;
  const placements =
    '<h2 class="profile-section">Placements</h2>' +
    '<div class="placements">' +
    `<div class="placement"><span class="medal">🥇</span><span class="pcount">${p.first}</span></div>` +
    `<div class="placement"><span class="medal">🥈</span><span class="pcount">${p.second}</span></div>` +
    `<div class="placement"><span class="medal">🥉</span><span class="pcount">${p.third}</span></div>` +
    '</div>';

  const decks =
    '<h2 class="profile-section">Decks</h2>' +
    statList(
      profile.decks,
      d => `<li class="profile-item"><span class="deck-info">${d.deck}${manaIcons(d.colours)}</span><span class="profile-num">${d.tournaments} ${d.tournaments === 1 ? 'tournament' : 'tournaments'}</span></li>`,
      'No decks recorded yet.',
    );

  const rivals =
    '<h2 class="profile-section">Top rivals</h2>' +
    statList(
      profile.rivals,
      x => `<li class="profile-item">${playerLink(x.name)}<span class="profile-num">${x.losses} ${x.losses === 1 ? 'loss' : 'losses'}</span></li>`,
      'No head-to-head data yet.',
    );

  const friends =
    '<h2 class="profile-section">Top friends</h2>' +
    statList(
      profile.friends,
      x => `<li class="profile-item">${playerLink(x.name)}<span class="profile-num">${x.games} ${x.games === 1 ? 'game' : 'games'}</span></li>`,
      'No head-to-head data yet.',
    );

  return back + header + summary + placements + decks + rivals + friends;
}
