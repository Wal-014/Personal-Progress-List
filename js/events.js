/**
 * Eventos globales: clics, formularios, teclado y tooltips. Cada acción se identifica con el atributo data-act.
 */

document.body.onclick = e => {
    const g = e.target.closest('[data-tag]'), a = e.target.closest('[data-act]'), c = e.target.closest('[data-id]');
    if (e.target.classList.contains('modal'))
        return closeModal();
    if (g) {
        ui.tag = g.dataset.tag;
        if (!['classic', 'platform'].includes(ui.tab))
            ui.tab = 'classic';
        closeModal();
        return render();
    }
    if (a) {
        const k = a.dataset.act, id = a.dataset.id;
        if (k != 'menu' && ui.menu) {
            ui.menu = 0;
            render();
        }
        if (k == 'tab') {
            ui.tab = a.dataset.v;
            ui.tag = ui.q = '';
            ui.wl = null;
            ui.sel = null;
            ui.edit = 0;
        }
        else if (k == 'menu')
            ui.menu = !ui.menu;
        else if (k == 'bell')
            return openModal(bellUI());
        else if (k == 'legal')
            return openModal(legalUI(a.dataset.v));
        else if (k == 'ct')
            ui.tag = '';
        else if (k == 'step') {
            const i = a.parentNode.querySelector('input'), mn = i.min === '' ? -1e9 : +i.min, mx = i.max === '' ? 1e9 : +i.max;
            i.value = Math.max(mn, Math.min(mx, (+i.value || 0) + +a.dataset.d));
            i.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        else if (k == 'lang') {
            ui.lang = localStorage.gl = a.dataset.v;
        }
        else if (k == 'zi' || k == 'zo') {
            const w = qs('#tlw'), r = (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth;
            ui.z = k == 'zi' ? Math.min(160, ui.z * 1.5) : Math.max(6, ui.z / 1.5);
            render();
            const n = qs('#tlw');
            n.scrollLeft = r * n.scrollWidth - n.clientWidth / 2;
            return;
        }
        else if (k == 'add') {
            ui.sel = 'new';
            ui.edit = 1;
            renderPanel();
            qs('#fm input[name=name]')?.focus();
            return;
        }
        else if (k == 'edit') {
            const fb = !!qs('#md .modal'), l = findLevel(id);
            closeModal();
            if (l)
                ui.tab = l.kind;
            ui.sel = id;
            ui.edit = 1;
            if (fb)
                ui.q = ui.tag = '';
            render();
            if (fb)
                scrollSel();
            return;
        }
        else if (k == 'lvclose') {
            if (ui.edit && ui.sel != 'new')
                ui.edit = 0;
            else {
                ui.sel = null;
                ui.edit = 0;
            }
            render();
            return;
        }
        else if (k == 'tgadd') {
            qs('#tgs').insertAdjacentHTML('beforeend', tagChip(a.dataset.v));
            qs('#tgq').value = '';
            renderTagSuggestions();
            return;
        }
        else if (k == 'tgrm') {
            a.remove();
            renderTagSuggestions();
            return;
        }
        else if (k == 'close')
            return closeModal();
        else if (k == 'del') {
            askConfirm(t('confirm')).then(ok => {
                if (!ok)
                    return;
                profile.levels = profile.levels.filter(l => l.id != id);
                for (const o in profile.order)
                    profile.order[o] = profile.order[o].filter(x => x != id);
                save();
                closeModal();
                ui.sel = null;
                ui.edit = 0;
                render();
            });
            return;
        }
        else if (k == 'tags')
            return openModal(tagsUI());
        else if (k == 'tdel') {
            const ix = +a.dataset.i;
            askConfirm(t('confirmTag')).then(ok => {
                if (!ok)
                    return;
                const n = profile.tags.splice(ix, 1)[0].name;
                profile.levels.forEach(l => l.tags = (l.tags || []).filter(x => x != n));
                save();
                render();
                openModal(tagsUI());
            });
            return;
        }
        else if (k == 'tadd') {
            const n = qs('#nn').value.trim();
            if (!n || profile.tags.some(g => g.name == n))
                return;
            profile.tags.push({ name: n, color: qs('#nc').value });
            save();
            render();
            return openModal(tagsUI());
        }
        else if (k == 'sync')
            return syncWithAredl();
        else if (k == 'pnew') {
            askText(t('pname'), '').then(n => {
                if (!n)
                    return;
                const i = 'p' + Date.now();
                store.profs[i] = { name: n, data: { levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] } };
                store.cur = i;
                profile = store.profs[i].data;
                ui.tab = 'home';
                save();
                render();
            });
            return;
        }
        else if (k == 'psel') {
            store.cur = id;
            profile = store.profs[id].data;
            ensureProfileDefaults();
            ui.wl = null;
            save();
        }
        else if (k == 'pedit') {
            askText(t('pname'), store.profs[id].name).then(n => {
                if (!n)
                    return;
                store.profs[id].name = n;
                save();
                render();
            });
            return;
        }
        else if (k == 'pdelid') {
            if (Object.keys(store.profs).length < 2) {
                showAlert(t('lastP'));
                return;
            }
            askConfirm(t('pdel')).then(ok => {
                if (!ok)
                    return;
                delete store.profs[id];
                if (store.cur == id) {
                    store.cur = Object.keys(store.profs)[0];
                    profile = store.profs[store.cur].data;
                    ensureProfileDefaults();
                }
                save();
                render();
            });
            return;
        }
        else if (k == 'wnew') {
            askText(t('wname'), '').then(n => {
                if (!n)
                    return;
                const w = { id: 'w' + Date.now(), name: n, items: [] };
                profile.wishlists.push(w);
                ui.tab = 'wish';
                ui.wl = w.id;
                save();
                render();
            });
            return;
        }
        else if (k == 'wopen') {
            ui.tab = 'wish';
            ui.wl = id;
            enrichWishlist(profile.wishlists.find(w => w.id == id));
        }
        else if (k == 'home') {
            ui.tab = 'home';
            ui.wl = null;
            ui.sel = null;
            ui.edit = 0;
        }
        else if (k == 'wren') {
            askText(t('wname'), currentWishlist().name).then(n => {
                if (!n)
                    return;
                currentWishlist().name = n;
                save();
                render();
            });
            return;
        }
        else if (k == 'wdelL') {
            askConfirm(t('wconf')).then(ok => {
                if (!ok)
                    return;
                profile.wishlists = profile.wishlists.filter(w => w.id != ui.wl);
                ui.wl = null;
                ui.tab = 'home';
                save();
                render();
            });
            return;
        }
        else if (k == 'wadd')
            return openModal(wform());
        else if (k == 'wedit')
            return openModal(wform(currentWishlist().items.find(i => i.id == id)));
        else if (k == 'wdel') {
            askConfirm(t('wconf')).then(ok => {
                if (!ok)
                    return;
                currentWishlist().items = currentWishlist().items.filter(i => i.id != id);
                save();
                render();
            });
            return;
        }
        else if (k == 'wto') {
            const i = currentWishlist().items.find(x => x.id == id), kd = a.dataset.v;
            if (profile.levels.some(l => l.kind == kd && (i.levelId && String(l.levelId) == String(i.levelId) || l.name.toLowerCase() == i.name.toLowerCase()))) {
                showAlert(t('exists'));
                return;
            }
            profile.levels.push({ id: 'n' + Date.now(), name: i.name, kind: kd, levelId: i.levelId || null, creator: i.creator || null, diff: i.diff || null, ar: { s: 'n' }, deaths: {}, tags: [], notes: '', date: new Date().toISOString().slice(0, 10) });
            i.added = true;
            save();
            showAlert(t('addedOk'));
        }
        else if (k == 'imp')
            return qs('#fi').click();
        else if (k == 'exp') {
            const pr = store.profs[id || store.cur], u = URL.createObjectURL(new Blob([JSON.stringify({ ...pr.data, profileName: pr.name })], { type: 'application/json' })), x = document.createElement('a');
            x.href = u;
            x.download = pr.name.replace(/\W+/g, '-') + '.json';
            x.click();
            return;
        }
        return render();
    }
    if (c && !e.target.closest('form') && findLevel(c.dataset.id)) {
        if (c.classList.contains('pt')) {
            const l = findLevel(c.dataset.id);
            ui.tab = l.kind;
            ui.sel = l.id;
            ui.edit = 0;
            ui.q = ui.tag = '';
            render();
            scrollSel();
        }
        else if (c.classList.contains('card'))
            selectLevel(c.dataset.id);
    }
};
document.body.onsubmit = e => {
    e.preventDefault();
    if (e.target.id == 'wf') {
        const g = Object.fromEntries(new FormData(e.target)), w = currentWishlist();
        let i = w.items.find(x => x.id == e.target.dataset.id);
        if (!i) {
            i = { id: 'i' + Date.now(), status: 'todo' };
            w.items.push(i);
        }
        Object.assign(i, { name: g.name || '?', levelId: g.lid || null, creator: g.creator || null, diff: g.diff || null });
        i.chk = 0;
        save();
        closeModal();
        render();
        enrichWishlistItem(i);
        return;
    }
    const g = Object.fromEntries(new FormData(e.target)), N = k => g[k] === '' ? null : +g[k], C = k => {
        const v = N(k);
        return v == null ? v : Math.max(-10, Math.min(10, v));
    }, old = findLevel(e.target.dataset.id), o = old || { id: 'n' + Date.now() };
    Object.assign(o, { name: g.name || '?', kind: g.kind, levelId: g.lid || null, creator: g.creator || null, diff: g.diff || null, attC: N('attC'), attN: N('attN'), date: g.date || null, link: g.link || null, enj: C('enj'), lik: C('lik'), tN: parseDuration(g.tN), tP: parseDuration(g.tP), tPC: parseDuration(g.tPC), notes: g.notes, tags: new FormData(e.target).getAll('tg'), deaths: parseDeaths(g.deaths), ar: { s: g.as, p: g.as == 'r' ? N('ap') : null } });
    if (!old)
        profile.levels.push(o);
    for (const k in profile.order)
        profile.order[k] = profile.order[k].filter(x => x != o.id);
    if (g.pos)
        profile.order[o.kind].splice(Math.max(0, +g.pos - 1), 0, o.id);
    save();
    closeModal();
    ui.sel = o.id;
    ui.edit = 0;
    ui.tab = o.kind;
    render();
    scrollSel();
};
document.body.oninput = e => {
    if (e.target.form?.id == 'fm' && ['attC', 'attN', 'tN', 'tP', 'tPC'].includes(e.target.name))
        updateTotals(e.target.form);
    if (e.target.id == 'tgq')
        renderTagSuggestions();
    if (e.target.id == 'q') {
        ui.q = e.target.value.toLowerCase();
        renderList();
        if (!ui.q)
            scrollSel();
    }
};
document.body.onchange = e => {
    const i = e.target.id, ds = e.target.dataset;
    if (ds.wd != null) {
        currentWishlist().items.find(i => i.id == ds.wd).diff = e.target.value || null;
        save();
        render();
        return;
    }
    if (ds.wi != null) {
        currentWishlist().items.find(i => i.id == ds.wi).status = e.target.value;
        save();
        render();
        return;
    }
    if (ds.tc != null) {
        profile.tags[ds.tc].color = e.target.value;
        save();
        render();
        return;
    }
    if (ds.tn != null) {
        const g = profile.tags[ds.tn], v = e.target.value.trim();
        if (!v || profile.tags.some(x => x != g && x.name == v)) {
            e.target.value = g.name;
            return;
        }
        profile.levels.forEach(l => l.tags = (l.tags || []).map(x => x == g.name ? v : x));
        g.name = v;
        save();
        render();
        return;
    }
    if (e.target.form?.id == 'fm') {
        if (e.target.name == 'as' && e.target.value != 'r')
            e.target.form.elements.ap.value = '';
        if (['name', 'lid', 'kind'].includes(e.target.name))
            validateAgainstAredl(e.target.form);
        return;
    }
    if (i == 'th') {
        ui.theme = localStorage.gt = e.target.value;
    }
    else if (i == 'lg') {
        ui.lang = localStorage.gl = e.target.value;
    }
    else if (i == 'pf') {
        store.cur = e.target.value;
        profile = store.profs[store.cur].data;
        ensureProfileDefaults();
        ui.tab = 'home';
        ui.wl = null;
        save();
    }
    else if (i == 'fi') {
        const f = e.target.files[0];
        if (f)
            f.text().then(x => {
                const d = JSON.parse(x);
                if (!d.levels)
                    return showAlert('JSON?');
                askText(t('pname'), d.profileName || f.name.replace(/\.json$/, '')).then(n => {
                    if (!n)
                        return;
                    const id = 'p' + Date.now();
                    delete d.profileName;
                    store.profs[id] = { name: n, data: d };
                    store.cur = id;
                    profile = d;
                    ensureProfileDefaults();
                    save();
                    render();
                });
            });
        e.target.value = '';
        return;
    }
    else
        return;
    render();
};
document.onkeydown = e => {
    if (e.key == 'Escape')
        closeModal();
    if (e.key == 'Enter' && e.target.id == 'tgq') {
        e.preventDefault();
        qs('#tgr [data-act=tgadd]')?.click();
    }
};
document.body.onmousemove = e => {
    const tp = qs('#tip'), h = e.target.closest('[data-hp]'), p = e.target.closest('.pt'), k = h ? 'h' + h.dataset.hp : p ? 'p' + p.dataset.id : '';
    if (!k) {
        tp.style.display = 'none';
        tp.dataset.k = '';
        return;
    }
    if (tp.dataset.k != k) {
        tp.dataset.k = k;
        if (h)
            tp.innerHTML = `<b>${h.dataset.hp}%</b> · ${h.dataset.hn} ${t('dU')}`;
        else {
            const l = findLevel(p.dataset.id), u = thumbUrl(l);
            tp.innerHTML = `${u ? `<img src="${u}" alt="" onerror="this.remove()">` : ''}<b>${escapeHtml(l.name)}</b><br>${totalAttempts(l)} ${t('att')} · ${l.date}`;
        }
    }
    tp.style.display = 'block';
    tp.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - 250)) + 'px';
    tp.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - tp.offsetHeight - 10)) + 'px';
};
