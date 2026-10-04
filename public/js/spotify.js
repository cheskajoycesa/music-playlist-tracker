/* ================= Cassettefy · Spotify =================
   Everything that talks to Spotify lives in this file:
     1. Settings          Client ID, permissions (scopes) and the Redirect URI
     2. Login             Authorization Code with PKCE, tokens, and the spFetch() Web API helper
     3. Playback          the Web Playback SDK player and the helpers the deck uses (play, pause, seek, …)
     4. Song matching     finds the Spotify version of a song added from Search (iTunes)
     5. Export            a tape -> a new playlist in the listener's Spotify library
     6. Import            the listener's Spotify playlists -> tapes in the Library
     7. Profile page      the Spotify part of the Profile page, and its buttons
     8. SDK start-up      onSpotifyWebPlaybackSDKReady, called by https://sdk.scdn.co/spotify-player.js

   index.html loads this file just before its own script. Functions here may use what that script
   defines ($, Store, Player, toast, …), because they only run after the page has started. Code that
   runs straight away (the button listeners below) only uses plain DOM calls for that reason. */

/* ======================= 1. Settings ======================= */
/* Paste your app's Client ID from https://developer.spotify.com/dashboard
   In the Spotify dashboard, add this page's exact URL as a Redirect URI. With the Node server that is
   http://127.0.0.1:3000/index.html  (open the app at that same address — Spotify doesn't accept "localhost"). */
const SPOTIFY_CLIENT_ID = 'e5d9a005633045a296b672629fff872a';
const SPOTIFY_SCOPES =
  'streaming user-read-email user-modify-playback-state playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-read-private';
const redirectUri = () => 'http://127.0.0.1:3000/index.html';

// Spotify state: stores connection status, imported playlists, and import progress.
const SP = { me: null, lists: null, busy: false, msg: '' };

/* ======================= 2. Login (Authorization Code with PKCE) ======================= */
const b64url = (bytes) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
// Spotify authorization: starts the Authorization Code with PKCE connection flow.
async function spotifyConnect() {
  if (!SPOTIFY_CLIENT_ID) {
    SP.msg = 'setup';
    renderProfile();
    return;
  }
  if (!window.crypto || !crypto.subtle) {
    SP.msg = 'Spotify login needs a secure page (https or 127.0.0.1).';
    renderProfile();
    return;
  }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const state = uid() + uid();
  try {
    sessionStorage.setItem('sp_verifier', verifier);
    sessionStorage.setItem('sp_state', state);
  } catch (e) {}
  location.href =
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });
}
// Gets a Spotify access token (from a login code or a refresh token) and saves it.
async function spotifyToken(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!r.ok) throw new Error('token ' + r.status);
  const j = await r.json();
  console.log('Spotify token scopes:', j.scope);
  const old = Store.data.spotify || {};
  Store.data.spotify = {
    access: j.access_token,
    refresh: j.refresh_token || old.refresh,
    exp: Date.now() + (j.expires_in - 60) * 1000,
  };
  Store.save();
}
// Spotify callback handler: exchanges the returned authorization code for tokens.
// Called by boot() in index.html; returns true if this page load was the return from Spotify's login.
async function handleSpotifyCallback() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return false;
  let verifier = null,
    state = null;
  try {
    verifier = sessionStorage.getItem('sp_verifier');
    state = sessionStorage.getItem('sp_state');
  } catch (e) {}
  history.replaceState(null, '', location.pathname + '#profile');
  if (p.get('error')) {
    SP.msg = 'Spotify login was cancelled.';
    return true;
  }
  if (!verifier || p.get('state') !== state) {
    SP.msg = 'That Spotify login link expired. Please try again.';
    return true;
  }
  try {
    await spotifyToken({
      grant_type: 'authorization_code',
      code: p.get('code'),
      redirect_uri: redirectUri(),
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    });
    toast('Spotify connected.');
  } catch (e) {
    SP.msg = 'Spotify didn’t accept the login. Check the Client ID and Redirect URI.';
  }
  return true;
}
// GET request to the Spotify Web API, refreshing the access token first when it has expired.
async function spFetch(path) {
  const s = Store.data.spotify;
  if (!s) throw new Error('not connected');
  if (Date.now() > s.exp && s.refresh)
    await spotifyToken({
      grant_type: 'refresh_token',
      refresh_token: s.refresh,
      client_id: SPOTIFY_CLIENT_ID,
    });
  const r = await fetch('https://api.spotify.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + Store.data.spotify.access },
  });
  if (r.status === 401) {
    Store.data.spotify = null;
    Store.save();
    SP.me = null;
    throw new Error('expired');
  }
  if (!r.ok) throw new Error('spotify ' + r.status);
  return r.json();
}

