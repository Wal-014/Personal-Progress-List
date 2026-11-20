/** Shared navigation, header, page title and settings. */

function syncDrawer() {
    const sidebar = qs('#shell-sidebar');
    if (!sidebar)
        return;
    const narrow = !!window.matchMedia?.('(width < 1280px)').matches;
    if (!narrow)
        ui.drawer = false;
    const open = narrow && !!ui.drawer;
    sidebar.inert = narrow && !open;
    sidebar.setAttribute('data-open', String(open));
    if (open) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
    }
    else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
    }
    qs('#shell-menu').setAttribute('aria-expanded', String(open));
    qs('.shell-content').inert = open;
    qs('.drawer-backdrop').hidden = !open;
}

function setDrawer(open) {
    ui.drawer = open;
    syncDrawer();
    if (ui.drawer)
        qs('#shell-sidebar')?.querySelectorAll('button:not(:disabled), a[href]')[0]?.focus();
    else {
        document.querySelectorAll('#shell-sidebar :popover-open').forEach(menu => menu.hidePopover());
        qs('#shell-menu')?.focus({ preventScroll: true });
    }
}

function drawerKeydown(event) {
    if (!ui.drawer)
        return false;
    if (event.key == 'Escape') {
        event.preventDefault();
        setDrawer(false);
        return true;
    }
    if (event.key == 'Tab') {
        const controls = [...qs('#shell-sidebar').querySelectorAll('button:not(:disabled), a[href]')].filter(control => control.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement == first || !event.shiftKey && document.activeElement == last) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
        }
    }
    return false;
}

function shellNavigation() {
    const navItem = (kind, label, icon) => `<button data-act=tab data-v=${kind}${kind == ui.tab ? ' aria-current=page' : ''}>${icon}<span>${t(label)}</span></button>`;
    const choices = ['classic', 'platform'].map(kind => `<button class=pma data-act=tab data-v=${kind}>${ICONS[kind]}<span>${t(kind)}</span><b>${profile.levels.filter(level => level.kind == kind).length.toLocaleString(ui.lang)}</b></button>`).join('');
    return `<nav class=shell-nav aria-label="${t('nav')}">${navItem('home', 'home', ICONS.navHome)}<button popovertarget=hlists${isListTab() ? ' aria-current=page' : ''}>${ICONS.navLists}<span>${t(canEdit() ? 'lists' : 'publicLists')}</span></button><div id=hlists class=pmenu popover>${choices}</div>${navItem('wish', 'wish', ICONS.navWish)}${navItem('stats', 'stats', ICONS.navStats)}</nav>`;
}

function shellFooter() {
    return `<div class=shell-footer>${canEdit() ? '' : `<button data-act=myprogress>${ICONS.back}<span>${t('publicBack')}</span></button>`}<button data-act=pause>${ICONS.navSettings}<span>${t('pause')}</span></button></div>`;
}

function shellPageTitle() {
    if (ui.tab == 'home')
        return '';
    const wish = ui.tab == 'wish' && currentWishlist();
    const title = isListTab() ? t(canEdit() ? 'lists' : 'publicLists') : wish ? wish.name : t(ui.tab);
    const icon = isListTab() ? ICONS.navLists : ui.tab == 'wish' ? ICONS.navWish : ICONS.navStats;
    const primary = !canEdit() ? '' : ui.tab == 'wish' && !wish ? `<button data-act=wnew>${ICONS.actionAdd}${t('palWish')}</button>` : '';
    return `<div class=page-title>${wish ? `<button data-act=tab data-v=wish aria-label="${t('back2')}">${ICONS.actionBack}</button>` : ''}<h2>${icon}${escapeHtml(title)}</h2>${primary}</div>`;
}

