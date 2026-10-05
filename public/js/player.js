/* ================= Cassettefy · js/player.js =================
   The cassette deck player: play, pause, stop, next, previous, flip and seek for Spotify songs, 30-second
   previews and songs without audio; moving on when a song ends; the progress bar and the bottom player. */

/* ======================= deck player ======================= */
/**
 * Which tape the Deck page is showing. It can differ from the tape in the player, so opening
 * a tape to look at its songs doesn't stop the music. viewId = null means "show the playing tape".
 */
const Deck = {
  viewId: null,
  tape() {
    return (this.viewId && Store.tape(this.viewId)) || Player.tape;
  },
  /** True while looking at a tape other than the one in the player. */
  browsing() {
    const v = this.tape();
    return !!v && v !== Player.tape;
  },
  open(id) {
    this.viewId = Player.tape && Player.tape.id === String(id) ? null : String(id);
  },
};

// Player controller: manages the selected tape, track order, playback state, and controls.
const Player = {
  tape: null,
  idx: 0,
  playing: false,
  pos: 0,
  timer: null,
  endTimer: null, // wakes up once when the current song should be over (see armEnd)
  clock: 0, // Date.now() at which the current song would have been at 0:00
  order() {
    return this.tape ? orderTracks(this.tape) : [];
  },
  track() {
    return this.order()[this.idx] || null;
  },
  usesAudio() {
    const t = this.track();
    return !!(t && t.previewUrl);
  },
  dur() {
    const t = this.track();
    if (!t) return 0;
    if (t.previewUrl && isFinite(deckAudio.duration) && deckAudio.duration > 0) return deckAudio.duration;
    // Spotify's own length once known: songs added from Search carry iTunes' length, which can differ a bit.
    if (t.spotifyUri && spotifyLength(t.spotifyUri)) return spotifyLength(t.spotifyUri);
    return secs(t.time) || (t.previewUrl ? 30 : 0);
  },
  /** Seconds into the song by the wall clock, which keeps time even while the page is in the background. */
  clockPos() {
    return (Date.now() - this.clock) / 1000;
  },
  startClock() {
    this.clock = Date.now() - this.pos * 1000;
  },
  stopTimers() {
    clearInterval(this.timer);
    clearTimeout(this.endTimer);
  },
  /**
   * Wakes up once, when the current song should be over, to move on to the next one. In a background tab
   * the browser slows repeating timers down and Spotify's "song ended" event can arrive only once the tab
   * is visible again; this one-off timer still fires on time, so the next song starts without a delay.
   */
  armEnd() {
    clearTimeout(this.endTimer);
    const t = this.track();
    if (!this.playing || !t) return;
    const left = Math.max(0, this.dur() - this.pos);
    this.endTimer = setTimeout(() => this.checkEnd(t.id), left * 1000 + 750);
  },
  /** Called by armEnd's timer: plays the next song if this one is really over, or waits a little longer. */
  async checkEnd(id) {
    // Songs are compared by id: reloading the tapes replaces the song objects but keeps their ids.
    const sameSong = () => this.playing && !!this.track() && this.track().id === id;
    if (!sameSong()) return;
    const t = this.track();
    let left = this.dur() - this.clockPos();
    if (t.spotifyUri) {
      // Spotify is asked how much is left (it may have buffered for a moment). Its answer is ignored only
      // if it is clearly out of date: the clock says the song ended more than 5 seconds ago.
      const spotifyLeft = await spotifySecondsLeft(t.spotifyUri);
      if (!sameSong()) return;
      if (spotifyLeft !== null && left > -5) left = spotifyLeft;
    }
    if (left > 1) {
      this.pos = Math.max(0, this.dur() - left);
      this.startClock();
      this.armEnd();
    } else {
      this.next(true);
    }
  },
  load(tapeId, trackId, pos, autoplay) {
    const tape = Store.tape(tapeId);
    if (!tape) return;
    this.halt();
    this.tape = tape;
    Deck.viewId = null; // the Deck follows the tape that's now in the player
    const i = trackId ? this.order().findIndex((t) => t.id === trackId) : 0;
    this.idx = Math.max(0, i);
    this.pos = pos || 0;
    this.cue();
    this.persist(false);
    if (autoplay) this.play();
    else ui();
  },
  cue() {
    const t = this.track();
    if (t && t.previewUrl) {
      if (deckAudio.getAttribute('src') !== t.previewUrl) deckAudio.src = t.previewUrl;
      try {
        deckAudio.currentTime = Math.min(this.pos, 29);
      } catch (e) {
        /* not loaded yet */
      }
    } else {
      deckAudio.removeAttribute('src');
    }
  },
  play() {
    const t = this.track();
    console.log('Current cassette track:', t);
    console.log('Spotify URI:', t?.spotifyUri);

    if (!this.tape) {
      toast('Load a tape in the deck first.');
      return;
    }

    if (!t) {
      toast('This tape is blank. Add songs from Search or the editor.');
      return;
    }

    previewAudio.pause();
    stopPreviewButtons();

    this.playing = true;
    this.stopTimers();

    // Spotify imported track
    if (t.spotifyUri) {
      // A song that already finished starts again from the beginning
      if (this.pos >= this.dur() - 1) {
        this.pos = 0;
      }

      // Songs are compared by id: reloading the tapes replaces the song objects but keeps their ids.
      const sameSong = () => !!this.track() && this.track().id === t.id;
      playSpotifyTrack(t.spotifyUri, this.pos).then(async (success) => {
        // A late answer is ignored if the listener already paused or moved to another song.
        if (!this.playing || !sameSong()) return;
        if (!success) {
          this.playing = false;
          ui();
          return;
        }
        this.startClock();

        // Spotify's real length of the song, so the deck knows exactly when it ends
        await loadSpotifyLength(t.spotifyUri);
        if (!this.playing || !sameSong()) return;
        this.pos = Math.min(this.clockPos(), this.dur());
        tick();
        this.armEnd();

        // The cassette timer follows Spotify's position
        clearInterval(this.timer);
        this.timer = setInterval(async () => {
          if (!this.playing || !spotifyReady() || !sameSong()) return;
          const position = await spotifyPosition();
          if (position === null || !this.playing || !sameSong()) return;

          this.pos = position;
          this.startClock();
          tick();
        }, 500);
      });
    } else if (this.usesAudio()) {
      // Existing preview audio
      deckAudio.play().catch(() => this.simulate());
    } else {
      // Songs without audio
      this.simulate();
    }

    Store.logPlay(this.tape.id, t.id, this.pos);
    ui();
  },
  simulate() {
    // Songs without audio: the deck counts through their duration (by the clock,
    // so the count stays right even when a background tab only lets this timer run now and then).
    this.stopTimers();
    this.startClock();
    let saved = Math.floor(this.pos / 10);
    this.timer = setInterval(() => {
      if (!this.playing) return;
      this.pos = Math.min(this.clockPos(), this.dur());
      if (this.pos >= this.dur()) this.next(true);
      else {
        tick();
        if (Math.floor(this.pos / 10) !== saved) {
          saved = Math.floor(this.pos / 10);
          this.persist(false);
        }
      }
    }, 1000);
    this.armEnd();
  },
  pause() {
    const t = this.track();

    this.playing = false;
    this.stopTimers();

    // Spotify track
    if (t && t.spotifyUri && spotifyReady()) {
      pauseSpotify('pause');
    } else {
      // Existing preview audio
      deckAudio.pause();
    }

    this.persist(true);
    ui();
  },
  toggle() {
    this.playing ? this.pause() : this.play();
  },
  /**
   * Silences the deck (used when switching songs or tapes, or erasing the playing tape).
   * keepSpotify = true skips pausing Spotify because another Spotify song is about to replace this one.
   */
  halt(keepSpotify) {
    const wasPlaying = this.playing;
    const t = this.track();

    this.playing = false;
    this.stopTimers();

    deckAudio.pause();

    // Spotify is paused only if a Spotify song was actually playing
    if (!keepSpotify && wasPlaying && t && t.spotifyUri) {
      pauseSpotifyIfPlaying('halt');
    }
  },
  stop() {
    const t = this.track();

    this.playing = false;
    this.stopTimers();
    this.pos = 0;

    // Spotify track
    if (t && t.spotifyUri && spotifyReady()) {
      stopSpotify();
    } else {
      // Existing preview/local audio
      deckAudio.pause();

      try {
        deckAudio.currentTime = 0;
      } catch (e) {}
    }

    this.persist(true);
    tick();
    ui();
  },
  go(i, play) {
    const n = this.order().length;
    if (!n) return;
    const keep = play || this.playing;
    const nextTrack = this.order()[(i + n) % n];
    this.halt(keep && !!nextTrack.spotifyUri);
    this.idx = (i + n) % n;
    this.pos = 0;
    this.cue();
    this.persist(false);
    if (keep) this.play();
    else ui();
  },
  next(auto) {
    const n = this.order().length;
    if (auto && this.idx >= n - 1) {
      this.halt();
      this.pos = 0;
      if (this.track()) Store.logPlay(this.tape.id, this.track().id, 0, true);
      toast('End of the tape. Flip it or pick another.');
      ui();
      return;
    }
    this.go(this.idx + 1, auto);
  },
  // More than 3 seconds in, "previous" restarts the current song; otherwise it goes back one song.
  prev() {
    if (this.pos > 3) this.seek(0);
    else this.go(this.idx - 1);
  },
  flip() {
    const cur = this.track();
    if (!cur) return;
    const i = this.order().findIndex((t) => t.side !== cur.side);
    if (i < 0) {
      toast('Side ' + (cur.side === 'A' ? 'B' : 'A') + ' is blank.');
      return;
    }
    this.go(i);
  },
  seek(s) {
    this.pos = Math.max(0, Math.min(s, this.dur()));

    const t = this.track();

    // Spotify song
    if (t && t.spotifyUri && spotifyReady()) {
      seekSpotify(this.pos);
    } else if (this.usesAudio()) {
      // Existing preview audio
      try {
        deckAudio.currentTime = this.pos;
      } catch (e) {}
    }
    // Spotify and no-audio songs: the song now ends at a different time
    if (this.playing && !this.usesAudio()) {
      this.startClock();
      this.armEnd();
    }

    tick();
    this.persist(false);
  },
  persist(log) {
    if (!this.tape) return;
    const t = this.track();
    Store.data.now = { playlistId: this.tape.id, trackId: t ? t.id : null, position: Math.floor(this.pos) };
    if (log && t) Store.logPlay(this.tape.id, t.id, this.pos);
    else Store.save();
  },
  info() {
    return this.tape
      ? { tape: this.tape, track: this.track(), pos: this.pos, dur: this.dur(), playing: this.playing }
      : null;
  },
};
deckAudio.addEventListener('timeupdate', () => {
  if (Player.usesAudio()) {
    Player.pos = deckAudio.currentTime;
    tick();
  }
});
deckAudio.addEventListener('loadedmetadata', tick);
deckAudio.addEventListener('ended', () => Player.next(true));

