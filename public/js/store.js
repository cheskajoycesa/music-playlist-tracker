/* ================= Cassettefy · js/store.js =================
   The Store: the one place tapes are loaded from and saved to the Node server (/api/playlists), plus the
   per-browser data in localStorage (history, now playing, recent searches, display name, Spotify login). */

/* ---------------- storage ----------------
   Tapes (playlists) live on the Node server:  GET/POST /api/playlists, PUT/DELETE /api/playlists/:id
   Per-browser things (recent plays, now playing, recent searches, display name, Spotify token) stay in localStorage.
   If the page is opened without the server (file://, or the server is down) tapes fall back to localStorage too. */
const API = location.protocol === 'file:' ? null : 'api';

// Six ready-made tapes for the "Add 6 sample tapes" button.
function sampleTapes() {
  const now = Date.now();
  const tr = (side, title, artist, genre, time) => ({ id: uid(), side, title, artist, genre, time });
  const tape = (name, genre, shellIdx, fav, ageDays, tracks) => ({
    name,
    genre,
    notes: '',
    shell: SHELLS[shellIdx].shell,
    stripe: SHELLS[shellIdx].stripe,
    fav,
    likedAt: fav ? now - ageDays * 86400000 : null,
    createdAt: now - (ageDays + 20) * 86400000,
    tracks,
  });
  return [
    tape('Saturday Night Fever', 'Disco', 0, true, 2, [
      tr('A', "Stayin' Alive", 'Bee Gees', 'Disco', '4:45'),
      tr('A', 'I Will Survive', 'Gloria Gaynor', 'Disco', '3:18'),
      tr('A', 'September', 'Earth, Wind & Fire', 'Funk', '3:35'),
      tr('A', 'Le Freak', 'Chic', 'Disco', '3:30'),
      tr('A', 'Dancing Queen', 'ABBA', 'Europop', '3:51'),
      tr('A', 'Hot Stuff', 'Donna Summer', 'Disco', '3:47'),
      tr('B', 'Night Fever', 'Bee Gees', 'Disco', '3:33'),
      tr('B', 'Good Times', 'Chic', 'Funk', '3:36'),
      tr('B', 'I Feel Love', 'Donna Summer', 'Electronic', '5:53'),
      tr('B', 'Boogie Wonderland', 'Earth, Wind & Fire', 'Funk', '4:48'),
      tr('B', 'Funkytown', 'Lipps Inc.', 'Disco', '3:59'),
      tr('B', "Don't Leave Me This Way", 'Thelma Houston', 'Soul', '3:38'),
    ]),
    tape('Soda Fountain Sundays', "Doo-wop & '50s pop", 1, false, 9, [
      tr('A', 'Earth Angel', 'The Penguins', 'Doo-wop', '2:58'),
      tr('A', 'In the Still of the Night', 'The Five Satins', 'Doo-wop', '3:03'),
      tr('B', 'Only You', 'The Platters', 'Doo-wop', '2:39'),
      tr('B', 'Sh-Boom', 'The Chords', 'Doo-wop', '2:30'),
    ]),
    tape("Roller Rink '79", 'Funk & roller disco', 2, false, 12, [
      tr('A', 'Car Wash', 'Rose Royce', 'Funk', '3:18'),
      tr('A', 'Get Down Tonight', 'KC and the Sunshine Band', 'Disco', '3:15'),
      tr('B', 'Boogie Oogie Oogie', 'A Taste of Honey', 'Disco', '3:40'),
      tr('B', "Ladies' Night", 'Kool & the Gang', 'Funk', '3:32'),
    ]),
    tape('Diner Jukebox', "Rock 'n' roll", 3, true, 7, [
      tr('A', 'Johnny B. Goode', 'Chuck Berry', "Rock 'n' roll", '2:41'),
      tr('A', 'Rock Around the Clock', 'Bill Haley & His Comets', "Rock 'n' roll", '2:10'),
      tr('B', 'Blue Suede Shoes', 'Carl Perkins', "Rock 'n' roll", '2:15'),
      tr('B', 'Great Balls of Fire', 'Jerry Lee Lewis', "Rock 'n' roll", '1:52'),
    ]),
    tape('Late Night Drive', 'Soul & slow jams', 4, true, 30, [
      tr('A', "Let's Stay Together", 'Al Green', 'Soul', '3:18'),
      tr('A', "Ain't No Sunshine", 'Bill Withers', 'Soul', '2:05'),
      tr('B', "What's Going On", 'Marvin Gaye', 'Soul', '3:53'),
    ]),
    tape('Sunday Morning Records', 'Easy listening', 5, false, 15, [
      tr('A', "(Sittin' On) The Dock of the Bay", 'Otis Redding', 'Soul', '2:42'),
      tr('A', '(They Long to Be) Close to You', 'Carpenters', 'Pop', '3:40'),
      tr('B', "Everybody's Talkin'", 'Harry Nilsson', 'Pop', '2:45'),
    ]),
  ];
}

