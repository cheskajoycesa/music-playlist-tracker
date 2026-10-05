/* ================= Cassettefy · js/editor.js =================
   The tape editor (edit.html), shown as a popup over index.html. It lets the listener:
     - rename the tape, write liner notes, pick the genre, and pick the shell and stripe colors (Customize form)
     - see every change live on the cassette preview before saving
     - remove songs in the "Edit songs" popup (songs are added from the Search page)
     - jump to Search to add songs, or play the tape in the deck
   index.html opens this page in an iframe, and the two pages talk through postMessage.
   edit.html loads helpers.js, store.js, artwork.js and ui.js (shared with index.html) before this file. */

/* A small copy of the deck's Player. The editor uses it to keep the deck on the right song when songs are
   removed from the tape that is playing (see keepPlayerOn). The full player with Spotify is js/player.js,
   which only index.html loads (it needs the Deck page and Spotify). */
const Player = {
  tape: null, idx: 0, playing: false, pos: 0, timer: null,
  order() { return this.tape ? orderTracks(this.tape) : []; },
  track() { return this.order()[this.idx] || null; },
  usesAudio() { const t = this.track(); return !!(t && t.previewUrl); },
  dur() {
    const t = this.track(); if (!t) return 0;
    if (t.previewUrl && isFinite(deckAudio.duration) && deckAudio.duration > 0) return deckAudio.duration;
    return secs(t.time) || (t.previewUrl ? 30 : 0);
  },
  load(tapeId, trackId, pos, autoplay) {
    const tape = Store.tape(tapeId); if (!tape) return;
    this.halt();
    this.tape = tape;
    const i = trackId ? this.order().findIndex((t) => t.id === trackId) : 0;
    this.idx = Math.max(0, i); this.pos = pos || 0;
    this.cue(); this.persist(false);
    if (autoplay) this.play(); else ui();
  },
  cue() {
    const t = this.track();
    if (t && t.previewUrl) {
      if (deckAudio.getAttribute('src') !== t.previewUrl) deckAudio.src = t.previewUrl;
      try { deckAudio.currentTime = Math.min(this.pos, 29); } catch (e) { /* not loaded yet */ }
    } else { deckAudio.removeAttribute('src'); }
  },
  play() {
    const t = this.track();
    if (!this.tape) { toast('Load a tape in the deck first.'); return; }
    if (!t) { toast('This tape is blank. Add songs from Search or the editor.'); return; }
    previewAudio.pause(); stopPreviewButtons();
    this.playing = true;
    clearInterval(this.timer);
    if (this.usesAudio()) {
      deckAudio.play().catch(() => this.simulate());
    } else this.simulate();
    Store.logPlay(this.tape.id, t.id, this.pos);
    ui();
  },
  simulate() {
    // Songs typed in by hand have no audio, so the deck counts through their duration.
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.playing) return;
      this.pos += 1;
      if (this.pos >= this.dur()) this.next(true);
      else { tick(); if (Math.floor(this.pos) % 10 === 0) this.persist(false); }
    }, 1000);
  },
  pause() { this.playing = false; clearInterval(this.timer); deckAudio.pause(); this.persist(true); ui(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  halt() { this.playing = false; clearInterval(this.timer); deckAudio.pause(); },
  stop() { this.halt(); this.pos = 0; try { deckAudio.currentTime = 0; } catch (e) {} this.persist(true); ui(); },
  go(i, play) {
    const n = this.order().length; if (!n) return;
    const keep = play || this.playing;
    this.halt(); this.idx = (i + n) % n; this.pos = 0; this.cue(); this.persist(false);
    if (keep) this.play(); else ui();
  },
  next(auto) {
    const n = this.order().length;
    if (auto && this.idx >= n - 1) {
      this.halt(); this.pos = 0;
      if (this.track()) Store.logPlay(this.tape.id, this.track().id, 0, true);
      toast('End of the tape. Flip it or pick another.'); ui(); return;
    }
    this.go(this.idx + 1, auto);
  },
  prev() { if (this.pos > 3) this.seek(0); else this.go(this.idx - 1); },
  flip() {
    const cur = this.track(); if (!cur) return;
    const i = this.order().findIndex((t) => t.side !== cur.side);
    if (i < 0) { toast('Side ' + (cur.side === 'A' ? 'B' : 'A') + ' is blank.'); return; }
    this.go(i);
  },
  seek(s) {
    this.pos = Math.max(0, Math.min(s, this.dur()));
    if (this.usesAudio()) { try { deckAudio.currentTime = this.pos; } catch (e) {} }
    tick(); this.persist(false);
  },
  persist(log) {
    if (!this.tape) return;
    const t = this.track();
    Store.data.now = { playlistId: this.tape.id, trackId: t ? t.id : null, position: Math.floor(this.pos) };
    if (log && t) Store.logPlay(this.tape.id, t.id, this.pos); else Store.save();
  },
  info() { return this.tape ? { tape: this.tape, track: this.track(), pos: this.pos, dur: this.dur(), playing: this.playing } : null; }
};
deckAudio.addEventListener('timeupdate', () => { if (Player.usesAudio()) { Player.pos = deckAudio.currentTime; tick(); } });
deckAudio.addEventListener('loadedmetadata', tick);
deckAudio.addEventListener('ended', () => Player.next(true));

// Playback UI update: synchronizes progress, elapsed time, and player indicators.
function tick() {
  const info = Player.info();
  paintNowPlaying(info);
  if (!info) return;
  const pct = info.dur ? Math.min(100, (info.pos / info.dur) * 100) : 0;
  const fill = $('#progFill'); if (fill) fill.style.width = pct + '%';
  $$('[data-deck="elapsed"]').forEach((e) => (e.textContent = fmt(info.pos)));
  const tot = $('#progTotal'); if (tot) tot.textContent = fmt(info.dur);
  const bar = $('#progress'); if (bar) { bar.setAttribute('aria-valuenow', Math.round(info.pos)); bar.setAttribute('aria-valuemax', Math.round(info.dur)); bar.setAttribute('aria-valuetext', fmt(info.pos) + ' of ' + fmt(info.dur)); }
}
// Redraws everything that shows playback state.
function ui() {
  tick();
  if (currentRoute === 'deck') renderDeck();
  if (!Player.info()) paintNowPlaying(null);
}
// Play / previous / next buttons of the mini player.
$$('[data-np="play"]').forEach((b) => b.addEventListener('click', () => (Player.tape ? Player.toggle() : (location.hash = '#deck'))));
$$('[data-np="prev"]').forEach((b) => b.addEventListener('click', () => Player.prev()));
$$('[data-np="next"]').forEach((b) => b.addEventListener('click', () => Player.go(Player.idx + 1)));

/* The editor has no search preview buttons, so there is nothing to reset. */
function stopPreviewButtons() {}

/* ======================= EDIT MIXTAPE ======================= */
// Label stripe colors offered in the Customize form.
const STRIPES = [
  { name: 'Mustard', color: MUST }, { name: 'Soda pink', color: PINK }, { name: 'Diner teal', color: TEAL },
  { name: 'Cherry red', color: RED }, { name: 'Night teal', color: DTEAL }, { name: 'Paper', color: PAPER }
];
// Genre dropdown options: the same list as the New mixtape form (#genreList in index.html).
const GENRE_OPTIONS = ['Disco', 'Funk', 'Soul', 'Doo-wop', 'Rock & roll', 'Pop', 'Easy listening', 'Mixed'];
/**
 * Fills the Genre dropdown for a tape. A genre outside the list (e.g. "K-Pop" on a tape imported from Spotify,
 * or one typed in on an older version) is added as the first option, so opening the editor never changes a
 * tape's genre by itself; the listener can still switch it to any genre in the list.
 */
function fillGenreSelect(current) {
  current = current || 'Mixed';
  const options = GENRE_OPTIONS.includes(current) ? GENRE_OPTIONS : [current].concat(GENRE_OPTIONS);
  $('#edGenre').innerHTML = options.map((g) => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('');
  $('#edGenre').value = current;
}
// Editor state: which tape is open, and the Customize changes that haven't been saved yet (the draft).
const E = {
  id: null,          // tape being edited
  draft: null,       // customize fields not saved yet, shown live on the preview tape
  tape() { return Store.tape(this.id); },
  /** Opens a tape in the editor. `fresh` drops unsaved changes, e.g. when arriving from another page. */
  open(id, fresh) {
    if (id === this.id && !fresh) return;
    this.id = id || null; this.draft = null;
  }
};
/** After a tape's songs change, keeps the deck on the song it was on, or stops if that song is gone. */
function keepPlayerOn(tape, trackId) {
  if (Player.tape !== tape) return;
  const i = Player.order().findIndex((t) => t.id === trackId);
  if (i >= 0) { Player.idx = i; return; }
  Player.halt(); Player.idx = Math.min(Player.idx, Math.max(0, Player.order().length - 1)); Player.pos = 0;
  Player.cue(); Player.persist(false); ui();
}
const playingTrackId = (tape) => (Player.tape === tape && Player.track() ? Player.track().id : null);
// Draws the editor for the open tape: fills the form, the header and the "Edit songs (n)" button,
// or shows the "No tape chosen" message when there is no tape.
function renderEdit() {
  const tape = E.tape();
  $('#edEmpty').hidden = !!tape; $('#edMain').hidden = !tape; $('#edPlay').hidden = !tape;
  if (!tape) { $('#edTag').textContent = 'In the workshop'; return; }
  if (!E.draft) {
    E.draft = { name: tape.name, notes: tape.notes, genre: tape.genre, shell: tape.shell, stripe: tape.stripe };
    $('#edName').value = tape.name; $('#edNotes').value = tape.notes || ''; fillGenreSelect(tape.genre);
  }
  $('#edTag').textContent = tapeMeta(tape);
  $('#edPlay').dataset.play = tape.id; $('#edPlay').href = 'index.html?play=' + encodeURIComponent(tape.id) + '#deck';
  $('#edSongsBtn').textContent = 'Edit songs (' + tape.tracks.length + ')';
  renderEditPreview();
  if (!$('#songsOverlay').hidden) renderSongs();
}
// Live preview: redraws the cassette and the color swatches from the draft.
function renderEditPreview() {
  const d = E.draft;
  $('#edTape').innerHTML = tapeHTML(Object.assign({}, d, { name: d.name.trim() || 'Untitled tape' }), { box: 'max-width: 540px; margin: 0 auto;' });
  $('#edShells').innerHTML = SHELLS.map((s, i) => '<button type="button" class="swatch" data-shell="' + i + '" aria-label="' + s.name + ' shell" aria-pressed="' + (d.shell === s.shell) + '" style="background: ' + s.shell + ';"></button>').join('');
  $('#edStripes').innerHTML = STRIPES.map((s, i) => '<button type="button" class="swatch" data-stripe="' + i + '" aria-label="' + s.name + ' stripe" aria-pressed="' + (d.stripe === s.color) + '" style="background: ' + s.color + ';"></button>').join('');
}
// Typing in the name or notes, or picking a genre, updates the draft straight away (saved only with "Save changes").
$('#edTapeForm').addEventListener('input', () => {
  if (!E.draft) return;
  Object.assign(E.draft, { name: $('#edName').value, notes: $('#edNotes').value, genre: $('#edGenre').value });
  renderEditPreview();
});
// Shell color swatches: picking a shell also picks its matching stripe color.
$('#edShells').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shell]'); if (!b || !E.draft) return;
  const s = SHELLS[+b.dataset.shell]; E.draft.shell = s.shell; E.draft.stripe = s.stripe;
  renderEditPreview(); $('#edShells [data-shell="' + b.dataset.shell + '"]').focus();
});
// Label stripe swatches.
$('#edStripes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-stripe]'); if (!b || !E.draft) return;
  E.draft.stripe = STRIPES[+b.dataset.stripe].color;
  renderEditPreview(); $('#edStripes [data-stripe="' + b.dataset.stripe + '"]').focus();
});
// "Save changes": copies the draft onto the tape and saves it to the server (a name is required).
$('#edTapeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const tape = E.tape(); if (!tape || !E.draft) return;
  const name = $('#edName').value.trim();
  if (!name) { toast('Give your tape a name first.'); $('#edName').focus(); return; }
  Object.assign(tape, { name, notes: $('#edNotes').value.trim(), genre: $('#edGenre').value || 'Mixed', shell: E.draft.shell, stripe: E.draft.stripe });
  E.draft = null; Store.save();
  toast('“' + name + '” saved.'); renderEdit(); tick();
});
/* ---------- Edit songs popup: the tape's receipt with a remove button on each song ---------- */
function renderSongs() {
  const tape = E.tape();
  if (!tape) { closeSongs(); return; }
  $('#songsReceipt').innerHTML = receiptHTML(tape, { trash: true, note: 'ADD SONGS FROM THE SEARCH PAGE' });
}
function openSongs() {
  if (!E.tape()) return;
  renderSongs();
  $('#songsOverlay').hidden = false;
  $('#songsClose').focus();
}
function closeSongs() {
  $('#songsOverlay').hidden = true;
  $('#edSongsBtn').focus();
}
$('#edSongsBtn').addEventListener('click', openSongs);
$('#songsClose').addEventListener('click', closeSongs);
// Clicking the dimmed area around the popup, or pressing Esc, closes it too.
$('#songsOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSongs(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#songsOverlay').hidden) closeSongs(); });
// Removing a song: takes two clicks (the first turns the trash button into "Remove?"), then deletes the
// song, saves the tape, and tells index.html in case that song is playing in the deck.
$('#songsReceipt').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]'); if (!btn) return;
  confirmClick(btn, 'Remove?', () => {
    const tape = E.tape(), t = tape && tape.tracks.find((x) => x.id === btn.dataset.remove); if (!t) return;
    const playing = playingTrackId(tape);
    tape.tracks.splice(tape.tracks.indexOf(t), 1);
    keepPlayerOn(tape, playing);
    // Lets index.html stop the song if it's the one playing in the deck.
    window.parent.postMessage({ type: 'cassettefy-track-deleted', tapeId: tape.id, trackId: t.id }, '*');
    Store.save(); toast('“' + t.title + '” removed.'); renderEdit(); tick();
  });
});