// Playback UI update: synchronizes progress, elapsed time, and player indicators.
function tick() {
  let info = Player.info();
  paintNowPlaying(info);
  // The Deck is showing a different tape: its timer sits at 0:00 of that tape's first song.
  if (Deck.browsing()) {
    const first = orderTracks(Deck.tape())[0];
    info = { pos: 0, dur: first ? secs(first.time) : 0 };
  }
  if (!info) return;
  const pct = info.dur ? Math.min(100, (info.pos / info.dur) * 100) : 0;
  const fill = $('#progFill');
  if (fill) fill.style.width = pct + '%';
  $$('[data-deck="elapsed"]').forEach((e) => (e.textContent = fmt(info.pos)));
  const tot = $('#progTotal');
  if (tot) tot.textContent = fmt(info.dur);
  const bar = $('#progress');
  if (bar) {
    bar.setAttribute('aria-valuenow', Math.round(info.pos));
    bar.setAttribute('aria-valuemax', Math.round(info.dur));
    bar.setAttribute('aria-valuetext', fmt(info.pos) + ' of ' + fmt(info.dur));
  }
}
// Redraws everything that shows playback state (and the whole deck when it is on screen).
function ui() {
  tick();
  if (currentRoute === 'deck') renderDeck();
  if (!Player.info()) paintNowPlaying(null);
}
// Play / previous / next buttons of the sidebar mini player and the bottom player.
$$('[data-np="play"]').forEach((b) =>
  b.addEventListener('click', () => (Player.tape ? Player.toggle() : (location.hash = '#deck'))),
);
$$('[data-np="prev"]').forEach((b) => b.addEventListener('click', () => Player.prev()));
$$('[data-np="next"]').forEach((b) => b.addEventListener('click', () => Player.go(Player.idx + 1)));

