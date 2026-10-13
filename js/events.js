/**
 * Eventos globales: clics, formularios, teclado y tooltips. Cada acción se identifica con el atributo data-act.
 */

/** Re-renders behind the pause menu and reopens it, keeping focus on the control that was used. */
function reopenPause(selector) {
    render();
    openModal(pauseUI());
    qs('#md ' + selector)?.focus();
}

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
        if (a.closest('.pause') && ['wnew', 'tags', 'exp', 'imp', 'legal'].includes(k))
            closeModal();
        if (k == 'tab') {
            ui.tab = a.dataset.v;
            ui.tag = ui.q = '';
            ui.wl = null;
            ui.sel = null;
            ui.edit = 0;
        }
        else if (k == 'pause')
            return openModal(pauseUI());
        else if (k == 'theme') {
            ui.theme = localStorage.gt = a.dataset.v;
            return reopenPause(`[data-act=theme][data-v=${a.dataset.v}]`);
        }
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
            if (a.closest('.pause'))
                return reopenPause(`[data-act=lang][data-v=${a.dataset.v}]`);
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
            if (!['classic', 'platform'].includes(ui.tab)) {
                closeModal();
                ui.tab = 'classic';
                ui.wl = null;
                render();
            }
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
            // tagChip escapes the tag name and tagColor only returns #rrggbb, so the HTML is safe
            // nosemgrep: typescript.react.security.audit.react-unsanitized-method.react-unsanitized-method
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
            askConfirm(t(profile.tags[ix].name == PRE_TAG ? 'preTagConfirm' : 'confirmTag')).then(ok => {
                if (!ok)
                    return;
                const n = profile.tags.splice(ix, 1)[0].name;
                profile.levels.forEach(l => l.tags = (l.tags || []).filter(x => x != n));
                if (ui.tag == n)
                    ui.tag = '';
                save();
                render();
                openModal(tagsUI());
            });
            return;
        }
        else if (k == 'tadd') {
            const n = qs('#nn').value.trim();
            if (!n || profile.tags.some(g => g.name == n))
                return showAlert(t(n ? 'tagExists' : 'tagEmpty'));
            profile.tags.push({ name: n, color: qs('#nc').value });
            save();
            render();
            return openModal(tagsUI());
        }
        else if (k == 'sync')
            return syncWithAredl(true);
        else if (k == 'pnew') {
            askText(t('pname'), '').then(n => {
                if (!n)
                    return;
                const i = newId('p');
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
            matchWithAredl(profile.levels);
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
                const w = { id: newId('w'), name: n, items: [] };
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
            if (isInList(i, kd)) {
                showAlert(t('exists'));
                return;
            }
            profile.levels.push({ id: newId('n'), name: i.name, kind: kd, levelId: i.levelId || null, creator: i.creator || null, diff: i.diff || null, ar: { s: 'n' }, deaths: {}, tags: [], notes: '', date: todayLocal() });
            i.added = true;
            save();
            showAlert(t('addedOk'));
        }
        else if (k == 'imp')
            return qs('#fi').click();
        else if (k == 'exp') {
            const pr = store.profs[id || store.cur], u = URL.createObjectURL(new Blob([JSON.stringify({ ...pr.data, profileName: pr.name })], { type: 'application/json' })), x = document.createElement('a');
            x.href = u;
            // Only characters that file systems reject are replaced, so accents and non-Latin names survive
            x.download = (pr.name.trim().replace(/[/:*?"<>|\s]+/g, '-') || 'profile') + '.json';
            x.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
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
        else if (c.classList.contains('lv'))
            selectLevel(c.dataset.id);
    }
};
document.body.onsubmit = e => {
    e.preventDefault();
    if (e.target.id == 'wf') {
        const g = Object.fromEntries(new FormData(e.target)), w = currentWishlist();
        let i = w.items.find(x => x.id == e.target.dataset.id);
        if (!i) {
            i = { id: newId('i'), status: 'todo' };
            w.items.push(i);
        }
        Object.assign(i, { name: g.name.trim(), levelId: g.lid || null, creator: g.creator || null, diff: g.diff || null });
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
    }, old = findLevel(e.target.dataset.id), o = old || { id: newId('n') };
    Object.assign(o, { name: g.name.trim(), kind: g.kind, levelId: g.lid || null, creator: g.creator || null, diff: g.diff || null, attC: N('attC'), attN: N('attN'), date: g.date || null, link: g.link || null, enj: C('enj'), lik: C('lik'), tN: parseDuration(g.tN), tP: parseDuration(g.tP), tPC: parseDuration(g.tPC), notes: g.notes, tags: new FormData(e.target).getAll('tg'), deaths: parseDeaths(g.deaths), ar: { s: g.as, p: g.as == 'r' ? N('ap') : null } });
    if (!old)
        profile.levels.push(o);
    matchWithAredl([o]);
    for (const k in profile.order)
        profile.order[k] = profile.order[k].filter(x => x != o.id);
    if (g.pos && !isPre(o)) {
        const order = profile.order[o.kind], before = rankedIds(o.kind)[Math.max(0, +g.pos - 1)];
        order.splice(before ? order.indexOf(before) : order.length, 0, o.id);
    }
    save();
    closeModal();
    ui.sel = o.id;
    ui.edit = 0;
    ui.tab = o.kind;
    render();
    scrollSel();
};
document.body.oninput = e => {
    if (['fm', 'wf'].includes(e.target.form?.id))
        e.target.setCustomValidity(fieldError(e.target.name, e.target.value));
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
            return showAlert(t(v ? 'tagExists' : 'tagEmpty'));
        }
        const rename = () => {
            const wasPre = g.name == PRE_TAG;
            profile.levels.forEach(l => l.tags = (l.tags || []).map(x => x == g.name ? v : x));
            if (ui.tag == g.name)
                ui.tag = v;
            g.name = v;
            save();
            render();
            if (wasPre || v == PRE_TAG)
                openModal(tagsUI());
        };
        if (g.name != PRE_TAG || v == g.name)
            return rename();
        askConfirm(t('preTagConfirm')).then(ok => {
            if (ok)
                rename();
            else
                e.target.value = g.name;
        });
        return;
    }
    if (e.target.form?.id == 'fm') {
        if (e.target.name == 'as' && e.target.value != 'r')
            e.target.form.elements.ap.value = '';
        if (['name', 'lid', 'kind'].includes(e.target.name))
            validateAgainstAredl(e.target.form);
        return;
    }
    if (i == 'fi') {
        const f = e.target.files[0];
        if (f)
            f.text().then(x => {
                let d;
                try {
                    d = JSON.parse(x);
                }
                catch {
                    return showAlert(t('badFile'));
                }
                if (!isValidProfileData(d))
                    return showAlert(t('badFile'));
                askText(t('pname'), d.profileName || f.name.replace(/\.json$/, '')).then(n => {
                    if (!n)
                        return;
                    const id = newId('p');
                    delete d.profileName;
                    store.profs[id] = { name: n, data: d };
                    store.cur = id;
                    profile = d;
                    ensureProfileDefaults();
                    matchWithAredl(profile.levels);
                    save();
                    render();
                });
            });
        e.target.value = '';
    }
};
document.onkeydown = e => {
    if (e.key == 'Escape') {
        closeModal();
    }
    if ((e.key == 'Enter' || e.key == ' ') && e.target.matches('[role=button]')) {
        e.preventDefault();
        e.target.click();
    }
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
            tp.innerHTML = `${u ? `<img src="${u}" alt="">` : ''}<b>${escapeHtml(l.name)}</b><br>${escapeHtml(totalAttempts(l))} ${t('att')} · ${escapeHtml(formatDate(l.date))}`;
            tp.querySelector('img')?.addEventListener('error', e => e.target.remove());
        }
    }
    tp.style.display = 'block';
    tp.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - 250)) + 'px';
    tp.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - tp.offsetHeight - 10)) + 'px';
};
/** Another tab saved: load its data so this tab's next save does not overwrite it. Open forms are left alone. */
window.addEventListener('storage', e => {
    if (e.key != 'gdp' || !e.newValue)
        return;
    const cur = store.cur;
    try {
        store = JSON.parse(e.newValue);
    }
    catch {
        return;
    }
    if (store.profs[cur])
        store.cur = cur;
    profile = store.profs[store.cur].data;
    ensureProfileDefaults();
    if (!qs('form, .modal'))
        render();
});
