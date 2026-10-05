/* ================= Cassettefy · js/app.js =================
   Shared app state: the two audio players (deck and search previews), the list of pages with their titles,
   and which page is showing. */

const deckAudio = $('#deckAudio'),
  previewAudio = $('#previewAudio');
const ROUTES = ['home', 'search', 'library', 'deck', 'favorites', 'recent', 'profile'];
const TITLES = {
  home: 'Home',
  search: 'Search',
  library: 'Library',
  deck: 'Cassette deck',
  favorites: 'Favorites',
  recent: 'Recently played',
  profile: 'Profile',
};
let currentRoute = 'home';
