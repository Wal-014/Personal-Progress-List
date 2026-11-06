/**
 * Shared empty state for wishlists and classic or platformer level lists.
 */

/** Empty state of a level list: an icon, a title, a hint and the button that adds the first level. */
const emptyList = ({ icon, title, text, action }) => `<div class=empty>${icon}<h3>${title}</h3><p>${text}</p><button class=pri data-act=${action}>${t('addLevel')}</button></div>`;
