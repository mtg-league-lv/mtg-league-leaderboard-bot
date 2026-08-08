function initials(name) {
  return name
    .split(/\s+/)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const SORT_VALUE = {
  events: row => row.events,
  points: row => row.points,
  ppe: row => (row.events ? row.points / row.events : 0),
};

export function sortLeaderboard(rows, { col, dir }) {
  const value = SORT_VALUE[col] || SORT_VALUE.points;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) => sign * (value(a) - value(b)) || a.name.localeCompare(b.name),
  );
}

function perEvent(row) {
  return (row.events ? row.points / row.events : 0).toFixed(1);
}

function sortHead(col, label, sort) {
  const active = sort.col === col;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    `<button type="button" class="num sort${active ? ' active' : ''}" ` +
    `data-sort="${col}" aria-sort="${ariaSort}">${label}${arrow}</button>`
  );
}

export function renderLeaderboard(rows, sort = { col: 'points', dir: 'desc' }) {
  if (rows.length === 0) {
    return '<div class="empty">No results for this season.</div>';
  }
  const medal = ['#BA7517', '#888780', '#993C1D'];
  const head =
    '<div class="row head"><div>#</div><div>Player</div>' +
    sortHead('events', 'Events', sort) +
    sortHead('points', 'Points', sort) +
    sortHead('ppe', 'Pts/Event', sort) +
    '</div>';
  const body = rows
    .map((row, index) => {
      const rank = index + 1;
      const color = medal[index] || 'var(--muted)';
      return (
        `<div class="row">` +
        `<div class="rank" style="color:${color}">${rank}</div>` +
        `<div class="player"><span class="avatar">${initials(row.name)}</span>${row.name}</div>` +
        `<div class="num">${row.events}</div>` +
        `<div class="num strong">${row.points}<button class="why" data-index="${index}" aria-label="Points breakdown for ${row.name}">?</button></div>` +
        `<div class="num">${perEvent(row)}</div>` +
        `</div>`
      );
    })
    .join('');
  return head + body;
}

export function renderBreakdown(row) {
  const sections = row.breakdown
    .map(t => {
      const items = t.items
        .map(it => `<div class="bd-item"><span>${it.label}</span><span>+${it.points}</span></div>`)
        .join('');
      return (
        `<div class="bd-tournament">${t.tournament} · ${t.date}</div>` +
        items +
        `<div class="bd-subtotal"><span>subtotal</span><span>${t.subtotal}</span></div>`
      );
    })
    .join('');
  return (
    `<div class="bd-head">${row.name} — ${row.points} pts</div>` +
    `<div class="bd-body">${sections}` +
    `<div class="bd-total"><span>Total</span><span>${row.points}</span></div></div>`
  );
}
