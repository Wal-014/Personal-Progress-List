/**
 * Integración con servicios externos: lista de la AREDL (posiciones y publishers) y búsqueda de datos para las wishlists.
 */

/** Obtiene el nombre visible de un usuario de la API. */
const nm = x => typeof x == 'string' ? x : x && (x.global_name || x.username || x.name || x.display_name || x.discord_username || Object.values(x).find(v => typeof v == 'string' && v.length < 32 && !/^[0-9a-f-]{20,}$/i.test(v))) || null;

/** Descarga la lista de la AREDL y de la AREPL si todavía no está en caché. */
async function loadAredlList() {
    if (aredlCache.length)
        return;
    const get = async (q) => {
        try {
            const r = await (await fetch(AREDL_API + q)).json();
            return Array.isArray(r) ? r : r.data || [];
        }
        catch (e) {
            return [];
        }
    }, [d, q] = await Promise.all([get('aredl/levels'), get('arepl/levels')]);
    aredlCache = [...d.map(x => ({ k: 'd', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) })), ...q.map(x => ({ k: 'p', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) }))];
    if (aredlCache.length)
        localStorage.gar = JSON.stringify(aredlCache);
}

/** Completa ID y publisher de un nivel de wishlist consultando la AREDL. */
async function enrichWishlistItem(it) {
    try {
        await loadAredlList();
        const m = aredlCache.find(x => it.levelId ? String(x.i) == String(it.levelId) : x.n.toLowerCase() == it.name.toLowerCase());
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
    const b = qs('[data-act=sync]');
    try {
        b.textContent = '⟳ …';
        const get = async (p) => {
            try {
                const r = await (await fetch(AREDL_API + p)).json();
                return Array.isArray(r) ? r : r.data || [];
            }
            catch (e) {
                return [];
            }
        };
        const [d, p] = await Promise.all([get('aredl/levels'), get('arepl/levels')]);
        if (!d.length && !p.length)
            throw Error('no response');
        aredlCache = [...d.map(x => ({ k: 'd', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) })), ...p.map(x => ({ k: 'p', i: x.level_id, n: String(x.name), p: x.position, u: nm(x.publisher) }))];
        localStorage.gar = JSON.stringify(aredlCache);
        const by = new Map();
        aredlCache.forEach(x => {
            by.set(x.k + x.i, x);
            by.set(x.k + x.n.toLowerCase(), x);
        });
        let n = 0;
        const hit = [];
        profile.levels.forEach(l => {
            const k = l.kind == 'platform' ? 'p' : 'd', x = (l.levelId && by.get(k + l.levelId)) || by.get(k + l.name.toLowerCase());
            if (x) {
                l.levelId = l.levelId || String(x.i);
                l.creator = l.creator || x.u;
                l.ar = { s: 'r', p: x.p };
                n++;
                hit.push(l);
            }
        });
        const todo = hit.filter(l => !l.creator);
        let j = 0, pc = 0, smp = '';
        const dg = s => {
            if (smp.length < 500)
                smp += ' ' + s;
        }, sleep = ms => new Promise(s => setTimeout(s, ms));
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
                b.textContent = `⟳ ${j}/${todo.length}`;
                try {
                    const x = await fetchJson(AREDL_API + (l.kind == 'platform' ? 'arepl' : 'aredl') + '/levels/' + l.levelId), u = x && nm(x.publisher);
                    if (u) {
                        l.creator = u;
                        pc++;
                    }
                    else
                        dg(x ? 'publisher=' + JSON.stringify(x.publisher) : 'detail=null');
                }
                catch (e) {
                    dg('err:' + e.message);
                }
                await sleep(250);
            }
        }));
        save();
        render();
        showAlert(`${t('ok')}: ${n}/${profile.levels.length}\nAREDL ${d.length} · AREPL ${p.length}\n${t('creator')}: ${pc}/${todo.length}${pc == todo.length ? '' : '\n' + smp}`);
    }
    catch (e) {
        render();
        showAlert('AREDL: ' + e.message);
    }
}
