/**
 * Estado de la aplicación: perfiles guardados en localStorage, estado de la interfaz y utilidades de acceso.
 */

/** Contenedor de perfiles: { cur: id del perfil activo, profs: { id: { name, data } } }. */
let store = JSON.parse(localStorage.gdp || 'null');

/** Datos del perfil activo (niveles, orden, wishlists y tags). */
let profile = store && store.profs[store.cur].data;

/** Estado de la interfaz: pantalla, selección, búsqueda, tema e idioma. */
let ui = { tab: 'home', menu: 0, wl: null, q: '', tag: '', z: 28, lang: localStorage.gl || 'es', theme: localStorage.gt || 'dark' };

/** Guarda todos los perfiles en localStorage. */
const save = () => localStorage.gdp = JSON.stringify(store);

/** Busca un nivel por id en el perfil activo. */
const findLevel = id => profile.levels.find(l => l.id == id);

/** Completa campos que puedan faltar en perfiles antiguos o importados. */
function ensureProfileDefaults() {
    profile.wishlists = profile.wishlists || [];
    profile.wishlists.forEach(w => {
        w.id = w.id || 'w' + Date.now();
        w.items.forEach((i, k) => {
            i.id = i.id || 'i' + k + Date.now();
            i.status = i.status || (i.done ? 'done' : 'todo');
        });
    });
    if (!profile.tags) {
        const pal = ['#ff2bd6', '#00e5ff', '#ffd400', '#7cff6b', '#ff7a3d', '#9d7bff'];
        profile.tags = [...new Set(profile.levels.flatMap(l => l.tags || []))].map((n, i) => ({ name: n, color: pal[i % 6] }));
        save();
    }
}
