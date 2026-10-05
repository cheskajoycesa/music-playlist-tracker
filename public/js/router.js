/* ================= Cassettefy · js/router.js =================
   Page navigation: route() shows the page named in the URL hash (#home, #search, #library, #deck,
   #favorites, #recent, #profile), or opens the editor popup for #edit/<tape id>. */

/* ======================= router ======================= */
// Routing: reads the URL hash and renders the requested application view.
function route() {
  // Main-page routes stay inside index.html. Editing is handled by edit.html.
  const r = (location.hash || '#home').slice(1).split('/')[0];
  if (r === 'edit') {
    const parts = (location.hash || '').slice(1).split('/');
    const id = parts[1] ? decodeURIComponent(parts[1]) : '';
    openEditorDialog(id);
    return;
  }

  // Any normal route closes the editor overlay and restores the Library UI.
  closeEditorDialog(false);

  const routeName = ROUTES.includes(r) ? r : 'home';
  currentRoute = routeName;
  // Leaving the Deck forgets which tape was only being looked at; coming back shows the playing tape.
  if (routeName !== 'deck') Deck.viewId = null;

  $$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + routeName));
  $$('.navi').forEach((a) => {
    const on = a.dataset.route === routeName;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  document.body.classList.toggle('on-deck', routeName === 'deck');
  document.title = 'Cassettefy · ' + TITLES[routeName];
  $('#content').scrollTop = 0;
  RENDER[routeName]();
}
window.addEventListener('hashchange', route);
