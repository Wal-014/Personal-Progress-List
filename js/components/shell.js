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
        const menu = qs('#shell-sidebar :popover-open');
        if (menu) {
            menu.hidePopover();
            qs('#profile-pill')?.focus({ preventScroll: true });
        }
        else
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

function setListChoices(button, open) {
    ui.listsExpanded = open;
    button.setAttribute('aria-expanded', String(open));
    const choices = qs('#hlists');
    choices.inert = !open;
    (open ? choices.querySelector('button') : button)?.focus({ preventScroll: true });
}

function shellNavigation() {
    const navItem = (kind, label, icon) => `<button data-act=tab data-v=${kind}${kind == ui.tab ? ' aria-current=page' : ''}>${icon}<span>${t(label)}</span></button>`;
    const expanded = ui.listsExpanded;
    const choices = ['classic', 'platform'].map(kind => `<button class=pma data-act=tab data-v=${kind}${ui.tab == kind ? ' aria-current=page' : ''}>${ICONS[kind]}<span>${t(kind)}</span></button>`).join('');
    return `<nav class=shell-nav aria-label="${t('nav')}">${navItem('home', 'home', ICONS.navHome)}<button id=list-choices-trigger data-act=listchoices aria-expanded=${expanded} aria-controls=hlists${isListTab() ? ' aria-current=page' : ''}>${ICONS.navLists}<span>${t(canEdit() ? 'lists' : 'publicLists')}</span>${ICONS.chevronDown}</button><div id=hlists class=list-choices role=group aria-labelledby=list-choices-trigger${expanded ? '' : ' inert'}><div class=list-choices-inner>${choices}</div></div>${navItem('wish', 'wish', ICONS.navWish)}${navItem('stats', 'stats', ICONS.navStats)}</nav>`;
}

function shellFooter() {
    return `<div class=shell-footer>${canEdit() ? `<button data-act=tags>${ICONS.navTags}<span>${t('tagsT')}</span></button>` : `<button data-act=myprogress>${ICONS.back}<span>${t('publicBack')}</span></button>`}<button data-act=pause>${ICONS.navSettings}<span>${t('pause')}</span></button></div>`;
}

function shellPageTitle() {
    if (ui.tab == 'home')
        return '';
    const wish = ui.tab == 'wish' && currentWishlist();
    const title = isListTab() ? t(canEdit() ? 'lists' : 'publicLists') : wish ? wish.name : t(ui.tab);
    const icon = isListTab() ? ICONS.navLists : ui.tab == 'wish' ? ICONS.navWish : ICONS.navStats;
    const primary = !canEdit() ? '' : ui.tab == 'wish' && !wish ? `<button data-act=wnew>${ICONS.actionAdd}${t('palWish')}</button>` : '';
    return `<div class=page-title><button data-act=tab data-v=home aria-label="${t('home')}" title="${t('home')}">${ICONS.navHome}</button>${wish ? `<button data-act=tab data-v=wish aria-label="${t('back2')}">${ICONS.actionBack}</button>` : ''}<h2>${icon}${escapeHtml(title)}</h2>${primary}</div>`;
}

let notificationCount;

function syncNotificationCount(count) {
    let status = qs('#bell-status');
    if (!status) {
        status = document.createElement('span');
        status.id = 'bell-status';
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        document.body.appendChild(status);
    }
    if (notificationCount != null && notificationCount != count) {
        const message = count ? t('bell') + ' (' + count + ')' : t('nonot');
        queueMicrotask(() => {
            const region = activeModal()?.querySelector('[data-bell-status]') || status;
            region.textContent = message;
        });
    }
    notificationCount = count;
}

