
/* ======================= 1. Settings ======================= */
/* The app's Client ID from the Spotify developer dashboard (developer.spotify.com), where the app is
   registered with http://127.0.0.1:3000/index.html as its Redirect URI. Spotify only sends a login back
   to a registered address, which is why the app is opened at 127.0.0.1 and not "localhost". */
const SPOTIFY_CLIENT_ID = 'e5d9a005633045a296b672629fff872a';
// What the app asks permission for: playing music in the browser, reading the listener's playlists,
// and creating playlists (for export).
const SPOTIFY_SCOPES =
  'streaming user-read-email user-modify-playback-state playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-read-private';
const redirectUri = () => 'http://127.0.0.1:3000/index.html';

// Spotify state for the Profile page: the logged-in user (me), their playlists (lists), whether they are
// still loading (busy), and any login message to show (msg).
const SP = { me: null, lists: null, busy: false, msg: '' };

/* ======================= 2. Login (Authorization Code with PKCE) ======================= */
// Turns bytes into URL-safe base64 text (used for the PKCE codes below).
const b64url = (bytes) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
/* "Log in with Spotify": the Authorization Code with PKCE flow, which needs no server-side secret.
   1. A random "verifier" is made and kept in sessionStorage; only its SHA-256 hash (the "challenge") is sent.
   2. The browser goes to Spotify's login page with the Client ID, the scopes and the challenge.
   3. Spotify sends the listener back to the Redirect URI with ?code=..., which handleSpotifyCallback()
      trades (together with the verifier) for an access token. */
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

// Spotify's length of each song, in seconds, by URI. A song added from Search carries iTunes' length,
// which can be a few seconds off from the Spotify version that actually plays.
const spotifyLengths = new Map();

/** Spotify's length of the song in seconds, or 0 if not known yet. */
const spotifyLength = (uri) => spotifyLengths.get(uri) || 0;

/** Looks up (once per song) how long the song is on Spotify; resolves to the seconds, or 0 if unknown. */
async function loadSpotifyLength(uri) {
  if (!spotifyLengths.has(uri)) {
    try {
      const track = await spFetch('tracks/' + encodeURIComponent(uri.split(':').pop()));
      if (track && track.duration_ms) spotifyLengths.set(uri, track.duration_ms / 1000);
    } catch (error) {
      console.warn('Could not get the Spotify length of', uri, error);
    }
  }
  return spotifyLength(uri);
}

/**
 * Seconds left in the song according to Spotify: 0 if Spotify has stopped or moved on to another song,
 * or null if the Spotify player doesn't answer within 1.5 s.
 */
async function spotifySecondsLeft(uri) {
  if (!spotifyPlayer) return null;
  const state = await Promise.race([
    spotifyPlayer.getCurrentState().catch(() => undefined),
    new Promise((resolve) => setTimeout(() => resolve(undefined), 1500)),
  ]);
  if (state === undefined) return null;
  if (!state || state.paused) return 0;
  const current = state.track_window && state.track_window.current_track;
  // Spotify may play a "relinked" copy of the song (another URI), which keeps the original in linked_from.
  if (current && current.uri !== uri && !(current.linked_from && current.linked_from.uri === uri)) return 0;
  if (!state.duration) return null;
  spotifyLengths.set(uri, state.duration / 1000);
  return Math.max(0, (state.duration - state.position) / 1000);
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
    // Only the first (main) artist is used for matching
    const mainArtist = (artist || '').split(',')[0].trim();

    const query = 'track:' + title + ' artist:' + mainArtist;

    const result = await spFetch('search?q=' + encodeURIComponent(query) + '&type=track&limit=5');

    const tracks = result.tracks?.items || [];

    if (!tracks.length) {
      console.warn('No Spotify match found for:', title, artist);
      return '';
    }

    // An exact title + artist match is preferred; otherwise Spotify's top result is used
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
// Creates a new private playlist in the listener's Spotify account; resolves to the playlist.
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

// Adds songs (by Spotify URI) to a Spotify playlist.
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

// Exports a tape: creates a Spotify playlist with the tape's name and adds its songs, in tape order.
// Songs without a Spotify match are skipped; resolves to how many were exported and skipped.
async function exportTapeToSpotify(tape) {
  if (!tape) {
    throw new Error('No tape selected.');
  }

  // A tape imported from Spotify already exists there, so it isn't exported. The stored playlist link
  // survives a genre change; the "Spotify import" genre is how earlier versions marked imported tapes.
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

  // The new playlist in Spotify
  const spotifyPlaylist = await createSpotifyPlaylist(tape.name || 'Cassettefy Playlist');

  // Spotify accepts up to 100 items per request
  for (let i = 0; i < uris.length; i += 100) {
    await addSongsToSpotifyPlaylist(spotifyPlaylist.id, uris.slice(i, i + 100));
  }

  // The Spotify playlist is remembered on the tape, so the tape isn't exported twice
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
    // The logged-in Spotify user
    SP.me = await spFetch('me');

    // Their Spotify playlists
    const pl = await spFetch('me/playlists?limit=30');

    // Only playlists the user owns are listed (not ones they follow)
    SP.lists = (pl.items || []).filter(
      (playlist) => playlist && playlist.owner && playlist.owner.id === SP.me.id,
    );
  } catch (e) {
    SP.msg = 'Spotify session ended. Please log in again.';
  }

  SP.busy = false;
  renderProfile();
  // Tapes an earlier version imported as "Spotify import" get their real genres
  fixImportedGenres();
}
/* ---------- Genres for imported tapes ----------
   Spotify gives genres to artists, not to songs, so an imported song takes its main artist's genre and the
   tape takes the genre most of its songs share. When Spotify has no genre for any of the artists, the tape's
   genre comes from iTunes (where songs added from Search get theirs), and is "Mixed" only if iTunes has none
   either. Earlier versions labelled every imported tape "Spotify import" (and every song "Spotify");
   fixImportedGenres() below replaces those labels on tapes imported before this change. */

