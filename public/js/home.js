/* ================= Cassettefy · js/home.js =================
   The Home page (totals and recently played tapes), plus the Play buttons and tape cards that open the Deck. */

/* ======================= HOME ======================= */
// Home renderer: builds the dashboard using current library and recent-play data.
function renderHome() {
  const d = Store.data,
    tracks = d.playlists.reduce((a, p) => a + p.tracks.length, 0);
  const np = Player.track();
  $('#homeStats').textContent = d.playlists.length + ' tapes · ' + tracks + ' tracks';
  let list = d.recent
    .map((r) => ({ r, t: Store.tape(r.playlistId) }))
    .filter((x) => x.t)
    .slice(0, 4);
  if (!list.length) list = d.playlists.slice(0, 4).map((t) => ({ t, r: null }));
  // Recently played tapes resume where they stopped; otherwise they start from the top.
  const jumpTile = ({ t, r }) => {
    const resume = r ? ` data-track="${r.trackId}" data-pos="${r.done ? 0 : r.position}"` : '';
    return html`
      <a href="#deck" data-play="${t.id}"${resume} class="jump" aria-label="Play ${esc(t.name)}">
        ${tapeHTML(t)}
        <div>
          <div style="font-size: 18px; font-weight: 700;">${esc(t.name)}</div>
          <div style="font-size: 15px; color: #6B4A3A;">${r ? esc(timeLabel(r.at)) : esc(tapeMeta(t))}</div>
        </div>
      </a>`;
  };
  $('#jumpGrid').innerHTML = list.length
    ? list.map(jumpTile).join('')
    : html`
        <p style="margin: 0; font-size: 18px;">
          No tapes yet. <a href="#library">Record your first mixtape</a> or <button type="button"
            class="btn-outline" data-samples style="height: 44px; font-size: 17px;">add sample tapes</button>
        </p>`;
}
// Every Play link and button with data-play="<tape id>" (Home, Library, Favorites, Recent): loads that
// tape into the deck and plays it, then shows the Deck. data-track / data-pos start at a song or spot.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-play]');
  if (!a) return;

  e.preventDefault();

  const id = String(a.dataset.play);
  const currentTapeId = Player.tape ? String(Player.tape.id) : null;

  // Library Play button + same tape already loaded:
  // resume from the current saved position.
  if (a.classList.contains('library-play') && currentTapeId === id) {
    if (!Player.playing) {
      Player.play();
    }
  } else {
    // Different tape (or another data-play link): loads it and plays.
    Player.load(id, a.dataset.track || null, +(a.dataset.pos || 0), true);
  }

  Deck.viewId = null; // show the tape that is now playing
  location.hash = '#deck';
});

// Clicking a tape card (outside its buttons) opens that tape on the Deck page.
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-open-deck]');
  if (!card) return;

  // Clicks on the card's own buttons and links (Play, Edit, heart, erase) are handled by those buttons.
  if (e.target.closest('a, button')) return;

  // Only open the tape on the Deck to look at its songs: whatever is playing keeps playing.
  Deck.open(card.dataset.openDeck);
  if (currentRoute === 'deck') renderDeck();

  location.hash = '#deck';
});
