/* ================= Cassettefy · js/main.js =================
   Start-up: the list of pages, reloading when another tab or window changes the data, and boot(), which
   loads the tapes and opens the first page. Loaded last, after every other file. */

/* ======================= boot ======================= */
// Render map: associates each route name with its view-rendering function.
const RENDER = {
  home: renderHome,
  search: () => {
    renderChips();
    renderResults();
  },
  library: renderLibrary,
  deck: renderDeck,
  favorites: renderFavorites,
  recent: renderRecent,
  profile: renderProfile,
};
window.addEventListener('storage', () => {
  Store.reload();
  RENDER[currentRoute]();
  tick();
});
window.addEventListener('focus', reloadTapes);
// Application bootstrap: initializes stored data, handles callbacks, and renders the first route.
(async function boot() {
  const online = await Store.init();
  if (!online && API) toast('Can’t reach the server — working offline in this browser.');
  const now = Store.data.now;
  if (now && Store.tape(now.playlistId)) Player.load(now.playlistId, now.trackId, now.position || 0, false);
  const p = new URLSearchParams(location.search);
  if (p.get('play') && Store.tape(p.get('play'))) {
    Player.load(p.get('play'), null, 0, false);
    history.replaceState(null, '', location.pathname + '#deck');
  }
  if (p.get('q')) {
    const q = p.get('q');
    history.replaceState(null, '', location.pathname + '#search');
    route();
    runSearch(q);
  } else if (p.get('addto') && Store.tape(p.get('addto'))) {
    // From the editor's "Add songs from Search" when edit.html was opened as its own page.
    history.replaceState(null, '', location.pathname + '#search');
    openSearchFor(p.get('addto'));
  } else if (await handleSpotifyCallback()) {
    history.replaceState(null, '', location.pathname + '#home');
    route();
  } else {
    // Opening or refreshing the site starts on Home
    history.replaceState(null, '', location.pathname + '#home');
    route();
  }

  tick();
  // Tapes an earlier version imported as "Spotify import" get their real genres (js/spotify.js)
  fixImportedGenres();
})();
