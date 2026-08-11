const RULES = [
  ['1st place in a tournament', 3],
  ['2nd place in a tournament', 2],
  ['3rd place in a tournament', 1],
  ['Each win in a tournament', 2],
  ['Each tie in a tournament', 1],
  ['Attending a tournament', 1],
];

export function renderRules() {
  const items = RULES
    .map(([label, pts]) => `<li class="rule"><span>${label}</span><span class="rule-pts">+${pts}</span></li>`)
    .join('');
  return (
    `<h2 class="rules-title" id="rules-title">Rules for the Summer 2026 season</h2>` +
    `<ul class="rules-list">${items}</ul>`
  );
}
