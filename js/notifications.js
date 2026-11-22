/**
 * @typedef {Object} NotificationEntry
 * @property {string} id
 * @property {'notice' | 'pending'} section
 * @property {string} type
 * @property {string} icon
 * @property {string} title
 * @property {string} text
 * @property {{ act: string, label: string, data: Record<string, string> }} action
 */

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
    return profile.wishlists.flatMap(wishlist => wishlist.items
        .filter(item => item.status == 'done' && !wishlistTransferred(item))
        .map(item => wishlistNotification(wishlist, item)));
}
