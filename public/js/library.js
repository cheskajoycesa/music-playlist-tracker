/* ================= Cassettefy · js/library.js =================
   The Library page: tape cards with search, filter and sort; the New mixtape form; sample tapes; and the
   heart (favorite) and erase buttons on tape cards. */

/* ======================= LIBRARY ======================= */
// Library state: tracks filters, search text, sorting, and cassette shell selection.
const L = { filter: 'all', find: '', sort: 'played', swatch: 0 };
// When a tape was last played (0 if never), for the "Last played" sort.
function lastPlayed(id) {
  const r = Store.data.recent.find((x) => x.playlistId === id);
  return r ? r.at : 0;
}
/** One tape card (Library and Favorites): cassette, name, heart, and edit/play/erase buttons. */
function cardHTML(t, extra) {
  const name = esc(t.name);
  const favLabel = t.fav ? `Remove ${name} from favorites` : `Add ${name} to favorites`;
  return html`
    <article class="card library-card" data-open-deck="${t.id}">
      ${tapeHTML(t)}
      <div class="library-card-info">
        <div class="library-card-copy">
          <h3 class="library-card-title">${name}</h3>
          <div class="library-card-meta">${esc(extra || tapeMeta(t))}</div>
        </div>
        <span class="library-card-tools">
          <button type="button" class="icon-btn library-export" data-export-spotify="${t.id}"
            aria-label="Export ${name} to Spotify" title="Export to Spotify">${icon('export', 20)}</button>
          <button type="button" class="icon-btn library-favorite" data-fav="${t.id}" aria-pressed="${!!t.fav}"
            aria-label="${favLabel}">${icon(t.fav ? 'heartf' : 'heart', 24)}</button>
        </span>
      </div>
      <div class="library-card-actions">
        <a href="#edit/${encodeURIComponent(t.id)}" class="icon-btn library-edit" aria-label="Edit ${name}">${icon('pencil', 20)}</a>
        <a href="#deck" data-play="${t.id}" class="icon-btn library-play" aria-label="Play ${name}">${icon('play', 18)}</a>
        <button type="button" class="icon-btn library-delete" data-erase="${t.id}" aria-label="Erase ${name}">${icon('trash', 20)}</button>
      </div>
    </article>`;
}
// Library renderer: displays tapes with filtering, sorting, and creation controls.
function renderLibrary() {
  let list = Store.data.playlists.slice();
  if (L.filter === 'fav') list = list.filter((t) => t.fav);
  if (L.find)
    list = list.filter((t) => (t.name + ' ' + t.genre).toLowerCase().includes(L.find.toLowerCase()));
  const sorters = {
    played: (a, b) => lastPlayed(b.id) - lastPlayed(a.id) || b.createdAt - a.createdAt,
    added: (a, b) => b.createdAt - a.createdAt,
    az: (a, b) => a.name.localeCompare(b.name),
    tracks: (a, b) => b.tracks.length - a.tracks.length,
  };
  list.sort(sorters[L.sort]);
  // The sorting dropdown is sized to its selected label.
  fitLibrarySortToText();
  const favs = Store.data.playlists.filter((t) => t.fav).length;
  $('#chipAll').classList.toggle('on', L.filter === 'all');
  $('#chipAll').setAttribute('aria-pressed', L.filter === 'all');
  $('#chipFav').classList.toggle('on', L.filter === 'fav');
  $('#chipFav').setAttribute('aria-pressed', L.filter === 'fav');
  $('#chipFav').textContent = 'Favorites · ' + favs;
  const totalTracks = Store.data.playlists.reduce((a, p) => a + p.tracks.length, 0);
  $('#libTag').textContent = `${Store.data.playlists.length} mixtapes · ${totalTracks} tracks`;

  if (list.length) {
    $('#libGrid').innerHTML = list.map((t) => cardHTML(t)).join('');
  } else if (Store.data.playlists.length) {
    $('#libGrid').innerHTML =
      '<div class="empty-box">No tapes match. Try another word, or record a new mixtape.</div>';
  } else {
    $('#libGrid').innerHTML = html`
      <div class="empty-box" style="flex-direction: column;">
        Your library is empty. Record a mixtape with the form, or start with a few sample tapes.
        <button type="button" class="btn-outline" data-samples>${icon('tape', 20)}Add 6 sample tapes</button>
      </div>`;
  }
  renderSwatches();
}
// The shell color choices on the New mixtape form, plus its small preview tape.
function renderSwatches() {
  $('#swatches').innerHTML = SHELLS.map(
    (s, i) => html`
      <button type="button" class="swatch" data-swatch="${i}" aria-label="${s.name}"
        aria-pressed="${L.swatch === i}" style="background: ${s.shell};"></button>`,
  ).join('');
  $('#newTapePreview').innerHTML = miniTape(110, SHELLS[L.swatch].shell, SHELLS[L.swatch].stripe);
}
$('#chipAll').addEventListener('click', () => {
  L.filter = 'all';
  renderLibrary();
});
$('#chipFav').addEventListener('click', () => {
  L.filter = 'fav';
  renderLibrary();
});
$('#libFind').addEventListener('input', (e) => {
  L.find = e.target.value;
  renderLibrary();
});
$('#libSort').addEventListener('change', (e) => {
  L.sort = e.target.value;
  renderLibrary();
});
$('#swatches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-swatch]');
  if (b) {
    L.swatch = +b.dataset.swatch;
    renderSwatches();
  }
});
// New mixtape form: creates an empty tape with the chosen name, genre and shell color on the server,
// then opens it in the editor so songs can be added.
$('#newTapeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#ntName').value.trim();
  if (!name) {
    toast('Give your tape a name first.');
    $('#ntName').focus();
    return;
  }
  const btn = $('#newTapeForm button[type="submit"]');
  btn.disabled = true;
  try {
    const t = await Store.addTape(
      Store.newTape({
        name,
        notes: $('#ntNotes').value.trim(),
        genre: $('#ntGenre').value.trim() || 'Mixed',
        shellIdx: L.swatch,
      }),
    );
    $('#newTapeForm').reset();
    btn.disabled = false;
    toast('“' + t.name + '” recorded. Now add its songs.');
    location.hash = 'edit/' + encodeURIComponent(t.id);
  } catch (err) {
    btn.disabled = false;
    toast('The server didn’t save that tape. Is it still running?');
  }
});
// "Add 6 sample tapes" button, shown while the Library is empty.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-samples]');
  if (!b) return;
  b.disabled = true;
  b.textContent = 'Recording sample tapes…';
  try {
    await Store.loadSamples();
    toast('6 sample tapes added to your library.');
  } catch (err) {
    toast('The server didn’t save the sample tapes.');
  }
  RENDER[currentRoute]();
});
// Heart (favorite) and erase buttons on tape cards (Library, Favorites, Recent). Erasing takes two clicks
// and deletes the tape from the server; if it was playing, the deck stops.
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]'),
    erase = e.target.closest('[data-erase]');
  if (fav) {
    const t = Store.tape(fav.dataset.fav);
    if (!t) return;
    t.fav = !t.fav;
    t.likedAt = t.fav ? Date.now() : null;
    Store.save();
    toast(t.fav ? '“' + t.name + '” is on the top shelf.' : '“' + t.name + '” left the top shelf.');
    RENDER[currentRoute]();
  }
  if (erase) {
    confirmClick(erase, 'Erase?', async () => {
      const id = erase.dataset.erase,
        t = Store.tape(id);
      try {
        await Store.removeTape(id);
      } catch (err) {
        toast('The server didn’t erase that tape. Try again.');
        return;
      }
      if (Player.tape && Player.tape.id === id) {
        Player.halt();
        Player.tape = null;
      }
      toast('“' + (t ? t.name : 'Tape') + '” erased.');
      RENDER[currentRoute]();
      ui();
    });
  }
});
