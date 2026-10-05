/* ================= Cassettefy · js/favorites.js =================
   The Favorites page: favorite tapes as book spines on a shelf. */

/* ======================= FAVORITES ======================= */
let favSort = 'liked';
// Favorites renderer: lists tapes marked as favorites.
function renderFavorites() {
  let favs = Store.data.playlists.filter((t) => t.fav);
  favs.sort(
    favSort === 'az' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (b.likedAt || 0) - (a.likedAt || 0),
  );
  $('#favTag').textContent = favs.length + (favs.length === 1 ? ' tape' : ' tapes') + ' on the top shelf';
  // Book-spine view of each favorite; dark ink on the light shells, cream ink on the dark ones.
  const spine = (t) => {
    const ink = t.shell === PINK || t.shell === MUST || t.shell === '#E4D3A8' ? '#5C0C12' : PAPER;
    return html`
      <a href="#deck" class="spine" data-play="${t.id}" aria-label="Play ${esc(t.name)}" style="background: ${t.shell};">
        <span style="width: 100%; height: 7px; flex-shrink: 0; background: ${t.stripe};"></span>
        <span class="script spine-title" style="color: ${ink};">${esc(t.name)}</span>
        <span style="color: ${ink}; display: flex;">${icon('heartf', 18)}</span>
      </a>`;
  };
  $('#shelfRow').innerHTML =
    favs.map(spine).join('') +
    html`
      <a href="#library" class="spine empty" aria-label="Add more favorites from the library">${icon('plus', 26)}</a>
      <div class="hide-phone sign-board" style="margin-left: auto; align-self: center; flex: 0 1 300px; min-width: 0; text-align: center; transform: rotate(-3deg); padding: 8px 22px 14px;">
        <div class="script text-pink">Top shelf</div>
        <div class="text-cream" style="font-size: 16px; font-weight: 600;">tap a spine to play it</div>
      </div>`;

  const likedWhen = (t) =>
    timeLabel(t.likedAt)
      .replace(/^Today, .*/, 'today')
      .replace(/^Yesterday, .*/, 'yesterday');
  $('#favGrid').innerHTML =
    favs.map((t) => cardHTML(t, tapeMeta(t) + (t.likedAt ? ' · liked ' + likedWhen(t) : ''))).join('') +
    html`
      <a href="#library" class="empty-card">
        ${icon('heart', 34)}
        <span class="display" style="font-size: 18px;">ROOM ON THE SHELF</span>
        <span style="font-size: 16px; color: #6B4A3A;">Heart any tape in your Library to keep it here</span>
      </a>`;
  $('#favSortLiked').classList.toggle('on', favSort === 'liked');
  $('#favSortLiked').setAttribute('aria-pressed', favSort === 'liked');
  $('#favSortAZ').classList.toggle('on', favSort === 'az');
  $('#favSortAZ').setAttribute('aria-pressed', favSort === 'az');
}
$('#favSortLiked').addEventListener('click', () => {
  favSort = 'liked';
  renderFavorites();
});
$('#favSortAZ').addEventListener('click', () => {
  favSort = 'az';
  renderFavorites();
});
