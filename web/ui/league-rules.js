const RANKS = [
  ['Uninitiated', 'Your journey begins here.'],
  ['Sparkbearer', 'Dozens of tournaments ignite your spark.'],
  ['Planeswalker', 'An immeasurable number of tournaments have tempered you.\nYou now walk between worlds.'],
  ['Archmage', 'With your first win in the tournament, you proved your Archmage status.\nPower and skill set you apart.'],
  ['Paragon', 'For true Archmages who have proven their strength by 5 wins in the tournaments.\nParagon mages use the power to help others.\nYou are among the elite.'],
  ['Mythic Ascendant', 'You achieved all possible heights in your year-long journey.\nA symbol of true dedication.'],
  ['Living Legend', 'The highest honor.\nGranted to those who have reached all possible heights, and no one remembers when you started your journey.\nYour legacy defines the league.'],
  ['Forgotten Gods', 'Honoring veterans who spent years in the league and left their mark.\nA tribute to those who once shaped the league.\nThey are not gone… only remembered as legends.'],
];

function ranks() {
  return RANKS
    .map(([name, desc]) => `<div class="rank"><div class="rank-name">${name}</div><div class="rank-desc">${desc}</div></div>`)
    .join('');
}

export function renderLeagueRules() {
  return `
<div class="rules-page">
  <h1>Getting Started</h1>

  <h2>Building Your Collection</h2>
  <p>To participate, each player begins by creating a new collection consisting of the following:</p>
  <ul>
    <li>6 Standard-legal set boosters (this can be replaced by a pre-release kit and the promos that come with it).</li>
    <li>1 Standard-legal draft pool, which includes any rewards (promos, store credit, or individual cards) acquired during the draft.</li>
  </ul>

  <h2>Deckbuilding Rules</h2>
  <ul>
    <li>Players must build a Standard-legal deck using only the cards in their new collection.</li>
    <li>Basic lands are excluded from this restriction and may be freely added to the deck.</li>
    <li>Any rewards gained by playing with the deck during a tournament (e.g. promos, store credit, cards) are added to the collection and may be used to strengthen the deck.</li>
    <li>Standard-legal Universes Beyond cards cannot be used in the challenge. This also means you cannot open Universes Beyond boosters as your weekly booster (more info on weekly boosters in <em>Upgrading Your Collection</em>).</li>
  </ul>
  <p class="rules-note">Please set your server nickname to <strong>username (Real name)</strong> so you are automatically picked up for the leaderboard. Fastest way: click yourself in chat or the member list → <em>Edit profile</em> → <em>Edit per-server profile</em> (PC or mobile).</p>

  <h2>League Credit</h2>
  <p>“League credit” is a term we invented for the challenge. It is mainly earned through the standard tournament, as listed below, and often overlaps with MegaGame store credit, but is not the same. League credit is tracked individually and pinned in the general pins.</p>

  <h3>Earning League Credit</h3>
  <ul>
    <li>The main way of earning league credit is the MegaGame store credit earned by playing in standard tournaments. The same amount added to your MegaGame store credit is also added to your league credit.</li>
    <li>Players can sell unwanted cards from their league collection for league credit (this doesn't have to be to the MegaGame store — it can also be online or to any person). Any cards sold or bought this way are no longer considered “League legal”. The amount added to your league credit is the money you get after fees (e.g. 5% Cardmarket fee) or any other reduction.</li>
  </ul>

  <h3>Spending League Credit</h3>
  <p>League credit can ONLY be spent to purchase sealed card products (set / draft / play / collector boosters, boxes, bundles), as well as used for the entry fee in a Draft or Sealed event.</p>

  <h2>Upgrading Your Collection</h2>

  <h3>Weekly Booster Purchases</h3>
  <p>After attending a weekly Standard tournament, players may purchase 1 set / draft / play booster to expand their collection.</p>
  <p>If the tournament is canceled unexpectedly, attending players may still purchase their weekly booster.</p>

  <h3>The Release of a New Standard-Legal Set</h3>
  <p>When a new Standard-legal set is released, players may choose one of the following options to add to their collection:</p>
  <ul>
    <li>All cards and store credit earned from participating in a single prerelease event.</li>
    <li>6 Standard-legal set or play boosters (this can be from any Standard-legal set, it doesn't have to be the new one).</li>
  </ul>
  <p>This does not mean you need to have enough League Credit to participate in the prerelease event or to buy boosters. However, every prerelease event for the same set, after your first one, will cost league credit.</p>
  <p>(If the new set is a UB set you can participate in the Chaos Sealed or buy 6 non-UB boosters.)</p>

  <h2>Trading Rules</h2>
  <p>Players may trade individual cards or weekly boosters only with other participants in this challenge.</p>

  <h1>Additional Stuff</h1>

  <h2>Banning Cards for Winners</h2>
  <p>If a participant wins the weekly Standard tournament, each other participant may ban 1 card from the winner's deck (not a whole set of cards, only one copy). The people eligible for banning cards must also be part of the challenge.</p>
  <p>Banned cards remain prohibited from the winner's deck until they no longer win a tournament. If they win again while previous bans are still in effect, new bans stack with the old ones.</p>
  <p class="rules-note">Note: if you only run 2 copies of a card in your deck and both get banned, you cannot pull 2 more copies of the same card from your collection to replace them.</p>
  <p class="rules-attrib">Rush (Toms.L) [GoCA] — 02.06.2025</p>

  <h2>Store Championships</h2>
  <p>To ensure everyone has a fair chance at winning a Store Championship event, all bans are ignored for this event. The first-place finisher will not receive any card bans, and participants who had bans from previous weeks can compete as if those bans never existed. Any bans held before the Store Championship still apply when the next weekly Standard tournament takes place.</p>
  <p>Store Championship events never require you to enter with league credit.</p>

  <h2>Extra Fun</h2>
  <p><strong>Participating in Commander events</strong> — if a player wishes to suffer some more, they can create an EDH deck using cards from their league collection and participate in any of the commander events. The store credit earned from these events ISN'T added to league credit, but promo cards are. You are not required to play the entire commander event with the league deck — one match is sufficient.</p>

  <h1>🔮 MTG League Rank System</h1>
  <p>Climb through the ranks of our league and prove your mastery across the Multiverse. Your role reflects your experience, dedication, and victories.</p>
  <div class="ranks">${ranks()}</div>
</div>`;
}
