import { playerLink } from './player-link.js';
import { manaIcons } from './mana.js';
import { titleCase } from '../lib/deck.js';

function statList(items, render, emptyText) {
  if (items.length === 0) return `<div class="profile-empty">${emptyText}</div>`;
  return `<ul class="profile-list">${items.map(render).join('')}</ul>`;
}

const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const fmtMultiplier = m => `×${Number.isInteger(m) ? m.toFixed(1) : m}`;

// Full eloScore history, newest first, grouped by tournament. Pure HTML.
export function renderRatingHistory(history) {
  const groups = [];
  for (const h of history) {
    const last = groups[groups.length - 1];
    if (last && last.id === h.tournamentId) last.items.push(h);
    else groups.push({ id: h.tournamentId, title: h.tournament, date: h.date, items: [h] });
  }
  const body = groups.map(g => {
    const net = g.items.reduce((sum, h) => sum + h.change, 0);
    const rows = g.items.map(h =>
      '<div class="rh-row">' +
      `<span class="rh-round">R${h.round}</span>` +
      `<span class="rh-opp">vs ${playerLink(h.opponent)} <span class="rh-score">${h.gamesWon}–${h.opponentGamesWon}</span></span>` +
      `<span class="rh-mult">${fmtMultiplier(h.multiplier)}</span>` +
      `<span class="rh-change ${h.change > 0 ? 'up' : h.change < 0 ? 'down' : ''}">${signed(h.change)}</span>` +
      `<span class="rh-after">${h.after}</span>` +
      '</div>').join('');
    const title = g.title === g.date ? g.date : `${g.title} · ${g.date}`;
    return `<div class="rh-tournament"><span>${title}</span><span>${signed(net)}</span></div>${rows}`;
  }).join('');
  return '<div class="rh-head">Rating history</div>' +
    `<div class="rh-body">${body}` +
    '<div class="rh-start"><span>Starting rating</span><span>500</span></div></div>';
}

function ratingLine(rating, history) {
  if (rating == null) return '';
  const why = history.length
    ? '<button type="button" class="why rating-why" aria-expanded="false" ' +
      'aria-controls="rating-history" aria-label="Rating history">?</button>'
    : '';
  const panel = history.length
    ? `<div id="rating-history" class="rating-history" hidden>${renderRatingHistory(history)}</div>`
    : '';
  // eloScore is all-time, so it shows whatever season is selected.
  return `<div class="profile-rating" title="League rating (eloScore)">Rating <strong>${rating}</strong>${why}</div>${panel}`;
}

function seasonPicker(seasons = [], selected = 'all') {
  if (seasons.length === 0) return '';
  const options = [{ key: 'all', label: 'Overall' }, ...seasons]
    .map(s => `<option value="${s.key}"${s.key === selected ? ' selected' : ''}>${s.label}</option>`)
    .join('');
  return `<select id="profile-season" class="profile-season" aria-label="Season">${options}</select>`;
}

export function renderProfile(name, profile, seasons = [], selectedSeason = 'all', options = {}) {
  const { showBack = true, achievements = [], rating = null, ratingHistory = [] } = options;
  const back = showBack ? '<a class="back-link" href="#">← Back</a>' : '';
  const header =
    `<div class="profile-header"><h1 class="profile-name">${name}</h1>` +
    `${seasonPicker(seasons, selectedSeason)}</div>`;
  const ratingHtml = ratingLine(rating, ratingHistory);

  if (profile.tournaments === 0) {
    return `${back}${header}${ratingHtml}<div class="profile-empty">No data for this player in this season.</div>`;
  }

  const r = profile.record;
  const summary =
    `<div class="profile-summary">${profile.tournaments} ` +
    `${profile.tournaments === 1 ? 'tournament' : 'tournaments'} · ${r.wins}-${r.draws}-${r.losses}</div>`;

  const p = profile.placements;
  const colours = profile.colours || { top: [], pct: 0 };
  const favColours = colours.top.length
    ? `<div class="placement fav-colours" title="Most played colour${colours.top.length > 1 ? 's' : ''}">` +
      `${manaIcons(colours.top.join(''))}<span class="pcount">${colours.pct}%</span></div>`
    : '';
  const placements =
    '<h2 class="profile-section">Placements</h2>' +
    '<div class="placements">' +
    `<div class="placement"><span class="medal">🥇</span><span class="pcount">${p.first}</span></div>` +
    `<div class="placement"><span class="medal">🥈</span><span class="pcount">${p.second}</span></div>` +
    `<div class="placement"><span class="medal">🥉</span><span class="pcount">${p.third}</span></div>` +
    favColours +
    '</div>';

  const achievementsSection = achievements.length
    ? '<h2 class="profile-section">Achievements</h2>' +
      '<div class="achievements">' +
      achievements.map(a => `<span class="achievement">${a}</span>`).join('') +
      '</div>'
    : '';

  const decks =
    '<h2 class="profile-section">Decks</h2>' +
    statList(
      profile.decks,
      d => `<li class="profile-item"><span class="deck-info">${titleCase(d.deck)}${manaIcons(d.colours)}</span><span class="profile-num">${d.tournaments} ${d.tournaments === 1 ? 'tournament' : 'tournaments'}</span></li>`,
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

  return back + header + ratingHtml + summary + achievementsSection + placements + decks + rivals + friends;
}
