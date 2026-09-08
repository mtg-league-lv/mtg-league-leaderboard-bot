const MANA = new Set(['W', 'U', 'B', 'R', 'G']);

// Mana pips for a colour string like "WUBRG", wrapped in one element so a flex
// gap applies around the group rather than between each icon.
export function manaIcons(colours) {
  if (!colours) return '';
  const icons = [...colours.toUpperCase()]
    .filter(c => MANA.has(c))
    .map(c => `<img class="mana" src="icons/mana/${c}.svg" alt="${c}" />`)
    .join('');
  return icons ? `<div class="mana-colours">${icons}</div>` : '';
}
