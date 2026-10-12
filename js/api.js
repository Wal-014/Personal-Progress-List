/**
 * Integración con servicios externos: lista de la AREDL (posiciones y publishers) y búsqueda de datos para las wishlists.
 */

/** Obtiene el nombre visible de un usuario de la API. */
const nm = x => typeof x == 'string' ? x : x && (x.global_name || x.username || x.name || x.display_name || x.discord_username || Object.values(x).find(v => typeof v == 'string' && v.length < 32 && !/^[0-9a-f-]{20,}$/i.test(v))) || null;

/** Normaliza un nombre para compararlo: sin mayúsculas, tildes, espacios ni símbolos. */
const normalizeName = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Cached levels of one list, skipping entries whose name has no letters or digits (they would match any name). */
const namedAredlLevels = kind => aredlCache.filter(x => x.k == kind && normalizeName(x.n));

/**
 * Busca un nivel por nombre en la caché de la AREDL (kind: 'd' clásicos, 'p' plataforma).
 * First an exact normalized match; otherwise the single official name that contains what was typed.
 * The reverse (typed text containing an official name) is not accepted: "Kenos Remake" is not "Kenos".
 */
function findAredlByName(name, kind) {
    const n = normalizeName(name);
    if (!n)
        return null;
    const pool = namedAredlLevels(kind);
    const exact = pool.find(x => normalizeName(x.n) == n);
    if (exact)
        return exact;
    const partial = n.length < 4 ? [] : pool.filter(x => normalizeName(x.n).includes(n));
    return partial.length == 1 ? partial[0] : null;
}

/** Hasta tres nombres de la AREDL que se parecen al escrito (para sugerir). */
function similarAredlNames(name, kind) {
    const n = normalizeName(name).slice(0, 4);
    return n ? namedAredlLevels(kind).filter(x => normalizeName(x.n).includes(n)).slice(0, 3).map(x => x.n) : [];
}

/** Descarga la lista de la AREDL y de la AREPL si todavía no está en caché (o siempre, con force). Returns true when fresh lists arrived. */
async function loadAredlList(force) {
    if (aredlCache.length && !force)
        return false;
    const get = async (q) => {
        try {
            const r = await (await fetch(AREDL_API + q)).json();
            return Array.isArray(r) ? r : r.data || [];
        }
        catch (e) {
            return [];
        }
    }, [d, q] = await Promise.all([get('aredl/levels'), get('arepl/levels')]);
    const fresh = [...d.map(x => ({ k: 'd', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) })), ...q.map(x => ({ k: 'p', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) }))];
    if (fresh.length)
        aredlCache = fresh;
    if (aredlCache.length)
        localStorage.gar = JSON.stringify(aredlCache);
    return fresh.length > 0;
}

/** The lists are downloaded again at most once per visit to look for levels missing from the cache. */
let aredlReloadedForMissing = false;

/** Completa ID y publisher de un nivel de wishlist consultando la AREDL. */
async function enrichWishlistItem(it) {
    try {
        await loadAredlList();
        const find = () => it.levelId ? aredlCache.find(x => String(x.i) == String(it.levelId)) : findAredlByName(it.name, 'd') || findAredlByName(it.name, 'p');
        let m = find();
        if (!m && !aredlReloadedForMissing) {
            aredlReloadedForMissing = true;
            await loadAredlList(true);
            m = find();
        }
        if (m) {
            it.levelId = it.levelId || String(m.i);
            if (!it.creator) {
                const r = await fetch(AREDL_API + (m.k == 'p' ? 'arepl' : 'aredl') + '/levels/' + m.i);
                if (r.ok) {
                    const u = nm((await r.json()).publisher);
                    if (u)
                        it.creator = u;
                }
            }
        }
    }
    catch (e) {
    }
    it.chk = 1;
    save();
    render();
}

/** Completa los datos de todos los niveles pendientes de una wishlist. */
async function enrichWishlist(w) {
    for (const i of w.items)
        if (!i.chk && (!i.creator || !i.levelId)) {
            await enrichWishlistItem(i);
            await new Promise(s => setTimeout(s, 300));
        }
}

/** Copia local de la lista de la AREDL (se llena con «Actualizar desde AREDL»). */
let aredlCache = JSON.parse(localStorage.gar || '[]');

/** Actualiza ID, puesto y publisher de todos los niveles del perfil desde la AREDL. */
async function syncWithAredl() {
    if (ui.sync)
        return;
    // Progress lives in ui.sync so it survives re-renders; the button is looked up again every time.
    const progress = s => {
        ui.sync = s;
        const b = qs('[data-act=sync]');
        if (b) {
            b.textContent = '⟳ ' + s;
            b.disabled = true;
        }
    };
    try {
        progress('…');
        if (!await loadAredlList(true))
            throw Error('no response');
        const by = new Map();
        aredlCache.forEach(x => {
            by.set(x.k + x.i, x);
            by.set(x.k + x.n.toLowerCase(), x);
        });
        let n = 0;
        const hit = [];
        profile.levels.forEach(l => {
            const k = l.kind == 'platform' ? 'p' : 'd', x = (l.levelId && by.get(k + l.levelId)) || by.get(k + l.name.toLowerCase()) || findAredlByName(l.name, k);
            if (x) {
                l.levelId = l.levelId || String(x.i);
                l.creator = l.creator || x.u;
                l.ar = { s: 'r', p: x.p };
                n++;
                hit.push(l);
            }
        });
        const todo = hit.filter(l => !l.creator);
        let j = 0, pc = 0;
        const sleep = ms => new Promise(s => setTimeout(s, ms));
        const fetchJson = async (u) => {
            for (let i = 0; i < 4; i++) {
                const r = await fetch(u);
                if (r.status == 429) {
                    await sleep(Math.max(2000, (+r.headers.get('retry-after') || 0) * 1000));
                    continue;
                }
                return r.ok ? r.json() : null;
            }
            return null;
        };
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (j < todo.length) {
                const l = todo[j++];
                progress(`${j}/${todo.length}`);
                try {
                    const x = await fetchJson(AREDL_API + (l.kind == 'platform' ? 'arepl' : 'aredl') + '/levels/' + l.levelId), u = x && nm(x.publisher);
                    if (u) {
                        l.creator = u;
                        pc++;
                    }
                }
                catch (e) {
                }
                await sleep(250);
            }
        }));
        save();
        ui.sync = '';
        render();
        const count = k => aredlCache.filter(x => x.k == k).length;
        showAlert(`${t('ok')}: ${n}/${profile.levels.length}\nAREDL ${count('d')} · AREPL ${count('p')}\n${t('creator')}: ${pc}/${todo.length}`);
    }
    catch (e) {
        ui.sync = '';
        render();
        showAlert('AREDL: ' + e.message);
    }
}
