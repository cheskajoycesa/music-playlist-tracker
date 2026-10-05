/* ================= Cassettefy · js/deck.js =================
   The Deck page: the cassette, its song receipt, the tape dropdown and the deck buttons. */

/* ======================= DECK ======================= */
// Sizes a dropdown to the width of its selected text: short labels get a short box,
// longer labels only the space they need.
function fitSelectToText(sel, minWidth, maxWidth, extraWidth) {
  if (!sel) return;

  const selected = sel.options[sel.selectedIndex];
  const text = selected ? selected.textContent.trim() : '';
  const cs = getComputedStyle(sel);
  const probe = document.createElement('span');

  // The hidden measuring element copies the visible font settings, so it matches the real text.
  probe.textContent = text;
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  probe.style.pointerEvents = 'none';
  probe.style.fontFamily = cs.fontFamily;
  probe.style.fontSize = cs.fontSize;
  probe.style.fontWeight = cs.fontWeight;
  probe.style.letterSpacing = cs.letterSpacing;
  document.body.appendChild(probe);

  // Width = the text plus only the space needed for the arrow, padding and border.
  const textWidth = probe.getBoundingClientRect().width;
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, Math.ceil(textWidth + extraWidth)),
  );

  probe.remove();

  // The measured width is stored so CSS can size the visible dropdown exactly.
  sel.style.setProperty('--select-fit-width', width + 'px');
}

// Deck playlist: very short names stay compact; longer names grow naturally.
function fitDeckSelectToText() {
  fitSelectToText($('#deckSelect'), 0, 380, 84);
}

// Library sort: give “Recently added” enough room without making “Last played” huge.
function fitLibrarySortToText() {
  fitSelectToText($('#libSort'), 0, 260, 84); // same spacing as the Deck picker (24px + 48px padding, borders)
}


// Deck renderer: displays the selected cassette, track receipt, and playback controls.
function renderDeck() {
  const tape = Deck.tape(); // the tape being shown (not always the one playing)
  const browsing = Deck.browsing();

  const sel = $('#deckSelect');
  const option = (t) => {
    const selected = tape && tape.id === t.id ? ' selected' : '';
    return html`<option value="${t.id}"${selected}>${esc(t.name)}</option>`;
  };
  // Only while no tape is shown: a "Choose a tape…" placeholder. Without it the dropdown would show the
  // first tape's name over an empty deck, and picking that tape would do nothing (it's already "selected").
  const placeholder = tape ? '' : '<option value="" selected disabled>Choose a tape…</option>';
  sel.innerHTML = placeholder + Store.data.playlists.map(option).join('');
  // The Deck's tape dropdown is sized to the selected tape's name.
  fitDeckSelectToText();

  $('#deckTag').textContent = browsing ? 'Just looking' : 'Now spinning';
  $('#deckEmpty').hidden = !!tape;
  $('#deckMain').hidden = !tape;
  renderNowStrip(browsing);
  if (!tape) return;

  // While just looking at another tape, show its first song, stopped at the start.
  const t = browsing ? orderTracks(tape)[0] || null : Player.track();
  const spinning = !browsing && Player.playing;
  $('#deckTape').innerHTML = tapeHTML(tape, {
    side: t ? t.side : 'A',
    box: 'max-width: 540px; margin: 0 auto;',
  });
  $('#deckTape').classList.toggle('spinning', spinning);
  $('#deckLed').classList.toggle('lit', spinning);
  $('#deckLedLabel').textContent = spinning ? 'PLAYING' : browsing ? 'NOT LOADED' : 'PAUSED';
  $('#nowTitle').textContent = t ? t.title : 'Blank tape';
  const sideTracks = t ? tape.tracks.filter((x) => x.side === t.side) : [];
  if (browsing) {
    $('#nowArtist').textContent = t ? 'Press play to switch to this tape' : 'Add songs in the editor';
  } else {
    $('#nowArtist').textContent = t
      ? `${t.artist} · Side ${t.side}, track ${sideTracks.indexOf(t) + 1}${t.previewUrl ? ' · 30-sec preview' : ''}`
      : 'Add songs in the editor';
  }

  const k = $('#kPlay');
  k.innerHTML = icon(spinning ? 'pause' : 'play', 22);
  k.setAttribute('aria-label', spinning ? 'Pause' : browsing ? 'Play this tape' : 'Play');
  k.classList.toggle('lit', spinning);
  // Previous / next / stop / flip and the progress bar only make sense for the tape in the player.
  ['#kPrev', '#kNext', '#kStop', '#kFlip'].forEach((id) => ($(id).disabled = browsing));
  $('#progress').classList.toggle('off', browsing);
  $('#progress').setAttribute('aria-disabled', browsing);

  $('#deckFav').innerHTML =
    icon(tape.fav ? 'heartf' : 'heart', 20) + (tape.fav ? 'Favorite' : 'Add to favorites');
  $('#deckFav').setAttribute('aria-pressed', !!tape.fav);
  $('#deckEdit').href = '#edit/' + encodeURIComponent(tape.id);
  const playingId = browsing ? null : t && t.id;
  const oldList = $('#deckReceipt .r-songs');
  const oldScroll = oldList ? oldList.scrollTop : 0;
  $('#deckReceipt').innerHTML = receiptHTML(tape, {
    sel: playingId,
    mark: 'vol',
    note: 'CLICK A LINE TO PLAY IT',
  });
  keepReceiptScroll(tape.id + ':' + playingId, oldScroll);
  tick();
}
/**
 * The deck receipt's song list scrolls on its own (see .r-songs in style.css) and is redrawn on every
 * update. The listener's scroll position is kept; when the playing song or the tape changes, the
 * playing line is brought into view inside the list (without scrolling the page).
 */
