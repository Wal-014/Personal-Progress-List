/**
 * @typedef {Object} NotificationEntry
 * @property {string} id
 * @property {'notice' | 'pending'} section
 * @property {string} type
 * @property {string} icon
 * @property {string} title
 * @property {string} text
 * @property {{ act: string, label: string, data: Record<string, string> }} action
 * @property {{ act: string, label: string }} [dismiss]
 */

function offeredLocalData() {
    return canEdit() && cloudUser && cloudSession?.pulled && !account.recovering
        ? localProfilesToOffer(cloudUser).sort() : [];
}

function noticeDismissals() {
    try {
        const value = JSON.parse(localStorage.gnotices || '{}');
        return value && typeof value == 'object' && !Array.isArray(value) ? value : {};
    }
    catch {
        return {};
    }
}

function localDataNotification() {
    const offered = offeredLocalData();
    if (!offered.length || noticeDismissals()[cloudUser]?.['local-data'] === offered.join(','))
        return null;
    return {
        id: 'local-data',
        section: 'notice',
        type: 'local-data',
        icon: ICONS.imp,
        title: t('notificationLocalData'),
        text: t(offered.length == 1 ? 'notificationLocalProfilesOne' : 'notificationLocalProfiles').replace('{n}', offered.length),
        action: { act: 'notiflocal', label: t('notificationLocalReview'), data: {} },
        dismiss: { act: 'notifdismiss', label: t('notificationHide') }
    };
}

function dismissNotification(id) {
    if (id != 'local-data')
        return false;
    const offered = offeredLocalData();
    if (!offered.length)
        return false;
    try {
        const dismissed = noticeDismissals();
        localStorage.gnotices = JSON.stringify({
            ...dismissed,
            [cloudUser]: { ...dismissed[cloudUser], [id]: offered.join(',') }
        });
        return true;
    }
    catch {
        return false;
    }
}

function wishlistNotification(wishlist, item) {
    const kind = item.kind;
    const text = t(kind ? 'notificationWishlistList' : 'notificationWishlistAny')
        .replace(/\{wishlist\}|\{list\}/g, token => token == '{wishlist}' ? wishlist.name : t(kind));
    const data = { w: String(wishlist.id), id: String(item.id) };
    if (kind)
        data.v = kind;
    return {
        id: `wish:${data.w}:${data.id}`,
        section: 'pending',
        type: 'wishlist',
        icon: ICONS.actionCheck,
        title: item.name,
        text,
        action: { act: 'notifwish', label: t(kind ? 'wAddTo_' + kind : 'wAddAny'), data }
    };
}

/** @returns {NotificationEntry[]} */
function notifications() {
    if (!canEdit())
        return [];
    const notice = localDataNotification();
    const pending = profile.wishlists.flatMap(wishlist => wishlist.items
        .filter(item => item.status == 'done' && !wishlistTransferred(item))
        .map(item => wishlistNotification(wishlist, item)));
    return notice ? [notice, ...pending] : pending;
}