/* ======================= 3. Playback (Web Playback SDK) ======================= */
// Spotify Web Playback player and its device id, set up by onSpotifyWebPlaybackSDKReady at the end of this file.
let spotifyPlayer = null;
let spotifyDeviceId = null;

/** True once the Spotify player on this page exists (the deck then sends Spotify songs to it). */
const spotifyReady = () => !!spotifyPlayer;

// Starts a Spotify song on this page's Spotify player; resolves to true if Spotify accepted it.
async function playSpotifyTrack(uri, positionSeconds = 0) {
  if (!spotifyPlayer || !spotifyDeviceId) {
    toast('Spotify player is not ready yet.');
    return false;
  }

  const token = Store.data.spotify?.access;

  if (!token) {
    toast('Please connect Spotify first.');
    return false;
  }

  try {
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/play?device_id=' + encodeURIComponent(spotifyDeviceId),
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [uri],
          position_ms: Math.floor(positionSeconds * 1000),
        }),
      },
    );

    if (!response.ok) {
      console.error('Spotify playback failed:', response.status, await response.text());

      toast('Spotify could not start the song.');
      return false;
    }

    console.log('Spotify playback started:', uri);
    return true;
  } catch (error) {
    console.error('Spotify playback error:', error);
    toast('Spotify playback failed.');
    return false;
  }
}

/** How far into the song Spotify is, in seconds, or null if Spotify isn't playing anything. */
async function spotifyPosition() {
  if (!spotifyPlayer) return null;
  const state = await spotifyPlayer.getCurrentState();
  // Spotify gives position in milliseconds
  return state ? state.position / 1000 : null;
}

/** Pauses Spotify. `why` names the deck action in the console if Spotify refuses. */
function pauseSpotify(why) {
  if (!spotifyPlayer) return;
  spotifyPlayer.pause().catch((error) => {
    console.error('Spotify ' + why + ' error:', error);
  });
}

/** Pauses Spotify only if it is actually playing something right now. */
function pauseSpotifyIfPlaying(why) {
  if (!spotifyPlayer) return;
  spotifyPlayer
    .getCurrentState()
    .then((state) => {
      if (state && !state.paused) {
        return spotifyPlayer.pause();
      }
    })
    .catch((error) => {
      console.error('Spotify ' + why + ' error:', error);
    });
}

/** Pauses Spotify and rewinds it to the start of the song (the deck's Stop button). */
function stopSpotify() {
  if (!spotifyPlayer) return;
  spotifyPlayer
    .pause()
    .then(() => spotifyPlayer.seek(0))
    .catch((error) => {
      console.error('Spotify stop error:', error);
    });
}

/** Jumps to `seconds` into the Spotify song. */
function seekSpotify(seconds) {
  if (!spotifyPlayer) return;
  spotifyPlayer.seek(Math.floor(seconds * 1000)).catch((error) => {
    console.error('Spotify seek error:', error);
  });
}

/** Sets the Spotify player's volume (0 to 1). */
function setSpotifyVolume(volume) {
  if (!spotifyPlayer) return;
  spotifyPlayer.setVolume(volume).catch((error) => {
    console.error('Spotify volume error:', error);
  });
}