function sharedShell(screen) {
    const count = notifications().length;
    const utilities = canEdit() ? `<div class=shell-utilities><span id=cloud-header class=cloud-header>${cloudHeaderStatus()}</span><button class=sq data-act=bell aria-haspopup=dialog aria-label="${t('bell')}${count ? ` (${count})` : ''}">${ICONS.actionBell}${count ? `<b class=bdg aria-hidden=true>${count}</b>` : ''}</button></div>` : '';
    const notificationPaints = ['notice', 'pending'].map(section => `<linearGradient id="notification-${section}-metal" href="#nav-metal"><stop class="notification-ink"/><stop offset=".32" class="notification-ink"/><stop offset=".43" class="notification-glint"/><stop offset=".56" class="notification-ink"/><stop offset=".82" class="notification-glint"/><stop offset="1" class="notification-ink"/></linearGradient>`).join('');
    return `<div class=app-shell><svg class=shell-paints width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="nav-metal" gradientUnits="userSpaceOnUse" x1="3" y1="2" x2="21" y2="22"><stop class="nav-ink"/><stop offset=".32" class="nav-ink"/><stop offset=".43" class="nav-glint"/><stop offset=".56" class="nav-ink"/><stop offset=".82" class="nav-glint"/><stop offset="1" class="nav-ink"/></linearGradient>${notificationPaints}<linearGradient id="action-metal" gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="20" y2="20"><stop class="action-edge"/><stop offset=".42" class="action-edge"/><stop offset=".55" class="action-glint"/><stop offset=".72" class="action-edge"/><stop offset="1" class="action-glint"/></linearGradient></defs></svg><aside id=shell-sidebar class=shell-sidebar aria-label="${t('nav')}"><div class=shell-drawer-header><button type=button data-act=drawerclose aria-label="${t('closeMenu')}" title="${t('closeMenu')}">${ICONS.actionBack}</button></div><div class=shell-identity>${profileSwitcher()}</div>${shellNavigation()}${shellFooter()}</aside><button class=drawer-backdrop data-act=drawerclose tabindex=-1 aria-label="${t('close')}" hidden></button><div class=shell-content><header class=shell-header><button id=shell-menu class=shell-menu data-act=drawer aria-expanded=false aria-controls=shell-sidebar aria-label="${t('nav')}">${ICONS.menu}</button><div class=shell-brand><span class=shell-brand-frame>${ICONS.app}</span><h1>Personal Progress List</h1></div>${utilities}</header><main class="shell-main${ui.tab == 'home' ? ' home hl' : isListTab() ? ' wide' : ''}">${shellPageTitle()}${ui.tab == 'home' ? screen : `<div class=${isListTab() ? 'list-surface' : 'legacy-surface'}>${screen}</div>`}</main></div></div>`;
}

function rankingStatusRows() {
    const times = readRankingTimes(), owner = rankingOwner();
    return [['aredl', 'AREDL / AREPL'], ['gdl', 'Global Demonlist']].map(([provider, name]) => {
        const { status, failed } = rankingSync[provider];
        const timestamp = rankingTimestamp(times, owner, provider);
        const updating = rankingSync.due.includes(provider);
        const warning = !updating && (status == 'error' || status == 'partial');
        let label = t('rankNever');
        if (updating)
            label = t('rankUpdating');
        else if (status == 'error')
            label = t('rankFailed');
        else if (status == 'partial')
            label = t('rankPartial').replace('{list}', () => failed);
        else if (timestamp != null)
            label = t('rankUpdated').replace('{time}', () => new Intl.DateTimeFormat(ui.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp));
        return `<div class=ranking-row><strong>${name}</strong><span${warning ? ' class=warn' : ''}>${warning ? ICONS.warning : ''}${escapeHtml(label)}</span></div>`;
    }).join('');
}

const rankingRefreshLabel = () => t(rankingSync.running ? 'rankUpdating' : 'rankRefresh');

function renderRankingStatus() {
    const status = qs('[data-ranking-status]');
    if (!status)
        return;
    const busy = String(rankingSync.running), button = qs('[data-act=rankrefresh]');
    status.setAttribute('aria-busy', busy);
    status.innerHTML = rankingStatusRows();
    button.setAttribute('aria-disabled', busy);
    button.querySelector('span').textContent = rankingRefreshLabel();
}

function pauseUI() {
    const sw = k => `<button class=appearance-option data-act=theme data-v=${k} aria-pressed=${ui.theme == k}><i class="theme-preview sw-${k}" aria-hidden=true></i>${t(k)}</button>`;
    const bg = k => `<button class=appearance-option data-act=background data-v=${k} aria-pressed=${ui.background == k}><i class="background-preview bg-${k}" aria-hidden=true></i>${t(k)}</button>`;
    const lang = ([k, n]) => `<button class="${ui.lang == k ? 'pri' : ''}" data-act=lang data-v=${k} aria-pressed=${ui.lang == k}>${FLAGS[k]}${n}</button>`;
    return `<div class="box sm pause"><h2>${t('pause')}</h2>
<h3 id=colour-theme>${t('theme')}</h3><div class=appearance-options role=group aria-labelledby=colour-theme>${THEMES.map(sw).join('')}</div>
<h3 id=background-design>${t('background')}</h3><div class=appearance-options role=group aria-labelledby=background-design>${BACKGROUNDS.map(bg).join('')}</div>
<h3>${t('lang')}</h3><div class=lang>${[['es', 'Español'], ['en', 'English']].map(lang).join('')}</div>
${canEdit() ? `<h3 id=ranking-sync>${t('rankSync')}</h3>
<div id=ranking-status class=ranking-status data-ranking-status role=status aria-live=polite aria-busy=${rankingSync.running}>${rankingStatusRows()}</div>
<button data-act=rankrefresh aria-describedby=ranking-status aria-disabled=${rankingSync.running}>${ICONS.actionSync}<span>${rankingRefreshLabel()}</span></button>` : ''}
<nav class=legal>${['terms', 'privacy', 'credits'].map(k => `<a class=lk data-act=legal data-v=${k} role=button tabindex=0>${t(k)}</a>`).join(' · ')}</nav>
<p class=by>© ${new Date().getFullYear()} Retlaw · ${t('rights')} · v${APP_VERSION}</p>
<p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;
}