// Clicking the bottom player anywhere except its buttons and progress bar opens the cassette deck.
function openDeckFromDock() {
  Deck.viewId = null; // the deck shows the tape that's playing
  location.hash = '#deck';
}
$$('.dock').forEach((dock) =>
  dock.addEventListener('click', (e) => {
    // composedPath, not e.target.closest: the play button redraws its icon while handling the click,
    // so by now the clicked icon may no longer be inside the button.
    const controls = e
      .composedPath()
      .some((el) => el.matches && el.matches('button, a, input, [data-np="seek"]'));
    if (!controls) openDeckFromDock();
  }),
);
$$('.dock-open').forEach((el) =>
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDeckFromDock();
    }
  }),
);

// Bottom player progress bar: click or drag to jump in the song, arrow keys step 5 seconds.
// While dragging only the bar moves; the jump happens on release (so Spotify gets one seek, not dozens).
$$('[data-np="seek"]').forEach((bar) => {
  const row = bar.closest('.dock-wide') || bar.parentElement;
  const fraction = (e) => {
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const preview = (f) => {
    bar.querySelector('[data-np="fill"]').style.width = f * 100 + '%';
    const elapsed = row.querySelector('[data-np="elapsed"]');
    if (elapsed) elapsed.textContent = fmt(f * Player.dur());
  };
  let dragging = false;
  bar.addEventListener('pointerdown', (e) => {
    if (!Player.tape || !Player.dur()) return;
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('dragging');
    preview(fraction(e));
    e.preventDefault();
  });
  bar.addEventListener('pointermove', (e) => {
    if (dragging) preview(fraction(e));
  });
  const finish = (e, jump) => {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('dragging');
    if (jump) Player.seek(fraction(e) * Player.dur());
    else tick();
  };
  bar.addEventListener('pointerup', (e) => finish(e, true));
  bar.addEventListener('pointercancel', (e) => finish(e, false));
  bar.addEventListener('keydown', (e) => {
    if (!Player.tape || !Player.dur()) return;
    const to = {
      ArrowRight: Player.pos + 5,
      ArrowUp: Player.pos + 5,
      ArrowLeft: Player.pos - 5,
      ArrowDown: Player.pos - 5,
      Home: 0,
      End: Player.dur() - 1,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    Player.seek(to);
  });
});