function sharedShell(screen) {
    const count = canEdit() ? alerts().length : 0;
    const utilities = canEdit() ? `<div class=shell-utilities><span id=cloud-header class=cloud-header>${cloudHeaderStatus()}</span><span id=syncst class=syncst role=status>${syncStatus()}</span><button class=sq data-act=bell aria-label="${t('bell')}${count ? ` (${count})` : ''}">${ICONS.bell}${count ? `<b class=bdg aria-hidden=true>${count}</b>` : ''}</button></div>` : '';
    return `<div class=app-shell><svg class=shell-paints width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="nav-metal" gradientUnits="userSpaceOnUse" x1="3" y1="2" x2="21" y2="22"><stop class="nav-ink"/><stop offset=".32" class="nav-ink"/><stop offset=".43" class="nav-glint"/><stop offset=".56" class="nav-ink"/><stop offset=".82" class="nav-glint"/><stop offset="1" class="nav-ink"/></linearGradient></defs></svg><aside id=shell-sidebar class=shell-sidebar aria-label="${t('nav')}"><div class=shell-identity>${profileSwitcher()}</div>${shellNavigation()}${shellFooter()}</aside><button class=drawer-backdrop data-act=drawerclose tabindex=-1 aria-label="${t('close')}" hidden></button><div class=shell-content><header class=shell-header><button id=shell-menu class=shell-menu data-act=drawer aria-expanded=false aria-controls=shell-sidebar aria-label="${t('nav')}">${ICONS.menu}</button><div class=shell-brand><span class=shell-brand-frame>${ICONS.app}</span><h1>Personal Progress List</h1></div>${utilities}</header><main class="shell-main${ui.tab == 'home' ? ' home hl' : isListTab() ? ' wide' : ''}">${shellPageTitle()}${ui.tab == 'home' ? screen : `<div class=${isListTab() ? 'list-surface' : 'legacy-surface'}>${screen}</div>`}</main></div></div>`;
}

const syncStatus = () => ui.sync ? `${ICONS.sync}<span>${t('syncing')}</span>` : '';

/** Last AREDL update, how many levels are on the list, and the manual update button. */
function aredlLine() {
    const last = +localStorage.gas, on = profile.levels.filter(l => l.ar?.s == 'r').length;
    return `${last ? `${t('aredlUpd')} ${timeAgo(last)}` : t('aredlNever')} · ${t('aredlOn').replace('{n}', on).replace('{t}', profile.levels.length)} <button class=xs-txt data-act=sync ${ui.sync ? 'disabled' : ''}>${t(ui.sync ? 'syncing' : 'syncNow')}</button>`;
}

/** Updates the sync chip and the pause menu line without redrawing the screen. */
function renderSyncStatus() {
    if (qs('#syncst'))
        qs('#syncst').innerHTML = syncStatus();
    if (qs('#aredl'))
        qs('#aredl').innerHTML = aredlLine();
}

function pauseUI() {
    const sw = k => `<button class=appearance-option data-act=theme data-v=${k} aria-pressed=${ui.theme == k}><i class="theme-preview sw-${k}" aria-hidden=true></i>${t(k)}</button>`;
    const bg = k => `<button class=appearance-option data-act=background data-v=${k} aria-pressed=${ui.background == k}><i class="background-preview bg-${k}" aria-hidden=true></i>${t(k)}</button>`;
    const lang = ([k, n]) => `<button class="${ui.lang == k ? 'pri' : ''}" data-act=lang data-v=${k} aria-pressed=${ui.lang == k}>${FLAGS[k]}${n}</button>`;
    return `<div class="box sm pause"><h2>${t('pause')}</h2>
<h3 id=colour-theme>${t('theme')}</h3><div class=appearance-options role=group aria-labelledby=colour-theme>${THEMES.map(sw).join('')}</div>
<h3 id=background-design>${t('background')}</h3><div class=appearance-options role=group aria-labelledby=background-design>${BACKGROUNDS.map(bg).join('')}</div>
<h3>${t('lang')}</h3><div class=lang>${[['es', 'Español'], ['en', 'English']].map(lang).join('')}</div>
${canEdit() ? `<h3>AREDL</h3><p id=aredl class=by>${aredlLine()}</p>` : ''}
<nav class=legal>${['terms', 'privacy', 'credits'].map(k => `<a class=lk data-act=legal data-v=${k} role=button tabindex=0>${t(k)}</a>`).join(' · ')}</nav>
<p class=by>© ${new Date().getFullYear()} Retlaw · ${t('rights')} · v1.0.0</p>
<p class=dgb><button class=pri data-act=close>${t('resume')}</button></p></div>`;
}
