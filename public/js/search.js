/* ================= Cassettefy · js/search.js =================
   The Search page: iTunes Search and Lookup API, results, 30-second previews, and recording a picked song
   onto one or more tapes. */

/* ======================= SEARCH (iTunes Search + Lookup API) ======================= */
// Search state: stores current iTunes results, selected item, loading state, and messages.
// addTo = a tape to tick in the "record onto" list the next time it draws (set by openSearchFor);
// saving = a song is being recorded; panelInView = the full "Add to a mixtape" panel is on screen.
const S = {
  results: [],
  selected: null,
  loading: false,
  error: '',
  heading: '',
  addTo: null,
  saving: false,
  panelInView: false,
};
// Loads an iTunes URL through a <script> tag (JSONP) and resolves with its data.
function jsonp(url) {
  /*
   * JSONP is the main way this app calls iTunes: it works from localhost
   * without a proxy server or a backend route.
   */
  return new Promise((resolve, reject) => {
    const callbackName = 'itunes_' + uid();
    const script = document.createElement('script');
    const requestUrl = new URL(url);

    requestUrl.searchParams.set('callback', callbackName);

    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('iTunes JSONP request timed out'));
    }, 15000);

    window[callbackName] = (data) => {
      cleanup();

      if (!data || !Array.isArray(data.results)) {
        reject(new Error('Invalid iTunes response'));
        return;
      }

      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Could not connect to iTunes'));
    };

    script.src = requestUrl.toString();
    document.head.appendChild(script);
  });
}

