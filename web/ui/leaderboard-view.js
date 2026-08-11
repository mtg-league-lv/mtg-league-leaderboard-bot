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

// Position change of each current row versus the previous (pre-latest-tournament)
// board, both already sorted by the active sort. Returns name -> descriptor.
export function computeMovements(currentSorted, previousSorted, hasPrevious) {
  const moves = new Map();
  if (!hasPrevious) return moves;
  const prevPos = new Map();
  previousSorted.forEach((row, i) => prevPos.set(row.name, i + 1));
  currentSorted.forEach((row, i) => {
    if (!prevPos.has(row.name)) {
      moves.set(row.name, { type: 'new', by: 0 });
      return;
    }
    const delta = prevPos.get(row.name) - (i + 1);
    const type = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    moves.set(row.name, { type, by: Math.abs(delta) });
  });
  return moves;
}

function moveCell(move) {
  if (!move || move.type === 'same') return '<div class="num move"></div>';
  if (move.type === 'new') return '<div class="num move new">NEW</div>';
  const arrow = move.type === 'up' ? '▲' : '▼';
  return `<div class="num move ${move.type}">${arrow} <b>${move.by}</b></div>`;
}

function sortHead(col, label, short, sort) {
  const active = sort.col === col;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    `<button type="button" class="num sort${active ? ' active' : ''}" ` +
    `data-sort="${col}" aria-sort="${ariaSort}">` +
    `<span class="hd-full">${label}</span><span class="hd-short">${short}</span>${arrow}</button>`
  );
}

export function renderLeaderboard(rows, sort = { col: 'points', dir: 'desc' }, moves = new Map()) {
  if (rows.length === 0) {
    return '<div class="empty">No results for this season.</div>';
  }
  const medal = ['#BA7517', '#888780', '#993C1D'];
  const head =
    '<div class="row head"><div>#</div><div>Player</div>' +
    sortHead('events', 'Events', 'Ev', sort) +
    sortHead('points', 'Points', 'Pts', sort) +
    sortHead('ppe', 'Pts/Event', 'P/E', sort) +
    '<div class="num" title="Change">±</div>' +
    '</div>';
  const body = rows
    .map((row, index) => {
      const rank = index + 1;
      const color = medal[index] || 'var(--muted)';
      return (
        `<div class="row">` +
        `<div class="rank" style="color:${color}">${rank}</div>` +
        `<div class="player"><span class="avatar">${initials(row.name)}</span><span class="pname">${row.name}</span></div>` +
        `<div class="num">${row.events}</div>` +
        `<div class="num strong">${row.points}<button class="why" data-index="${index}" aria-label="Points breakdown for ${row.name}">?</button></div>` +
        `<div class="num">${perEvent(row)}</div>` +
        moveCell(moves.get(row.name)) +
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