/* ---------- Add songs from Search ---------- */
// Lets index.html wait for this page's last save before it reloads the tapes.
window.cassettefyFlush = () => Store.flush();
// "Add songs from Search": saves first, then opens the Search page with this tape ticked in its add panel.
$('#edAddSongs').addEventListener('click', async () => {
  const tape = E.tape(); if (!tape) return;
  await Store.flush();
  if (window.parent !== window) {
    // Inside the popup: index.html closes the editor and opens Search with this tape ticked.
    window.parent.postMessage({ type: 'cassettefy-add-songs', id: tape.id, name: tape.name }, '*');
  } else {
    location.href = 'index.html?addto=' + encodeURIComponent(tape.id);
  }
});

/* ======================= edit.html boot ======================= */

// True when this editor is shown inside the index.html popup (its URL has &embedded=1).
const EMBEDDED_EDITOR = new URLSearchParams(location.search).get('embedded') === '1';
if (EMBEDDED_EDITOR) document.documentElement.classList.add('embedded-editor');

// Closes the popup by asking index.html (the parent page) to close it. It calls index.html's
// closeEditorDialog() directly, and sends a postMessage instead if that call isn't possible.
// Returns false when this page is open on its own, not inside the popup.
function closeEditorFromParent(){
  if(window.parent === window) return false;

  try{
    if(typeof window.parent.closeEditorDialog === 'function'){
      window.parent.closeEditorDialog(true);
      return true;
    }
  }catch(err){
    // The parent page couldn't be reached directly; the message below is sent instead.
  }

  try{
    window.parent.postMessage({ type:'cassettefy-close-editor' }, '*');
    return true;
  }catch(err){
    return false;
  }
}