/** Accepts playlists saved by older versions of the server (e.g. {title, songs}) and fills in what the UI needs. */
function normalizeTape(p) {
  p = p || {};
  const key = String(p.id == null ? uid() : p.id);
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  const s = SHELLS[Math.abs(h) % SHELLS.length];
  const raw = Array.isArray(p.tracks) ? p.tracks : Array.isArray(p.songs) ? p.songs : [];
  const half = Math.ceil(raw.length / 2);
  const tracks = raw.map((t, i) => {
    t = t || {};
    let time = t.time || '';
    if (!time && t.durationMs) time = fmt(t.durationMs / 1000);
    if (!time && t.duration != null)
      time = typeof t.duration === 'number' ? fmt(t.duration) : String(t.duration);
    return {
      id: String(t.id == null ? uid() : t.id),
      side: t.side === 'A' || t.side === 'B' ? t.side : i < half ? 'A' : 'B',
      title: t.title || t.name || t.trackName || 'Untitled',
      artist: t.artist || t.artistName || '',
      genre: t.genre || '',
      time,
      previewUrl: t.previewUrl || '',
      spotifyUri: t.spotifyUri || '',
      art: t.art || t.artwork || '',
    };
  });
  const out = Object.assign({}, p, {
    id: key,
    name: p.name || p.title || 'Untitled tape',
    genre: p.genre || 'Mixed',
    notes: p.notes || p.description || '',
    shell: p.shell || s.shell,
    stripe: p.stripe || s.stripe,
    fav: !!p.fav,
    likedAt: p.likedAt || null,
    createdAt: p.createdAt || (typeof p.id === 'number' ? p.id : Date.now()),
    tracks,
  });
  delete out.songs;
  return out;
}