/* ======================= 4. Song matching ======================= */
// Finds the Spotify version of a song added from Search; resolves to its Spotify URI, or '' if none.
async function findSpotifyUri(title, artist) {
  if (!Store.data.spotify) {
    return '';
  }

  try {
    // Use the first/main artist for matching
    const mainArtist = (artist || '').split(',')[0].trim();

    const query = 'track:' + title + ' artist:' + mainArtist;

    const result = await spFetch('search?q=' + encodeURIComponent(query) + '&type=track&limit=5');

    const tracks = result.tracks?.items || [];

    if (!tracks.length) {
      console.warn('No Spotify match found for:', title, artist);
      return '';
    }

    // Try to find the closest exact match
    const normalize = (text) =>
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const wantedTitle = normalize(title);
    const wantedArtist = normalize(mainArtist);

    const match = tracks.find((tr) => {
      const sameTitle = normalize(tr.name) === wantedTitle;

      const sameArtist = (tr.artists || []).some((a) => normalize(a.name) === wantedArtist);

      return sameTitle && sameArtist;
    });

    const selected = match || tracks[0];

    console.log('Matched iTunes song to Spotify:', title, '→', selected.name, selected.uri);

    return selected.uri || '';
  } catch (error) {
    console.error('Spotify song matching error:', error);
    return '';
  }
}

/* ======================= 5. Export (tape -> Spotify playlist) ======================= */
async function createSpotifyPlaylist(name) {
  const token = Store.data.spotify?.access;

  if (!token) {
    throw new Error('Spotify is not connected.');
  }

  const response = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      public: false,
      description: 'Exported from Cassettefy',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Spotify playlist creation failed:', error);
    // Logins from before export existed lack the "create playlists" permission.
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Spotify needs permission to create playlists: disconnect Spotify on your Profile, then log in again.',
      );
    }
    throw new Error('Could not create Spotify playlist.');
  }

  return response.json();
}

async function addSongsToSpotifyPlaylist(playlistId, uris) {
  const token = Store.data.spotify?.access;

  if (!token) {
    throw new Error('Spotify is not connected.');
  }

  if (!uris.length) {
    return;
  }

  const response = await fetch(
    'https://api.spotify.com/v1/playlists/' + encodeURIComponent(playlistId) + '/items',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: uris,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Adding songs to Spotify failed:', error);
    throw new Error('Could not add songs to Spotify playlist.');
  }

  return response.json();
}

/**
 * Is this playlist still in the user's Spotify library? "Deleting" a playlist in Spotify only removes it
 * from the library (Spotify still returns the playlist itself), so this looks through the library's list.
 * Throws if Spotify can't be reached, so an export never goes ahead on a guess.
 */
async function inSpotifyLibrary(playlistId) {
  let next = 'me/playlists?limit=50';
  for (let pages = 0; next && pages < 40; pages++) {
    let page;
    try {
      page = await spFetch(next);
    } catch (e) {
      throw new Error('Couldn’t check your Spotify library. Please try again.');
    }
    if ((page.items || []).some((p) => p && p.id === playlistId)) return true;
    next = page.next ? page.next.replace('https://api.spotify.com/v1/', '') : null;
  }
  return false;
}

