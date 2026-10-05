/* ================= Cassettefy · js/editor-popup.js =================
   Opens the tape editor (edit.html) in a popup over the page, reloads the tapes when it closes, and handles
   the messages edit.html sends (close, play a tape, add songs from Search, a song was removed). */

/* ======================= editor popup ======================= */
// The editor remains a separate edit.html file, but it is loaded into an
// iframe so the main index.html stays visible behind the centered dialog.
function ensureEditorOverlay() {
  let overlay = $('#editorOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'editorOverlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'Edit mixtape dialog');
  overlay.innerHTML = '<iframe id="editorOverlayFrame" title="Edit mixtape" src="about:blank"></iframe>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEditorDialog(true);
  });

  return overlay;
}

function openEditorDialog(id) {
  const overlay = ensureEditorOverlay();
  const frame = $('#editorOverlayFrame');
  const src = 'edit.html' + (id ? '?id=' + encodeURIComponent(id) + '&embedded=1' : '?embedded=1');

  if (frame.src !== new URL(src, location.href).href) {
    frame.src = src;
  }
  overlay.hidden = false;
  document.body.classList.add('editor-open');
}

function closeEditorDialog(updateHash = true) {
  const overlay = $('#editorOverlay');
  if (!overlay) return;
  const wasOpen = !overlay.hidden;
  overlay.hidden = true;
  document.body.classList.remove('editor-open');
  const frame = $('#editorOverlayFrame');
  if (frame && wasOpen) {
    // The editor saves through its own copy of the tapes. This page waits for its last save (at most 2 s),
    // then reloads its own copy, so it never shows - or later saves over - an older version.
    let flushing = null;
    try {
      flushing = frame.contentWindow.cassettefyFlush && frame.contentWindow.cassettefyFlush();
    } catch (e) {
      /* editor page not loaded */
    }
    const timeout = new Promise((r) => setTimeout(r, 2000));
    Promise.race([Promise.resolve(flushing).catch(() => {}), timeout]).then(() => {
      if (overlay.hidden) frame.src = 'about:blank'; // unless the editor was reopened meanwhile
      reloadTapes();
    });
  }
  if (location.hash.slice(1).split('/')[0] === 'edit') {
    if (updateHash) {
      history.replaceState(null, '', location.pathname + location.search + '#library');
      route();
    } else {
      // The page underneath stays as it is; only "#edit/<id>" is dropped from the address. Otherwise
      // clicking the same tape's pencil again would ask for the same address, which the browser ignores.
      history.replaceState(null, '', location.pathname + location.search + '#' + currentRoute);
    }
  }
}

/** Reloads the tapes from the server and redraws, keeping the deck on the same song. */
async function reloadTapes() {
  if (!Store.online) return;
  await Store.refresh();
  if (Player.tape) {
    const current = Player.track();
    const fresh = Store.tape(Player.tape.id);
    if (fresh) {
      Player.tape = fresh;
      const i = current ? Player.order().findIndex((t) => t.id === current.id) : -1;
      if (i >= 0) Player.idx = i;
      else Player.idx = Math.min(Player.idx, Math.max(0, Player.order().length - 1));
    }
  }
  RENDER[currentRoute]();
  tick();
}

// edit.html uses postMessage when its Close/Back controls are pressed inside
// this iframe. Same-origin checks prevent unrelated pages from closing it.
window.addEventListener('message', (event) => {
  if (event.source !== $('#editorOverlayFrame')?.contentWindow) return;
  if (event.data?.type === 'cassettefy-close-editor') {
    // The X button closes the editor but keeps the underlying Deck view.
    closeEditorDialog(event.data?.stayDeck ? false : true);
    if (event.data?.stayDeck) {
      location.hash = '#deck';
      route();
    }
  }
  if (event.data?.type === 'cassettefy-play-tape') {
    const id = event.data.id || '';
    closeEditorDialog(false);
    location.hash = '#deck';
    if (id) Player.load(id, null, 0, false);
    route();
  }
  // "Add songs from Search" in the editor: open Search with that tape ticked in the add panel.
  if (event.data?.type === 'cassettefy-add-songs') {
    closeEditorDialog(false);
    openSearchFor(String(event.data.id || ''), event.data.name);
  }
  if (event.data?.type === 'cassettefy-track-deleted') {
    const tapeId = String(event.data.tapeId || '');
    const trackId = String(event.data.trackId || '');

    const current = Player.track();

    if (Player.tape && String(Player.tape.id) === tapeId && current && String(current.id) === trackId) {
      Player.playing = false;
      Player.stopTimers();

      deckAudio.pause();

      // Spotify is paused only if it is playing that song
      if (current.spotifyUri) pauseSpotifyIfPlaying('delete-track pause');

      Player.pos = 0;
      Player.persist(false);
      ui();
    }
  }
});