// Data store: loads, saves, and manages tapes, playlists, profile data, and history.
const Store = (() => {
  const KEY = 'cassettefy.v2'; // per-browser state
  const TAPES_KEY = 'cassettefy.tapes'; // tapes, only used when the server can't be reached
  const readJSON = (k) => {
    try {
      const r = localStorage.getItem(k);
      return r ? JSON.parse(r) : null;
    } catch (e) {
      return null;
    }
  };
  const writeJSON = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* private mode: keep in memory */
    }
  };
  const defaults = () => ({
    profile: { name: 'Guest listener' },
    recent: [],
    now: null,
    searches: ['Bee Gees', 'Donna Summer', 'ABBA', 'doo-wop'],
    spotify: null,
  });

  let data = Object.assign(defaults(), readJSON(KEY) || {}, { playlists: [] });
  let online = false;
  const synced = new Map(); // tape id -> JSON last saved to the server
  let timer = null;

  const toServer = (t) => {
    const c = Object.assign({}, t);
    delete c.id;
    return c;
  };
  const snap = (t) => JSON.stringify(toServer(t));
  const sortTapes = () => data.playlists.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Saves per-browser state to localStorage (plus the tapes while the server can't be reached).
  function writeLocal() {
    const local = Object.assign({}, data);
    delete local.playlists;
    writeJSON(KEY, local);
    if (!online) writeJSON(TAPES_KEY, data.playlists);
  }
  // Calls the Node server's /api routes and returns the parsed JSON (null for an empty reply).
  async function api(method, path, body) {
    const r = await fetch(API + path, {
      method,
      keepalive: method !== 'GET' && !!body && JSON.stringify(body).length < 60000,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
  // Replaces the tapes in memory with the server's copy.
  async function load() {
    const list = await api('GET', '/playlists');
    data.playlists = (Array.isArray(list) ? list : []).map(normalizeTape);
    synced.clear();
    data.playlists.forEach((t) => synced.set(t.id, snap(t)));
    sortTapes();
  }
  // Sends every tape that changed since the last save to the server.
  async function syncNow() {
    clearTimeout(timer);
    if (!online) return;
    for (const t of data.playlists.slice()) {
      const s = snap(t);
      if (synced.get(t.id) === s) continue;
      synced.set(t.id, s);
      try {
        await api('PUT', '/playlists/' + encodeURIComponent(t.id), toServer(t));
      } catch (e) {
        synced.delete(t.id);
        toast('Couldn’t save “' + t.name + '” to the server. Is it still running?');
      }
    }
  }
  window.addEventListener('pagehide', () => {
    if (online) syncNow();
  });

  return {
    get data() {
      return data;
    },
    get online() {
      return online;
    },
    async init() {
      if (API) {
        try {
          await load();
          online = true;
        } catch (e) {
          online = false;
        }
      }
      if (!online) {
        data.playlists = (readJSON(TAPES_KEY) || []).map(normalizeTape);
        sortTapes();
      }
      return online;
    },
    /** Saves per-browser state now and pushes any changed tapes to the server (debounced). */
    save() {
      writeLocal();
      clearTimeout(timer);
      timer = setTimeout(syncNow, 250);
    },
    flush: syncNow,
    reload() {
      const d = readJSON(KEY);
      if (d) Object.assign(data, d, { playlists: data.playlists });
    },
    async refresh() {
      if (!online) return;
      try {
        await syncNow();
        await load();
      } catch (e) {
        /* keep what we have */
      }
    },
    tape(id) {
      return id == null ? null : data.playlists.find((p) => p.id === String(id)) || null;
    },
    tapeNo(tape) {
      const asc = data.playlists.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return asc.indexOf(tape) + 1;
    },
    async addTape(t) {
      if (online) {
        const saved = normalizeTape(await api('POST', '/playlists', toServer(t)));
        data.playlists.unshift(saved);
        synced.set(saved.id, snap(saved));
        sortTapes();
        writeLocal();
        return saved;
      }
      const local = normalizeTape(Object.assign({ id: uid() }, t));
      data.playlists.unshift(local);
      sortTapes();
      writeLocal();
      return local;
    },
    async removeTape(id) {
      id = String(id);
      if (online) await api('DELETE', '/playlists/' + encodeURIComponent(id));
      data.playlists = data.playlists.filter((p) => p.id !== id);
      data.recent = data.recent.filter((r) => r.playlistId !== id);
      if (data.now && data.now.playlistId === id) data.now = null;
      synced.delete(id);
      writeLocal();
    },
    async loadSamples() {
      for (const t of sampleTapes()) await this.addTape(t);
    },
    logPlay(playlistId, trackId, position, done) {
      data.recent = [
        { playlistId, trackId, position: Math.floor(position || 0), at: Date.now(), done: !!done },
      ]
        .concat(data.recent.filter((r) => r.playlistId !== playlistId))
        .slice(0, 40);
      writeLocal();
    },
    newTape(fields) {
      const s = SHELLS[fields.shellIdx || 0];
      return {
        name: fields.name || 'Untitled tape',
        genre: fields.genre || 'Mixed',
        notes: fields.notes || '',
        shell: s.shell,
        stripe: s.stripe,
        fav: false,
        likedAt: null,
        createdAt: Date.now(),
        tracks: fields.tracks || [],
      };
    },
  };
})();