async function exportTapeToSpotify(tape) {
  if (!tape) {
    throw new Error('No tape selected.');
  }

  // Don't duplicate playlists that originally came from Spotify (the stored link survives a genre change)
  if (tape.spotifyPlaylistId || tape.genre === 'Spotify import') {
    throw new Error('This tape was imported from Spotify and already exists in your Spotify library.');
  }

  // Already exported: only allowed again if that playlist was deleted in Spotify.
  if (tape.spotifyExportId) {
    if (await inSpotifyLibrary(tape.spotifyExportId)) {
      throw new Error('This tape has already been exported to Spotify.');
    }
    tape.spotifyExportId = null; // deleted in Spotify: forget it; the new playlist is remembered below
  }

  const tracks = orderTracks(tape);

  // Only songs with a Spotify match can be exported
  const uris = tracks.map((track) => track.spotifyUri).filter(Boolean);

  if (!uris.length) {
    throw new Error('This tape has no Spotify-matched songs.');
  }

  // Create the playlist in Spotify
  const spotifyPlaylist = await createSpotifyPlaylist(tape.name || 'Cassettefy Playlist');

  // Spotify accepts up to 100 items per request
  for (let i = 0; i < uris.length; i += 100) {
    await addSongsToSpotifyPlaylist(spotifyPlaylist.id, uris.slice(i, i + 100));
  }

  // Remember the Spotify playlist so we don't create duplicates
  tape.spotifyExportId = spotifyPlaylist.id;
  Store.save();

  return {
    playlist: spotifyPlaylist,
    exported: uris.length,
    skipped: tracks.length - uris.length,
  };
}

// The export button on each tape card in the Library and Favorites (data-export-spotify="<tape id>").
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-export-spotify]');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const tape = Store.tape(btn.dataset.exportSpotify);

  if (!tape) {
    toast('Tape not found.');
    return;
  }

  if (!Store.data.spotify) {
    toast('Please connect Spotify first.');
    return;
  }

  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '…';

  try {
    const result = await exportTapeToSpotify(tape);

    let message =
      '“' +
      tape.name +
      '” exported to Spotify with ' +
      result.exported +
      (result.exported === 1 ? ' song.' : ' songs.');

    if (result.skipped > 0) {
      message +=
        ' ' +
        result.skipped +
        (result.skipped === 1
          ? ' song had no Spotify match and was skipped.'
          : ' songs had no Spotify match and were skipped.');
    }

    toast(message);

    console.log('Spotify playlist exported:', result.playlist);
  } catch (error) {
    console.error('Spotify export error:', error);
    toast(error.message || 'Could not export playlist to Spotify.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
});

/* ======================= 6. Import (Spotify playlists -> tapes) ======================= */
// Loads the Spotify profile and playlists for the Profile page (once per session).
async function loadSpotify() {
  if (!Store.data.spotify || SP.busy || SP.me) return;

  SP.busy = true;
  renderProfile();

  try {
    // Get the currently logged-in Spotify user
    SP.me = await spFetch('me');

    // Get the user's Spotify playlists
    const pl = await spFetch('me/playlists?limit=30');

    // Only show playlists CREATED/OWNED by the logged-in user
    SP.lists = (pl.items || []).filter(
      (playlist) => playlist && playlist.owner && playlist.owner.id === SP.me.id,
    );
  } catch (e) {
    SP.msg = 'Spotify session ended. Please log in again.';
  }

  SP.busy = false;
  renderProfile();
}
// Spotify importer: converts selected Spotify playlists into cassette tapes.
/**
 * The Library tape this Spotify playlist belongs to, or null: the tape imported from it, or the tape
 * that was exported to create it (importing that back would duplicate the tape). Tapes imported before
 * the playlist id was stored are recognised by their name and the "Spotify import" genre.
 */