// "Back to library": closes the popup and shows the Library page again.
$('#edBack').addEventListener('click',(e)=>{
  if(closeEditorFromParent()) e.preventDefault();
});

// × button: closes the popup and leaves the page underneath as it was (e.g. still on the Deck).
$('.dialog-close').addEventListener('click',(e)=>{
  e.preventDefault();

  if(window.parent !== window){
    try{
      if(typeof window.parent.closeEditorDialog === 'function'){
        window.parent.closeEditorDialog(false);
        return;
      }
    }catch(err){
      // The parent page couldn't be reached directly; the message below is sent instead.
    }

    try{
      window.parent.postMessage({ type:'cassettefy-close-editor', stayDeck:true }, '*');
      return;
    }catch(err){
      // No parent page to message: handled like the standalone page below.
    }
  }

  // Opened on its own (not in the popup): goes to the Deck page.
  location.href='index.html#deck';
});

// "Play in deck": closes the popup and loads this tape into the deck on index.html.
// Opened on its own, the button is a plain link to index.html?play=<tape id>#deck.
$('#edPlay').addEventListener('click',(e)=>{
  if(window.parent !== window){
    e.preventDefault();
    const id=E.tape()?.id || '';

    try{
      if(typeof window.parent.closeEditorDialog === 'function'){
        window.parent.closeEditorDialog(false);
        window.parent.location.hash='#deck';
        if(id && window.parent.Player && typeof window.parent.Player.load === 'function'){
          window.parent.Player.load(id,null,0,false);
        }
        if(typeof window.parent.route === 'function') window.parent.route();
        return;
      }
    }catch(err){
      // The parent page couldn't be reached directly; the message below is sent instead.
    }

    window.parent.postMessage({ type:'cassettefy-play-tape', id }, '*');
  }
});

// The shared Player code checks which page is showing; the editor has no Deck page to redraw.
let currentRoute = 'edit';

// Start-up: loads the tapes from the server, opens the tape named in ?id=... and draws the editor.
(async function bootEditor() {
  const online = await Store.init();
  if (!online && API) toast('Can’t reach the server — working offline in this browser.');

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  E.open(id, true);
  renderEdit();
  tick();
})();
