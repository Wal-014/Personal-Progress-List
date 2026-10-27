/**
 * Level search used by the level and wishlist forms: search box, filters, result cards and the read-only fields they fill.
 */

/** Search of the open form: text searched, filters, results, next page, status and suggestions. */
let levelSearch = {};

/** Bumped by every search so an answer that arrives after a newer search is dropped. */
let levelSearchRun = 0;

/** Search box, filters and results panel. Drawing it resets the search for the open form. */
function levelSearchBox() {
    levelSearch = { q: '', f: { rated: 'all', rates: [], diffs: [] }, results: [], page: 0, more: false, status: 'idle', similar: [] };
    const opt = v => `<button type=button class=xs-txt data-act=gdrated data-v=${v} aria-pressed=${v == 'all'}>${t('f_' + v)}</button>`;
    const check = (name, value, face, label) => `<label><input type=checkbox name=${name} value="${value}"><img src="assets/faces/${face}.webp" alt="" width=32 height=32 decoding=async><span>${label}</span></label>`;
    const rates = ['rated', 'featured', 'epic', 'legendary', 'mythic'].map(r => check('gdrate', r, 'hard' + (r == 'rated' ? '' : '-' + r), t('r_' + r))).join('');
    const diffs = ['NA', ...DIFFICULTIES].map(d => check('gddiff', d, d == 'NA' ? 'unrated' : FACES[DIFFICULTIES.indexOf(d)], d)).join('');
    return `<fieldset class=gds><legend>${t('gdS')}</legend><label for=gdq>${t('gdQ')}</label><div class=gdq><input id=gdq type=search maxlength=40 autocomplete=off aria-describedby=gdh><button type=button class=blue data-act=gdgo>${t('gdGo')}</button></div>
<div class=gdf><div class=gdseg role=group aria-label="${t('f_rating')}">${['all', 'rated', 'unrated'].map(opt).join('')}</div><details class=ms name=gdms data-filter=rates hidden><summary>${t('f_rates')} · ${t('f_all')}</summary><div class=msp>${rates}</div></details><details class=ms name=gdms data-filter=diffs><summary>${t('diff')} · ${t('f_all')}</summary><div class=msp>${diffs}</div></details><button type=button class="xs dg gdclr" data-act=gdclear aria-label="${t('gdClear')}" title="${t('gdClear')}" hidden>${ICONS.del}</button></div>
<p id=gdm class=gdm role=status></p><div id=gdr class=gdr hidden></div><small id=gdh class=by>${t('gdHint')}</small></fieldset>`;
}

