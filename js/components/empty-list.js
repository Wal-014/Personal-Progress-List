/**
 * Shared empty state for wishlists and classic or platformer level lists.
 */

/** Empty state with a button to add the first item. */
const emptyList = ({ icon, title, text, action, label = t('palAdd') }) => `<div class=empty>${icon}<h3>${title}</h3><p>${text}</p><button class=pri data-act=${action}>${ICONS.actionAdd} ${escapeHtml(label)}</button></div>`;