function keepReceiptScroll(key, oldScroll) {
  const list = $('#deckReceipt .r-songs');
  if (!list) return;
  const changed = key !== keepReceiptScroll.last;
  const sameTape = keepReceiptScroll.last && keepReceiptScroll.last.split(':')[0] === key.split(':')[0];
  keepReceiptScroll.last = key;
  list.scrollTop = sameTape ? oldScroll : 0;
  const on = list.querySelector('.r-row.on');
  if (!changed || !on || list.scrollHeight <= list.clientHeight) return;
  const top = on.offsetTop,
    bottom = top + on.offsetHeight;
  if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = Math.max(0, top - list.clientHeight / 3);
  }
}
/** The "Now playing: … / Back to it" strip, shown while looking at a tape other than the one in the player. */
function renderNowStrip(browsing) {
  const strip = $('#deckNowStrip');
  const playing = Player.track();
  strip.hidden = !(browsing && playing);
  if (strip.hidden) return;
  const label = Player.playing ? 'Now playing:' : 'Paused on:';
  $('#deckNowText').innerHTML = html`
    ${icon(Player.playing ? 'vol' : 'pause', 20)}
    <span>${label} <b>${esc(playing.title)}</b> — ${esc(Player.tape.name)}</span>`;
}
$('#deckBackBtn').addEventListener('click', () => {
  Deck.viewId = null;
  renderDeck();
});
// Picking a tape here only opens it; the music keeps playing until you press play on it.
$('#deckSelect').addEventListener('change', (e) => {
  // Resized as soon as a different tape is picked.
  fitDeckSelectToText();
  if (!e.target.value) return;
  Deck.open(e.target.value);
  renderDeck();
});
$('#kPlay').addEventListener('click', () => {
  // Play on a tape you're only looking at switches the music to that tape.
  if (Deck.browsing()) Player.load(Deck.tape().id, null, 0, true);
  else Player.toggle();
});
// Deck buttons: previous, next, stop, flip to the other side, and volume.
$('#kPrev').addEventListener('click', () => Player.prev());
$('#kNext').addEventListener('click', () => Player.go(Player.idx + 1));
$('#kStop').addEventListener('click', () => Player.stop());
$('#kFlip').addEventListener('click', () => Player.flip());
$('#vol').addEventListener('input', (e) => {
  const volume = e.target.value / 10;

  // 30-second previews
  deckAudio.volume = volume;

  // Spotify Web Playback
  setSpotifyVolume(volume);
});
$('#deckFav').addEventListener('click', () => {
  const t = Deck.tape();
  if (!t) return;
  t.fav = !t.fav;
  t.likedAt = t.fav ? Date.now() : null;
  Store.save();
  renderDeck();
});
// Clicking a song on the deck's receipt plays it.
$('#deckReceipt').addEventListener('click', (e) => {
  const row = e.target.closest('[data-track]');
  if (!row) return;
  // A song on a tape you're only looking at: switch the music to that tape, starting at that song.
  if (Deck.browsing()) {
    Player.load(Deck.tape().id, row.dataset.track, 0, true);
    return;
  }
  Player.go(
    Player.order().findIndex((t) => t.id === row.dataset.track),
    true,
  );
});
// Jumps playback to the spot clicked on the progress bar.
function seekFromEvent(e) {
  if (Deck.browsing()) return;
  const r = $('#progress').getBoundingClientRect();
  Player.seek(((e.clientX - r.left) / r.width) * Player.dur());
}
$('#progress').addEventListener('click', seekFromEvent);
$('#progress').addEventListener('keydown', (e) => {
  if (Deck.browsing()) return;
  if (e.key === 'ArrowRight') {
    Player.seek(Player.pos + 5);
    e.preventDefault();
  }
  if (e.key === 'ArrowLeft') {
    Player.seek(Player.pos - 5);
    e.preventDefault();
  }
});