// Calls the iTunes API: path is 'search' or 'lookup'.
async function itunes(path, params) {
  /*
   * Builds the iTunes Search API URL and asks iTunes for it.
   * JSONP comes first: it avoids the browser's cross-site (CORS) limits while still
   * talking straight to Apple's public API. A normal fetch is the fallback where JSONP
   * is blocked. Both return the same { results: [] } data.
   */
  const query = new URLSearchParams({
    ...params,
    country: 'US',
    lang: 'en_us',
  });

  const url = 'https://itunes.apple.com/' + path + '?' + query.toString();

  try {
    return await jsonp(url);
  } catch (jsonpError) {
    /*
     * The fallback, for browsers that block script requests.
     */
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('iTunes HTTP ' + response.status);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.results)) {
      throw new Error('Invalid iTunes response');
    }

    return data;
  }
}
// Turns one iTunes result (song, album or artist) into the shape the results list uses; null for anything else.
function normalize(r) {
  const art = (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100bb', '120x120bb');
  if (r.wrapperType === 'track' || r.kind === 'song')
    return {
      kind: 'song',
      id: 'it' + r.trackId,
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName || '',
      genre: r.primaryGenreName || '',
      time: r.trackTimeMillis ? fmt(r.trackTimeMillis / 1000) : '',
      previewUrl: r.previewUrl || '',
      art,
    };
  if (r.wrapperType === 'collection')
    return {
      kind: 'album',
      id: 'al' + r.collectionId,
      lookup: r.collectionId,
      title: r.collectionName,
      artist: r.artistName,
      album: (r.trackCount || '?') + ' songs · ' + (r.releaseDate || '').slice(0, 4),
      genre: r.primaryGenreName || '',
      art,
    };
  if (r.wrapperType === 'artist')
    return {
      kind: 'artist',
      id: 'ar' + r.artistId,
      lookup: r.artistId,
      title: r.artistName,
      artist: r.primaryGenreName || 'Artist',
      album: 'Artist',
      genre: r.primaryGenreName || '',
      art: '',
    };
  return null;
}
// Search execution: queries the iTunes Search API and stores normalized results.
async function runSearch(q) {
  q = (q || '').trim();
  // The search box shows the searched words; a quick-search field, if the page has one, is cleared.
  $('#q').value = q;
  const quickInput = $('#quickInput');
  if (quickInput) quickInput.value = '';
  if (!q) {
    S.results = [];
    S.heading = 'Type something to search';
    renderResults();
    return;
  }
  const entity = $('#entity').value;
  S.loading = true;
  S.error = '';
  S.heading = 'Searching iTunes for “' + q + '”…';
  renderResults();
  try {
    const data = await itunes('search', {
      term: q,
      media: 'music',
      entity,
      limit: 25,
    });
    S.results = (data.results || []).map(normalize).filter(Boolean);
    S.heading = S.results.length + (S.results.length === 1 ? ' result' : ' results') + ' for “' + q + '”';
    const d = Store.data;
    d.searches = [q].concat(d.searches.filter((x) => x.toLowerCase() !== q.toLowerCase())).slice(0, 6);
    Store.save();
    renderChips();
  } catch (e) {
    console.error('iTunes search failed:', e);
    S.results = [];
    S.error = 'Couldn’t reach iTunes. Make sure localhost has internet access, then try again.';
    S.heading = 'Search failed';
  }
  S.loading = false;
  renderResults();
}
// Lists the songs on an album, or by an artist, picked from the search results.
async function openLookup(item) {
  S.loading = true;
  S.heading = 'Loading songs from ' + item.title + '…';
  renderResults();
  try {
    const data = await itunes('lookup', {
      id: item.lookup,
      entity: 'song',
      media: 'music',
      limit: 50,
    });
    S.results = (data.results || [])
      .filter((r) => r.wrapperType === 'track')
      .map(normalize)
      .filter(Boolean);
    S.heading = S.results.length + ' songs · ' + item.title;
  } catch (e) {
    S.error = 'Couldn’t load those songs.';
  }
  S.loading = false;
  renderResults();
}
// The recent-search buttons under the search box.
function renderChips() {
  $('#recentSearches').innerHTML = Store.data.searches
    .map((q) => html`<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`)
    .join('');
}
// Search result renderer: displays tracks and albums returned by the search.
function renderResults() {
  $('#resultsTitle').textContent = S.heading || 'Search the iTunes catalogue';
  const list = $('#resultsList');
  if (S.error) {
    list.innerHTML = html`<div class="empty-box">${esc(S.error)}</div>`;
    return;
  }
  if (S.loading) {
    list.innerHTML = html`
      <div class="empty-box" style="border-style: solid;"><span class="spin"></span>Digging through the crates…</div>`;
    return;
  }
  if (!S.results.length) {
    list.innerHTML = '<div class="empty-box">Try an artist, a song title or a genre — like “disco”.</div>';
    renderAddPanel();
    return;
  }
  list.innerHTML = S.results
    .map((r, i) => {
      const sel = S.selected && S.selected.id === r.id;

      // Cover art, or a colored vinyl placeholder when iTunes has none.
      const art = r.art
        ? html`
            <img src="${esc(r.art)}" alt="" width="54" height="54" loading="lazy"
              style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover; flex-shrink: 0;">`
        : html`
            <div style="width: 54px; height: 54px; flex-shrink: 0; border-radius: 8px; background: ${[RED, TEAL, DRED, DTEAL][i % 4]}; color: #FAF3E0; display: flex; align-items: center; justify-content: center;">
              ${icon('vinyl', 30)}
            </div>`;

      const preview =
        r.kind === 'song' && r.previewUrl
          ? html`
              <button type="button" class="icon-btn prev-btn" data-preview="${i}" aria-label="Preview ${esc(r.title)}"
                style="background: #1E6B65; color: #FAF3E0;">${icon('play', 18)}</button>`
          : '';

      // Songs get "+ Add"; albums and artists get "Show songs".
      const action =
        r.kind === 'song'
          ? html`
              <button type="button" class="add-btn${sel ? ' on' : ''}" data-pick="${i}" aria-pressed="${sel}"
                aria-label="Add ${esc(r.title)} to a mixtape">${icon('plus', 16)}${sel ? 'Adding' : 'Add'}</button>`
          : html`<button type="button" class="add-btn" data-lookup="${i}">${icon('chev', 16)}Show songs</button>`;

      return html`
        <div class="result${sel ? ' on' : ''}">
          ${art}${preview}
          <div style="flex-grow: 1; min-width: 0;">
            <div class="ellipsis" style="font-size: 19px; font-weight: 700;">${esc(r.title)}</div>
            <div class="ellipsis" style="font-size: 15px; color: #6B4A3A;">${esc(r.artist)}${r.album ? ' · ' + esc(r.album) : ''}</div>
          </div>
          <span class="hide-phone" style="font-size: 15px; color: #6B4A3A; font-variant-numeric: lining-nums tabular-nums;">${esc(r.time || '')}</span>
          ${action}
        </div>`;
    })
    .join('');
  renderAddPanel();
}
// Add-panel renderer: shows the selected song and destination tape options.
function renderAddPanel() {
  const sel = S.selected;
  const vinyl = html`<span style="display: flex;">${icon('vinyl', 30)}</span>`;

  if (sel) {
    const art = sel.art
      ? html`
          <img src="${esc(sel.art)}" alt="" width="46" height="46"
            style="width: 46px; height: 46px; border-radius: 6px; object-fit: cover; flex-shrink: 0;">`
      : vinyl;
    $('#addSel').innerHTML = html`
      ${art}
      <div style="min-width: 0;">
        <div class="ellipsis" style="font-size: 18px; font-weight: 700;">${esc(sel.title)}</div>
        <div class="ellipsis" style="font-size: 14px;">${esc(sel.artist)} · ${esc(sel.time)}</div>
      </div>`;
  } else {
    $('#addSel').innerHTML = html`
      ${vinyl}
      <div style="font-size: 16px;">Pick a song with <b>+ Add</b> to record it onto your tapes.</div>`;
  }

  // Tapes the listener already ticked stay ticked (this panel redraws whenever a song is picked),
  // plus the tape they came to fill from the editor's "Add songs from Search" button.
  const ticked = new Set($$('#addTapes input:checked').map((i) => i.value));
  if (S.addTo) ticked.add(S.addTo);
  S.addTo = null;

  // One checkbox per tape, with a little swatch of its shell color. A tape that already has the
  // picked song says "on it" and can't be ticked for it (its tick is kept for the next song).
  const tapeCheck = (t) => {
    const onIt = !!sel && hasSong(t, sel);
    const count = onIt
      ? html`<span class="on-it-note">${icon('check', 14)}on it</span>`
      : html`<span style="font-size: 14px; color: #6B4A3A;">${t.tracks.length}</span>`;
    return html`
      <label class="tape-check${onIt ? ' on-it' : ''}"${onIt ? ' title="This tape already has this song"' : ''}>
        <input type="checkbox" value="${t.id}"${ticked.has(t.id) ? ' checked' : ''}${onIt ? ' disabled' : ''}>
        <span style="width: 12px; height: 12px; border-radius: 3px; background: ${t.shell}; flex-shrink: 0;"></span>
        <span style="flex-grow: 1;">${esc(t.name)}</span>
        ${count}
      </label>`;
  };
  $('#addTapes').innerHTML =
    Store.data.playlists.map(tapeCheck).join('') ||
    '<p style="margin: 0;">No tapes yet — record one below.</p>';
  $('#addSave').disabled = !sel || S.saving;
  renderSaveBar();
}
/** Phones: the slim bar above the dock with the picked song, where it'll go, and a Record button. */
function renderSaveBar() {
  const sel = S.selected;
  const bar = $('#saveBar');
  // Not needed while the full panel is on screen (and it's hidden by CSS on wider screens).
  bar.hidden = !sel || S.panelInView;
  $('#view-search').classList.toggle('with-save-bar', !bar.hidden);
  if (!sel) return;
  const { ids, already } = addTargets();
  const n = ids.length;
  $('#saveBarTitle').textContent = sel.title;
  $('#saveBarArtist').textContent = sel.artist;
  if (n) $('#saveBarTapes').textContent = '→ ' + n + (n === 1 ? ' tape' : ' tapes');
  else if (already.length) $('#saveBarTapes').innerHTML = icon('check', 13) + ' already on it';
  else $('#saveBarTapes').textContent = '→ pick tapes';
  $('#saveBarTapes').setAttribute('aria-label', 'Choose tapes and side: ' + (n || 'none') + ' ticked');
  // Nothing to record when every ticked tape already has the song.
  $('#saveBarSave').disabled = !!S.saving || (!n && already.length > 0);
}
/** Ticked tapes that will get the picked song (ids), and ticked ones that already have it (names). */
function addTargets() {
  const checked = $$('#addTapes input:checked');
  return {
    ids: checked.filter((i) => !i.disabled).map((i) => i.value),
    already: checked
      .filter((i) => i.disabled)
      .map((i) => (Store.tape(i.value) || {}).name)
      .filter(Boolean),
  };
}
/** "A", "A and B", "A, B and C" */
const nameList = (names) =>
  names
    .map((x) => '“' + x + '”')
    .join(', ')
    .replace(/, ([^,]*)$/, ' and $1');
$('#addTapes').addEventListener('change', renderSaveBar);
// "→ 2 tapes" opens the full panel to change the tapes or the side.
$('#saveBarTapes').addEventListener('click', () =>
  $('#addPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }),
);
$('#saveBarSave').addEventListener('click', () => {
  if (!addTargets().ids.length && !addTargets().already.length) {
    toast('Pick at least one tape to record it onto.');
    $('#addPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  $('#addSave').click();
});
// The save bar hides while the full panel is visible, so the same controls don't show twice.
new IntersectionObserver(
  ([entry]) => {
    S.panelInView = entry.isIntersecting;
    renderSaveBar();
  },
  { root: $('#content'), threshold: 0.2 },
).observe($('#addPanel'));
/** Opens Search ready to add songs to one tape: that tape is ticked in the "record onto" list. */
// `name` comes from the editor, which may have just renamed the tape before this page reloads it.
function openSearchFor(id, name) {
  S.addTo = id;
  if (location.hash === '#search') route();
  else location.hash = '#search';
  const tapeName = name || (Store.tape(id) || {}).name;
  if (tapeName) toast('Search for songs, then press + Add to record them onto “' + tapeName + '”.');
  setTimeout(() => $('#q').focus(), 0);
}
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch($('#q').value);
});
$('#entity').addEventListener('change', () => {
  if ($('#q').value.trim()) runSearch($('#q').value);
});
$('#recentSearches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (b) runSearch(b.dataset.q);
});
$('#resultsList').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]'),
    look = e.target.closest('[data-lookup]'),
    pv = e.target.closest('[data-preview]');
  if (pick) {
    // No jump to the panel: it stays pinned beside the results, and on phones the save bar appears.
    S.selected = S.results[+pick.dataset.pick];
    renderResults();
  }
  if (look) openLookup(S.results[+look.dataset.lookup]);
  if (pv) {
    const r = S.results[+pv.dataset.preview];
    if (previewAudio.dataset.id === r.id && !previewAudio.paused) {
      previewAudio.pause();
      stopPreviewButtons();
      return;
    }
    if (Player.playing) Player.pause();
    previewAudio.src = r.previewUrl;
    previewAudio.dataset.id = r.id;
    previewAudio
      .play()
      .then(() => {
        stopPreviewButtons();
        pv.innerHTML = icon('pause', 18);
        pv.classList.add('playing');
      })
      .catch(() => toast('This preview can’t play right now.'));
  }
});
// Turns every playing 30-second preview button back into a play button.
function stopPreviewButtons() {
  $$('.prev-btn.playing').forEach((b) => {
    b.classList.remove('playing');
    b.innerHTML = icon('play', 18);
  });
}
previewAudio.addEventListener('ended', stopPreviewButtons);
// "Record": adds the picked song to every ticked tape, on the chosen side. When Spotify is connected it
// first looks up the same song on Spotify, so the deck can play the full song instead of a 30-second preview.
$('#addSave').addEventListener('click', async () => {
  const sel = S.selected;
  if (!sel || S.saving) return;

  // Tapes that already have this song are skipped: no duplicates on a tape.
  const { ids, already } = addTargets();

  if (!ids.length) {
    toast(
      already.length
        ? '“' + sel.title + '” is already on ' + nameList(already) + '.'
        : 'Tick at least one tape.',
    );
    return;
  }

  const side = ($('input[name="addSide"]:checked') || {}).value || 'B';

  // A second tap is blocked while the Spotify lookup below is still running (it would record the song twice).
  S.saving = true;
  renderAddPanel();

  // The same song on Spotify, if there is one (js/spotify.js)
  const spotifyUri = await findSpotifyUri(sel.title, sel.artist).finally(() => {
    S.saving = false;
  });

  console.log('Spotify match for added song:', sel.title, spotifyUri);

  let added = 0;
  ids.forEach((id) => {
    const t = Store.tape(id);

    const track = {
      id: uid(),
      side,
      title: sel.title,
      artist: sel.artist,
      genre: sel.genre,
      time: sel.time || '',
      previewUrl: spotifyUri ? '' : sel.previewUrl || '',
      spotifyUri: spotifyUri || '',
      art: sel.art,
    };

    // insertOnSide refuses a duplicate (also covers the same Spotify track under a different title).
    if (insertOnSide(t, track)) added++;
    else already.push(t.name);
  });

  Store.save();

  const skipped = already.length ? ' Already on ' + nameList(already) + '.' : '';
  toast(
    added
      ? '“' + sel.title + '” recorded onto ' + added + (added === 1 ? ' tape' : ' tapes') + '.' + skipped
      : '“' + sel.title + '” is already on ' + nameList(already) + '.',
  );

  // Done with this song: clear the pick (hides the save bar, "Adding" goes back to "+ Add").
  // The ticked tapes stay ticked for the next song.
  if (S.selected === sel) S.selected = null;
  renderResults();
});