function importedTape(playlist) {
  return (
    Store.data.playlists.find(
      (t) =>
        t.spotifyExportId === playlist.id ||
        (t.spotifyPlaylistId
          ? t.spotifyPlaylistId === playlist.id
          : t.genre === 'Spotify import' && t.name === playlist.name),
    ) || null
  );
}
async function importSpotify() {
  const ids = $$('#spLists input:checked').map((i) => i.value);
  if (!ids.length) {
    toast('Tick at least one Spotify playlist.');
    return;
  }
  const btn = $('#spImport');
  btn.disabled = true;
  btn.textContent = 'Recording tapes…';
  let made = 0;
  for (const id of ids) {
    const meta = SP.lists.find((x) => x.id === id);
    // Never import the same playlist twice (e.g. a second click while the first import runs).
    if (importedTape(meta || { id })) continue;
    try {
      let items = [],
        next = 'playlists/' + id + '/items?limit=50';
      while (next && items.length < 200) {
        const page = await spFetch(next);
        items = items.concat(page.items || []);
        next = page.next ? page.next.replace('https://api.spotify.com/v1/', '') : null;
      }
      // A Spotify playlist can list the same song twice: keep only its first appearance.
      const seen = new Set();
      const tracks = items
        .map((it) => it && (it.track || it.item))
        .filter((tr) => tr && tr.name && !tr.is_local)
        .filter((tr) => {
          const key = songKey({ title: tr.name, artist: (tr.artists || []).map((a) => a.name).join(', ') });
          if (seen.has(key) || (tr.uri && seen.has(tr.uri))) return false;
          seen.add(key);
          if (tr.uri) seen.add(tr.uri);
          return true;
        });
      const half = Math.ceil(tracks.length / 2);
      const tape = Store.newTape({
        name: meta ? meta.name : 'Spotify tape',
        genre: 'Spotify import',
        shellIdx: made % SHELLS.length,
        tracks: tracks.map((tr, i) => ({
          id: uid(),
          side: i < half ? 'A' : 'B',
          title: tr.name,
          artist: (tr.artists || []).map((a) => a.name).join(', '),
          genre: 'Spotify',
          time: fmt((tr.duration_ms || 0) / 1000),
          previewUrl: tr.preview_url || '',
          spotifyUri: tr.uri,
        })),
      });
      tape.spotifyPlaylistId = id; // remembers where it came from, so the playlist can't be imported twice
      await Store.addTape(tape);
      made++;
    } catch (e) {
      toast('Couldn’t read “' + (meta ? meta.name : id) + '” from Spotify.');
    }
  }
  btn.disabled = false;
  btn.textContent = 'Import as tapes';
  renderProfile(); // imported playlists drop off the list
  if (made)
    toast(
      made + (made === 1 ? ' Spotify playlist is' : ' Spotify playlists are') + ' now tapes in your Library.',
    );
}