// Spotify writes genres in lower case: "dance pop" -> "Dance Pop", "k-pop" -> "K-Pop", "r&b" -> "R&B".
function genreLabel(genre) {
  return String(genre || '').replace(/[^\s-]+/g, (w) =>
    w.includes('&') ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
  );
}

// The main artist's genre for each Spotify track, in the same order; '' where Spotify has none.
async function artistGenres(tracks) {
  const artistOf = (tr) => tr && tr.artists && tr.artists[0] && tr.artists[0].id;
  const ids = [...new Set(tracks.map(artistOf).filter(Boolean))];
  const genreOf = new Map();
  // Spotify sends up to 50 artists per request
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const page = await spFetch('artists?ids=' + ids.slice(i, i + 50).join(','));
      (page.artists || []).forEach((a) => a && genreOf.set(a.id, genreLabel((a.genres || [])[0])));
    } catch (e) {
      console.warn('Could not get artist genres from Spotify:', e);
    }
  }
  return tracks.map((tr) => genreOf.get(artistOf(tr)) || '');
}

// The genre most of the songs share, or '' when none of them has one.
function commonGenre(genres) {
  const count = new Map();
  genres.filter(Boolean).forEach((g) => count.set(g, (count.get(g) || 0) + 1));
  let best = '',
    most = 0;
  count.forEach((n, g) => {
    if (n > most) {
      best = g;
      most = n;
    }
  });
  return best;
}

// Asks iTunes (the same search the Search page uses) for the genre of up to 5 of the songs; the first found wins.
async function itunesGenre(songs) {
  for (const s of songs.slice(0, 5)) {
    try {
      const data = await itunes('search', { term: s.title + ' ' + s.artist, media: 'music', entity: 'song', limit: 1 });
      const genre = data.results && data.results[0] && data.results[0].primaryGenreName;
      if (genre) return genre;
    } catch (e) {
      // no answer for this song: the next one is tried
    }
  }
  return '';
}

// Genres for a list of Spotify tracks: { songs: one genre per track ('' if unknown), tape: the tape's genre }.
async function genresFor(tracks) {
  const songs = await artistGenres(tracks);
  const tape =
    commonGenre(songs) ||
    (await itunesGenre(tracks.map((tr) => ({ title: tr.name, artist: ((tr.artists || [])[0] || {}).name || '' })))) ||
    'Mixed';
  return { songs, tape };
}

// Every playlist in the listener's Spotify library (page by page, 50 at a time).
async function allSpotifyPlaylists() {
  let lists = [],
    next = 'me/playlists?limit=50';
  for (let pages = 0; next && pages < 40; pages++) {
    const page = await spFetch(next);
    lists = lists.concat((page.items || []).filter(Boolean));
    next = page.next ? page.next.replace('https://api.spotify.com/v1/', '') : null;
  }
  return lists;
}

/**
 * Gives real genres to tapes that an earlier version imported as "Spotify import", once, while Spotify is
 * connected (called when the site opens and when the Profile page loads Spotify). Such a tape is first linked
 * to its Spotify playlist (spotifyPlaylistId), because the old label was how it was recognised as imported:
 * with the link it still can't be imported or exported a second time once the label is gone.
 */
