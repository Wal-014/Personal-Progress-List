/**
 * Estado de la aplicación: perfiles guardados en localStorage, estado de la interfaz y utilidades de acceso.
 */

/** True when the saved data could not be read at startup and was moved to localStorage.gdpBroken. */
let storeWasUnreadable = false;

/** Reads the saved profiles. If they cannot be read, keeps a copy aside so the app can still start. */
function loadStore() {
    const raw = localStorage.gdp;
    if (!raw)
        return null;
    try {
        const s = JSON.parse(raw), ids = Object.keys(s.profs || {}).filter(id => s.profs[id]?.data);
        if (ids.length) {
            if (!ids.includes(s.cur))
                s.cur = ids[0];
            return s;
        }
    }
    catch {
    }
    localStorage.gdpBroken = raw;
    storeWasUnreadable = true;
    return null;
}

/** Contenedor de perfiles: { cur: id del perfil activo, profs: { id: { name, data } } }. */
let store = loadStore();

/** Datos del perfil activo (niveles, orden, wishlists y tags). */
let profile = store && store.profs[store.cur].data;

/** Estado de la interfaz: pantalla, selección, búsqueda, tema e idioma. */
let ui = { tab: 'home', wl: null, q: '', tag: '', z: 28, lang: localStorage.gl || 'es', theme: themeOf(localStorage.gt) };

/** True when the current screen is one of the level lists. */
const isListTab = () => ['classic', 'platform'].includes(ui.tab);

/** Data of a profile with no levels, wishlists or tags. */
const emptyProfile = () => ({ levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });

/** Guarda todos los perfiles en localStorage. */
const save = () => localStorage.gdp = JSON.stringify(store);

/** Busca un nivel por id en el perfil activo. */
const findLevel = id => profile.levels.find(l => l.id == id);

/** Checks that imported data has the structure the app needs to render it. */
function isValidProfileData(d) {
    const isObj = v => v != null && typeof v == 'object', isList = (a, check = isObj) => Array.isArray(a) && a.every(check);
    return isObj(d)
        && isList(d.levels)
        && isObj(d.order) && Array.isArray(d.order.classic) && Array.isArray(d.order.platform)
        && (d.wishlists == null || isList(d.wishlists, w => isObj(w) && isList(w.items)))
        && (d.tags == null || isList(d.tags));
}

/** Deaths per percent kept from saved or imported data: whole percentages from 0 to 100 with a count of zero or more. */
const cleanDeaths = d => Object.fromEntries(Object.entries(d && typeof d == 'object' ? d : {}).filter(([k, v]) => /^(100|[1-9]?\d)$/.test(k) && Number.isInteger(v) && v >= 0));

/**
 * Completa campos que puedan faltar en perfiles antiguos o importados.
 * Imported files are only checked for their shape, so statuses and deaths are cleaned here before any template renders them.
 */
function ensureProfileDefaults() {
    profile.wishlists = profile.wishlists || [];
    fixIds(profile.levels, 'n');
    profile.levels.forEach(l => l.deaths = cleanDeaths(l.deaths));
    fixIds(profile.wishlists, 'w');
    profile.wishlists.forEach(w => {
        fixIds(w.items, 'i');
        w.items.forEach(i => i.status = ['todo', 'prog', 'done'].includes(i.status) ? i.status : i.done ? 'done' : 'todo');
    });
    if (!profile.tags) {
        const pal = ['#ff2bd6', '#00e5ff', '#ffd400', '#7cff6b', '#ff7a3d', '#9d7bff'];
        profile.tags = [...new Set(profile.levels.flatMap(l => l.tags || []))].map((n, i) => ({ name: n, color: pal[i % pal.length] }));
        save();
    }
}

/** Gives a new id to every entry that has none or repeats an earlier one. */
function fixIds(list, prefix) {
    const seen = new Set();
    list.forEach(x => {
        if (!x.id || seen.has(x.id))
            x.id = newId(prefix);
        seen.add(x.id);
    });
}