/* ======================= 7. Profile page ======================= */
// The Spotify part of the Profile page: connection status, login/setup messages and the playlist list.
// Called by renderProfile() in index.html.
function renderSpotifyProfile(connected) {
  $('#profHandle').textContent = connected
    ? SP.me
      ? 'Spotify: ' + (SP.me.display_name || SP.me.id)
      : 'Spotify connected'
    : 'Not connected to Spotify yet';
  const st = $('#profStatus');
  st.lastChild.textContent = connected ? 'Spotify connected' : 'Spotify not connected';
  st.style.background = connected ? '#241814' : '#F7D9D3';
  st.style.color = connected ? '#F2CF6B' : '#9B1B22';
  $('#spOut').hidden = connected;
  $('#spIn').hidden = !connected;
  const msg = $('#spMsg');
  if (SP.msg === 'setup') {
    msg.hidden = false;
    msg.innerHTML = html`
      <b>Almost there:</b> Spotify login needs this app’s Client ID. Create an app at developer.spotify.com,
      add <code>${esc(redirectUri())}</code> as a Redirect URI, then paste the Client ID into <code>SPOTIFY_CLIENT_ID</code> at the
      top of js/spotify.js.`;
  } else {
    msg.hidden = !SP.msg;
    msg.textContent = SP.msg;
  }
  if (connected) {
    $('#spWho').textContent = SP.busy
      ? 'Connecting…'
      : 'Connected as ' + (SP.me ? SP.me.display_name || SP.me.id : 'your Spotify account');
    // First letter of the Spotify name, or a music-note icon until the profile has loaded.
    $('#spInitials').innerHTML = SP.me
      ? esc((SP.me.display_name || SP.me.id || '?').slice(0, 1).toUpperCase())
      : icon('note', 22);
    // One checkbox per Spotify playlist (or a loading / empty message). Playlists that are already a tape
    // in the Library are left out, so a playlist can't be imported twice; erasing its tape brings it back.
    const listCheck = (p) => {
      const total = (p.tracks || p.items || {}).total;
      const count = total == null ? '' : total + (total === 1 ? ' song' : ' songs');
      return html`
        <label class="tape-check">
          <input type="checkbox" value="${esc(p.id)}">
          <span style="flex-grow: 1; font-weight: 600;">${esc(p.name)}</span>
          <span style="font-size: 14px; color: #6B4A3A;">${count}</span>
        </label>`;
    };
    if (!SP.lists) {
      $('#spLists').innerHTML = '<p style="margin: 0;"><span class="spin"></span>Loading your playlists…</p>';
    } else if (!SP.lists.length) {
      $('#spLists').innerHTML = '<p style="margin: 0;">No playlists on this Spotify account yet.</p>';
    } else {
      const available = SP.lists.filter((p) => !importedTape(p));
      const done = SP.lists.length - available.length;
      if (!available.length) {
        $('#spLists').innerHTML = html`
          <p style="margin: 0;">All your Spotify playlists are already tapes in your Library.</p>`;
      } else {
        const note = done
          ? html`<p class="sp-imported-note">${done} ${done === 1 ? 'playlist is' : 'playlists are'} already in your Library.</p>`
          : '';
        $('#spLists').innerHTML = available.map(listCheck).join('') + note;
      }
    }
    loadSpotify();
  }
}
document.getElementById('spConnect').addEventListener('click', spotifyConnect);
document.getElementById('spImport').addEventListener('click', importSpotify);
document.getElementById('spDisconnect').addEventListener('click', () => {
  Store.data.spotify = null;
  Store.save();
  SP.me = null;
  SP.lists = null;
  SP.msg = '';
  toast('Spotify disconnected.');
  renderProfile();
});

/* ======================= 8. SDK start-up ======================= */
// https://sdk.scdn.co/spotify-player.js (loaded at the end of index.html) calls this once it is ready.
window.onSpotifyWebPlaybackSDKReady = () => {
  spotifyPlayer = new Spotify.Player({
    name: 'Cassette Tape Player',

    getOAuthToken: (cb) => {
      const token = Store.data.spotify?.access;

      if (!token) {
        console.error('No Spotify access token available.');
        return;
      }

      cb(token);
    },

    volume: 0.5,
  });

  spotifyPlayer.addListener('ready', ({ device_id }) => {
    spotifyDeviceId = device_id;
    console.log('Spotify Player Ready:', device_id);
  });

  spotifyPlayer.addListener('not_ready', ({ device_id }) => {
    console.log('Spotify Player Offline:', device_id);
  });

  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Spotify initialization error:', message);
  });

  spotifyPlayer.addListener('authentication_error', ({ message }) => {
    console.error('Spotify authentication error:', message);
  });

  spotifyPlayer.addListener('account_error', ({ message }) => {
    console.error('Spotify account error:', message);
  });

  spotifyPlayer.addListener('playback_error', ({ message }) => {
    console.error('Spotify playback error:', message);
  });

  spotifyPlayer.addListener('player_state_changed', (state) => {
    if (!state) return;

    const t = Player.track();

    // Only handle Spotify songs in the cassette
    if (!t || !t.spotifyUri) return;

    const duration = Player.dur();

    // Detect a song that naturally reached the end
    const endedNaturally = state.paused && Player.playing && duration > 0 && Player.pos >= duration - 2;

    if (endedNaturally) {
      console.log('Spotify song ended — playing next track.');
      Player.next(true);
    }
  });

  spotifyPlayer.connect().then((success) => {
    console.log(
      success ? 'Spotify Web Playback SDK connected!' : 'Spotify Web Playback SDK failed to connect.',
    );
  });
};
