import { seasonKey, seasonLabel } from './lib/season.js';
import { seasonLeaderboard, seasonLeaderboardBefore } from './lib/leaderboard.js';
import { renderLeaderboard, renderBreakdown, sortLeaderboard, computeMovements } from './ui/leaderboard-view.js';
import { renderTournament } from './ui/tournament-view.js';
import { renderRules } from './ui/rules.js';

const state = { tournaments: [] };

async function boot() {
  try {
    const response = await fetch('data/tournaments.json');
    if (!response.ok) throw new Error('bad status');
    state.tournaments = (await response.json()).tournaments;
  } catch {
    const message = '<div class="empty">Couldn\'t load data.</div>';
    document.getElementById('lb-body').innerHTML = message;
    document.getElementById('td-body').innerHTML = message;
    return;
  }
  setupTabs();
  setupLeaderboard();
  setupTournaments();
  setupRules();
}

const SUMMER_2026 = '2026-2';

function setupRules() {
  const btn = document.getElementById('rules-btn');
  const modal = document.getElementById('rules-modal');
  const seasonSelect = document.getElementById('q-sel');
  document.getElementById('rules-content').innerHTML = renderRules();
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  // The rules are Summer-2026 specific, so only show the button for that season.
  const syncVisibility = () => {
    const isSummer = seasonSelect.value === SUMMER_2026;
    btn.hidden = !isSummer;
    if (!isSummer) close();
  };
  btn.addEventListener('click', open);
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  seasonSelect.addEventListener('change', syncVisibility);
  syncVisibility();
}

function setupTabs() {
  const tabLb = document.getElementById('tab-lb');
  const tabTd = document.getElementById('tab-td');
  const viewLb = document.getElementById('view-lb');
  const viewTd = document.getElementById('view-td');
  function show(which) {
    const isLb = which === 'lb';
    viewLb.hidden = !isLb;
    viewTd.hidden = isLb;
    tabLb.setAttribute('aria-selected', String(isLb));
    tabTd.setAttribute('aria-selected', String(!isLb));
  }
  tabLb.addEventListener('click', () => show('lb'));
  tabTd.addEventListener('click', () => show('td'));
}

function setupLeaderboard() {
  const select = document.getElementById('q-sel');
  const body = document.getElementById('lb-body');
  const pop = document.getElementById('breakdown-popover');
  let currentRows = [];
  const sort = { col: 'points', dir: 'desc' };

  const byKey = new Map();
  for (const t of state.tournaments) byKey.set(seasonKey(t.date), seasonLabel(t.date));
  const keys = [...byKey.keys()].sort().reverse();
  select.innerHTML = keys
    .map(k => `<option value="${k}">${byKey.get(k)}</option>`)
    .join('');

  function hidePopover() {
    pop.hidden = true;
    delete pop.dataset.index;
  }

  function render() {
    const key = select.value;
    currentRows = sortLeaderboard(seasonLeaderboard(state.tournaments, key), sort);
    const before = seasonLeaderboardBefore(state.tournaments, key);
    const previousRows = sortLeaderboard(before.rows, sort);
    const moves = computeMovements(currentRows, previousRows, before.hasPrevious);
    const count = state.tournaments.filter(t => seasonKey(t.date) === key).length;
    document.getElementById('q-meta').textContent =
      `${count} tournaments · ${currentRows.length} players`;
    body.innerHTML = renderLeaderboard(currentRows, sort, moves);
    hidePopover();
  }

  body.addEventListener('click', event => {
    const sortBtn = event.target.closest('.sort');
    if (sortBtn) {
      const col = sortBtn.dataset.sort;
      if (sort.col === col) sort.dir = sort.dir === 'desc' ? 'asc' : 'desc';
      else { sort.col = col; sort.dir = 'desc'; }
      render();
      return;
    }
    const btn = event.target.closest('.why');
    if (!btn) return;
    event.stopPropagation();
    if (!pop.hidden && pop.dataset.index === btn.dataset.index) {
      hidePopover();
      return;
    }
    pop.innerHTML = renderBreakdown(currentRows[Number(btn.dataset.index)]);
    pop.dataset.index = btn.dataset.index;
    pop.hidden = false;
    const rect = btn.getBoundingClientRect();
    pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
    let left = window.scrollX + rect.left;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    pop.style.left = `${left}px`;
  });

  document.addEventListener('click', event => {
    if (pop.hidden) return;
    if (pop.contains(event.target) || event.target.closest('.why')) return;
    hidePopover();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hidePopover();
  });

  select.addEventListener('change', render);
  render();
}

function setupTournaments() {
  const select = document.getElementById('t-sel');
  const sorted = [...state.tournaments].sort((a, b) => b.date.localeCompare(a.date));
  select.innerHTML = sorted
    .map(t => `<option value="${t.id}">${t.date} — ${t.name}</option>`)
    .join('');
  function render() {
    const tournament = state.tournaments.find(t => t.id === select.value);
    document.getElementById('td-body').innerHTML = renderTournament(tournament);
  }
  select.addEventListener('change', render);
  render();
}

boot();