let fixingGenres = false;
async function fixImportedGenres() {
  if (fixingGenres || !Store.data.spotify) return;
  const stuck = Store.data.playlists.filter((t) => t.genre === 'Spotify import');
  if (!stuck.length) return;
  fixingGenres = true;
  try {
    const lists = stuck.some((t) => !t.spotifyPlaylistId) ? await allSpotifyPlaylists() : [];
    for (const tape of stuck) {
      if (!tape.spotifyPlaylistId) {
        // Linked by name, as older imports were recognised. No playlist by that name: nothing to protect.
        const playlist = lists.find((p) => p.name === tape.name);
        if (playlist) tape.spotifyPlaylistId = playlist.id;
      }
      // Spotify's details for the tape's songs (for their artists), 50 songs per request
      const ids = tape.tracks.map((t) => (t.spotifyUri || '').split(':').pop()).filter(Boolean);
      const byUri = new Map();
      for (let i = 0; i < ids.length; i += 50) {
        const page = await spFetch('tracks?ids=' + ids.slice(i, i + 50).join(','));
        (page.tracks || []).forEach((tr) => {
          if (!tr) return;
          byUri.set(tr.uri, tr);
          // Spotify may answer with a "relinked" copy of the song; the tape knows the original URI
          if (tr.linked_from && tr.linked_from.uri) byUri.set(tr.linked_from.uri, tr);
        });
      }
      const known = tape.tracks.filter((t) => byUri.has(t.spotifyUri));
      const genres = await genresFor(known.map((t) => byUri.get(t.spotifyUri)));
      known.forEach((t, i) => (t.genre = genres.songs[i]));
      // Songs Spotify no longer has lose the old "Spotify" label rather than keep it
      tape.tracks.forEach((t) => {
        if (t.genre === 'Spotify') t.genre = '';
      });
      tape.genre = genres.tape;
      Store.save(); // after each tape, so a later failure doesn't lose the ones already done
    }
    RENDER[currentRoute]();
  } catch (e) {
    console.warn('Could not update the genres of imported tapes:', e);
  } finally {
    fixingGenres = false;
  }
}

/**
 * The Library tape this Spotify playlist belongs to, or null: the tape imported from it, or the tape
 * that was exported to create it (importing that back would duplicate the tape). Tapes imported by earlier
 * versions, before the playlist id was stored, are recognised by their name and the old "Spotify import" genre.
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
// "Import as tapes": turns each ticked Spotify playlist into a tape in the Library. The songs are split
// between side A (first half) and side B, and keep their Spotify URIs so the deck plays the full songs.
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
    // A playlist that is already a tape is skipped (e.g. after a second click while the first import runs).
    if (importedTape(meta || { id })) continue;
    try {
      let items = [],
        next = 'playlists/' + id + '/items?limit=50';
      while (next && items.length < 200) {
        const page = await spFetch(next);
        items = items.concat(page.items || []);
        next = page.next ? page.next.replace('https://api.spotify.com/v1/', '') : null;
      }
      // A Spotify playlist can list the same song twice: only its first appearance is kept.
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
      // Real genres (see "Genres for imported tapes" above), not a fixed "Spotify import" label
      const genres = await genresFor(tracks);
      const tape = Store.newTape({
        name: meta ? meta.name : 'Spotify tape',
        genre: genres.tape,
        shellIdx: made % SHELLS.length,
        tracks: tracks.map((tr, i) => ({
          id: uid(),
          side: i < half ? 'A' : 'B',
          title: tr.name,
          artist: (tr.artists || []).map((a) => a.name).join(', '),
          genre: genres.songs[i],
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
// The Profile page's Spotify buttons: log in, import the ticked playlists, and disconnect (which forgets the
// login in this browser).
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
// It creates the "Cassette Tape Player": a Spotify device inside this page that plays the full songs.
// Its device id (on "ready") is where playSpotifyTrack() sends songs.
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

  // When a Spotify song reaches its end, the deck moves on to the next song. (If this news comes late, for
  // example while the tab is in the background, the deck's own end timer in index.html moves on instead.)
  spotifyPlayer.addListener('player_state_changed', (state) => {
    if (!state) return;

    const t = Player.track();

    // Only Spotify songs on the deck are handled here
    if (!t || !t.spotifyUri) return;

    const duration = Player.dur();

    // A song that reached its end (not one the listener paused)
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