/** Updates filter controls in place, preserving open dropdowns and checkbox focus. */
function renderLevelFilters() {
    const f = levelSearch.f;
    qs('.gdclr').hidden = f.rated == 'all' && !f.rates.length && !f.diffs.length;
    document.querySelectorAll('[data-act=gdrated]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v == f.rated));
    document.querySelectorAll('.gdf .ms').forEach(d => {
        const rates = d.dataset.filter == 'rates', selected = f[d.dataset.filter];
        d.hidden = rates ? f.rated != 'rated' : f.rated == 'unrated';
        if (d.hidden)
            d.open = false;
        const count = rates ? selected.length : effectiveFilters(f).diffs.length;
        d.querySelector('summary').textContent = t(rates ? 'f_rates' : 'diff') + ' · ' + (count || t('f_all'));
        d.querySelectorAll('input').forEach(i => {
            i.checked = selected.includes(i.value);
            i.closest('label').hidden = i.value == 'NA' && f.rated == 'rated';
        });
    });
}

/** Redraws changed filters and searches again when the box has text. */
function changeLevelFilters() {
    renderLevelFilters();
    if (qs('#gdq').value.trim())
        runLevelSearch();
    else
        renderLevelSearch();
}

/** A result: the whole card picks the level. The thumbnail fills its background, black when there is none. */
function resultCard(l, i) {
    const u = thumbUrl(l);
    return `<button type=button class=gdc data-act=gdpick data-i=${i}${u ? ` style="--th:url('${u}')"` : ''}><span class=info><span class=nm>${escapeHtml(l.name)}</span><span class=by>ID ${escapeHtml(l.levelId)} · ${t('by')} ${escapeHtml(orDash(l.creator))}${l.kind == 'platform' ? ' · ' + t('platform') : ''}</span></span>${difficultyFace(l)}</button>`;
}

function renderLevelSearch() {
    const box = qs('#gdr'), s = levelSearch;
    if (!box)
        return;
    const tryName = n => `<button type=button class=xs-txt data-act=gdtry data-v="${escapeHtml(n)}">${escapeHtml(n)}</button>`;
    qs('#gdm').textContent = { busy: t('gdBusy'), error: t('gdErr'), none: t('gdNone') + (s.similar.length ? ` ${t('didYouMean')}` : ''), idle: s.results.length ? t(s.results.length == 1 ? 'gdN1' : 'gdN').replace('{n}', s.results.length) : '' }[s.status];
    box.innerHTML = s.status == 'none' ? (s.similar.length ? `<p class=gdsim>${s.similar.map(tryName).join('')}</p>` : '')
        : s.results.map(resultCard).join('') + (s.more && s.status == 'idle' ? `<button type=button class="xs-txt gdmore" data-act=gdmore>${t('gdMore')}</button>` : '');
    box.hidden = !box.innerHTML;
    renderLevelFilters();
}

/** Runs the search in the box, or loads its next page. Invalid text is reported on the box and nothing is requested. */
async function runLevelSearch(next) {
    const s = levelSearch, box = qs('#gdq');
    if (!next) {
        const q = cleanQuery(box.value);
        if (!q) {
            box.setCustomValidity(t('gdBad'));
            return box.reportValidity();
        }
        Object.assign(s, { q, results: [], page: 0, similar: [] });
    }
    const run = ++levelSearchRun;
    s.status = 'busy';
    renderLevelSearch();
    try {
        // A page can lose all its levels to the filters, so a few more pages are tried before giving up
        do {
            const { levels, more } = await searchLevels(s.q, s.f, s.page);
            if (run != levelSearchRun)
                return;
            s.results.push(...levels.filter(l => !s.results.some(r => r.levelId == l.levelId)));
            s.more = more;
            s.page++;
        } while (!s.results.length && s.more && s.page < 5);
        s.status = s.results.length ? 'idle' : 'none';
        if (!s.results.length)
            s.similar = await similarLevelNames(s.q);
    }
    catch {
        if (run != levelSearchRun)
            return;
        s.status = 'error';
    }
    renderLevelSearch();
}

/** Fills the form's read-only level fields with a picked result. Picking another result replaces them; searching again leaves them as they are. */
function pickLevel(f, l) {
    const set = (k, v) => {
        if (f.elements[k])
            f.elements[k].value = v ?? '';
    };
    set('name', l.name);
    set('lid', l.levelId);
    set('creator', l.creator);
    set('diff', l.diff);
    set('rating', l.rating);
    set('kind', l.kind);
    qs('#lf-face').outerHTML = difficultyFace(l, 'lf-face');
    qs('#lf-diffT').textContent = difficultyLabel(l);
    set('kindT', t(l.kind));
    qs('#gdq').setCustomValidity('');
    if (f.id == 'fm')
        fillAredlPosition(f);
}

/** Read-only level fields filled by the search: name, ID, creator, difficulty and, in the level form, the list. */
function levelFields(o, withKind) {
    const ro = (k, label, v) => `<div><label for=lf-${k}>${t(label)}</label><input id=lf-${k} name=${k} value="${escapeHtml(v)}" readonly class=ro></div>`;
    return ro('name', 'name', o.name) + ro('lid', 'lid', o.levelId) + ro('creator', 'creator', o.creator)
        + `<div><span class=lab>${t('diff')}</span><div class=fdiff>${difficultyFace(o, 'lf-face')}<span id=lf-diffT>${o.levelId || o.name ? escapeHtml(difficultyLabel(o)) : ''}</span></div></div>`
        + `<input type=hidden name=diff value="${escapeHtml(o.diff)}"><input type=hidden name=rating value="${escapeHtml(o.rating)}">`
        + (withKind ? ro('kindT', 'kind', t(o.kind)) + `<input type=hidden name=kind value="${escapeHtml(o.kind)}">` : '');
}
