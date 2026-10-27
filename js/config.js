/**
 * Application constants for difficulties, API URLs, icons, flags and themes.
 */

const ICONS = {
    app: '<svg class=i viewBox="0 0 48 48" aria-hidden=true><g fill=none stroke-linecap=round stroke-linejoin=round><g stroke="#000" stroke-width=5.5><polyline points="3,45 14,37 22,41 44,20" /><polyline points="36.5,20.5 44,20 43.5,27.5" /></g><g stroke="#fff" stroke-width=2.5><polyline points="3,45 14,37 22,41 44,20" /><polyline points="36.5,20.5 44,20 43.5,27.5" /></g><g transform="rotate(20 19 16)"><rect x=9 y=6 width=20 height=20 rx=2 stroke="#000" stroke-width=5.5 /><rect x=9 y=6 width=20 height=20 rx=2 stroke="#fff" stroke-width=2.5 /><g stroke="#000" stroke-width=3.6><rect x=12.5 y=10.5 width=4 height=4 /><rect x=21.5 y=10.5 width=4 height=4 /><rect x=12.5 y=18.5 width=13 height=3 /></g><g stroke="#fff" stroke-width=1.6><rect x=12.5 y=10.5 width=4 height=4 /><rect x=21.5 y=10.5 width=4 height=4 /><rect x=12.5 y=18.5 width=13 height=3 /></g></g></g></svg>',
    back: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M15 4 7 12l8 8" fill=none stroke="#000" stroke-width=7 stroke-linecap=round stroke-linejoin=round /><path d="M15 4 7 12l8 8" fill=none stroke="#fff" stroke-width=3.5 stroke-linecap=round stroke-linejoin=round /></svg>',
    bell: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" fill="#fff" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    pause: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><rect x=5 y=4 width=5 height=16 rx=1 fill="#fff" stroke="#000" stroke-width=2 /><rect x=14 y=4 width=5 height=16 rx=1 fill="#fff" stroke="#000" stroke-width=2 /></svg>',
    home: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M3 11 12 3l9 8v10H3z" fill="#fff" stroke="#000" stroke-width=2 stroke-linejoin=round /><rect x=10 y=14 width=4 height=7 fill="#000" /></svg>',
    classic: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M1 21 7 9l6 12zM11 21l6-12 6 12z" fill="#fff" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    more: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><rect x=3 y=4 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /><rect x=3 y=10.5 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /><rect x=3 y=17 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /></svg>',
    add: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=2 y=2 width=22 height=22 fill="#000" stroke="#fff" stroke-width=2 /><path d="M13 7v12M7 13h12" stroke="#3cff6c" stroke-width=3 /></svg>',
    plus: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M13 4v18M4 13h18" stroke="#000" stroke-width=7 /><path d="M13 4v18M4 13h18" stroke="#3cff6c" stroke-width=3.5 /></svg>',
    wish: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M2 24 13 3l11 21z" fill="#ff8a00" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    tag: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M3 3h11l9 9-11 11-9-9z" fill="#ffe84a" stroke="#000" stroke-width=2 stroke-linejoin=round /><circle cx=8 cy=8 r=2 /></svg>',
    sync: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><circle cx=13 cy=13 r=9 fill="#ff5cf0" stroke="#000" stroke-width=3 /><path d="M13 8v5l3 2" stroke="#000" stroke-width=2.5 fill=none stroke-linecap=round /></svg>',
    exp: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=3 y=3 width=20 height=20 rx=3 fill="#00ffff" stroke="#000" stroke-width=2.5 /><path d="M13 7v10m-4-4 4 4 4-4" stroke="#000" stroke-width=2.5 fill=none /></svg>',
    imp: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=3 y=3 width=20 height=20 rx=3 fill="#ffe84a" stroke="#000" stroke-width=2.5 /><path d="M13 19V9m-4 4 4-4 4 4" stroke="#000" stroke-width=2.5 fill=none /></svg>',
    edit: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ffe84a" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    del: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M6 6l12 12M18 6 6 18" stroke="#000" stroke-width=6 stroke-linecap=round /><path d="M6 6l12 12M18 6 6 18" stroke="#fff" stroke-width=2.5 stroke-linecap=round /></svg>',
    play: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M7 4v16l13-8z" fill="#fff" stroke="#000" stroke-width=2.5 stroke-linejoin=round /></svg>',
    check: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M4 13l5 5L20 6" fill=none stroke="#000" stroke-width=6 stroke-linecap=round stroke-linejoin=round /><path d="M4 13l5 5L20 6" fill=none stroke="#3cff6c" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg>'
};
const THEMES = ['blue', 'night', 'synth'];
/** Preset profile colours by the translation key of their name, in the order used before profiles saved their own colour. */
const PROFILE_PRESETS = { yellow: '#ffe94d', green: '#a6ff4d', pink: '#ff8af2', orange: '#ffb35c', cyan: '#7af6ff', red: '#ff7a8a', purple: '#c9a2ff' };
const PROFILE_COLORS = Object.values(PROFILE_PRESETS);
/** The cube's eye colour from before profiles had a secondary colour, so existing icons keep their look. */
const DEFAULT_SECONDARY_COLOR = '#5ef0ff';
/** Only full hexadecimal colours can be written into SVG markup. */
const isHexColor = color => typeof color == 'string' && /^#[0-9a-f]{6}$/i.test(color);
let cubeIds = 0;
/** Classic cube icon. Every icon gets its own gradient id: a gradient defined inside a hidden icon would not paint the others. */
const cubeIcon = (color, secondaryColor) => {
    const fill = isHexColor(color) ? color : PROFILE_COLORS[0], face = isHexColor(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY_COLOR, id = 'cube' + ++cubeIds;
    return `<svg class=i viewBox="0 0 48 48" aria-hidden=true><defs><linearGradient id=${id} x1=0 y1=0 x2=0 y2=1><stop offset=0 stop-color="#000" stop-opacity=0 /><stop offset=1 stop-color="#000" stop-opacity=".3" /></linearGradient></defs><rect x=2.5 y=2.5 width=43 height=43 rx=3 fill="${fill}" stroke="#000" stroke-width=3 /><rect x=2.5 y=2.5 width=43 height=43 rx=3 fill="url(#${id})" /><rect x=6 y=6 width=36 height=36 rx=1.5 fill=none stroke="#fff" stroke-opacity=".35" stroke-width=1.5 /><rect x=12 y=13 width=8 height=8 fill="${face}" stroke="#000" stroke-width=2.5 /><rect x=28 y=13 width=8 height=8 fill="${face}" stroke="#000" stroke-width=2.5 /><rect x=12 y=28 width=24 height=6 fill="${face}" stroke="#000" stroke-width=2.5 /></svg>`;
};
const FLAGS = { es: '<svg class=fl viewBox="0 0 60 40"><rect width=60 height=40 fill="#c60b1e"/><rect y=10 width=60 height=20 fill="#ffc400"/></svg>', en: '<svg class=fl viewBox="0 0 60 40"><rect width=60 height=40 fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width=8 /><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width=3 /><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width=13 /><path d="M30 0V40M0 20H60" stroke="#c8102e" stroke-width=7 /></svg>' };
const DIFFICULTIES = ['Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'];
const AREDL_API = 'https://api.aredl.net/v2/api/';
// GDHistory sends no CORS headers, so a browser cannot query it; GDBrowser does and has the same level data
const GDB_API = 'https://gdbrowser.com/api/';
