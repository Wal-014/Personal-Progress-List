/**
 * Difficulty faces: the game's face for each difficulty with the halo of its rating, shared by the forms, the level cards, the wishlists and the search results.
 */

/** Face sprites in DIFFICULTIES order, named like the files in assets/faces. */
const FACES = ['auto', 'easy', 'normal', 'hard', 'harder', 'insane', 'demon-easy', 'demon-medium', 'demon-hard', 'demon-insane', 'demon-extreme'];

/** Ratings drawn as a halo around the face; rated levels show the bare face. */
const HALOS = ['featured', 'epic', 'legendary', 'mythic'];

/** Difficulty and rating as text, like «Extreme Demon · Epic». Unrated levels show NA; a difficulty nobody knows shows a dash. */
const difficultyLabel = l => l.rating == 'unrated' ? 'NA' : !l.diff ? '-' : l.diff + (HALOS.includes(l.rating) ? ' · ' + t('r_' + l.rating) : '');

/** Sprite of a level: its difficulty with its rating's halo, or the NA face when it is unrated or its difficulty is not known. */
const faceFile = l => {
    const face = l.rating != 'unrated' && FACES[DIFFICULTIES.indexOf(l.diff)];
    return face ? face + (HALOS.includes(l.rating) ? '-' + l.rating : '') : 'unrated';
};

/** True when a saved level's difficulty is missing because it was never looked up, not because the level is unrated. */
const faceUnknown = l => !!(l.name || l.levelId) && l.rating != 'unrated' && !FACES[DIFFICULTIES.indexOf(l.diff)];

/** Difficulty face image. A face whose difficulty is not known is drawn faded, so it does not read as an unrated level. */
const difficultyFace = (l, id = '') => {
    const label = faceUnknown(l) ? t('diffUnk') : difficultyLabel(l);
    return `<img class="face${faceUnknown(l) ? ' unk' : ''}"${id ? ` id=${id}` : ''} src="assets/faces/${faceFile(l)}.webp" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" width=176 height=176 decoding=async>`;
};
