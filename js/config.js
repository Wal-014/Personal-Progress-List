/**
 * Application constants for difficulties, API URLs, icons, flags and themes.
 */

// The face geometry is shared with the tilted cube in the application mark.
const modeCube = '<rect x="9" y="6" width="20" height="20" rx="2"/><path d="M12.5 10.5h4v4h-4zM21.5 10.5h4v4h-4zM12.5 18.5h13v3h-13z"/>';
const ICONS = {
    actionAdd: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M12 4v16M4 12h16"/></svg>',
    actionBack: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m14 5-7 7 7 7"/></svg>',
    actionCheck: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m4 12 5 5L20 6"/></svg>',
    actionGlobe: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><circle cx=12 cy=12 r=9 /><ellipse cx=12 cy=12 rx=4 ry=9 /><path d="M3 12h18"/></svg>',
    actionPlay: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M7 4v16l13-8Z"/></svg>',
    actionLock: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/></svg>',
    actionEdit: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m4 20 4-1 12-12-3-3L5 16zM14 7l3 3"/></svg>',
    listSearch: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><circle cx=10 cy=10 r=6.5 /><path d="m15 15 6 6"/></svg>',
    listFilter: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>',
    listClear: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m6 6 12 12M18 6 6 18"/></svg>',
    navHome: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9"/></svg>',
    navLists: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/></svg>',
    navWish: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M6 3h12v18l-6-4-6 4Z"/></svg>',
    navStats: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M4 21V11h4v10M10 21V3h4v18M16 21v-7h4v7"/></svg>',
    metricLevels: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m3 7 9-4 9 4-9 4Zm0 5 9 4 9-4M3 17l9 4 9-4"/></svg>',
    metricAttempts: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M20 10a8 8 0 1 0 0 6M20 4v6h-6"/></svg>',
    metricHours: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><circle cx=12 cy=12 r=9 /><path d="M12 7v5l4 2"/></svg>',
    navTags: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 stroke-linejoin=round aria-hidden=true><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx=7.5 cy=7.5 r=1.4 /></svg>',
    navSettings: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M18.74 9.21 19.15 10.08 21.26 10.37 21.26 13.63 19.15 13.92 18.74 14.79 18.41 15.70 19.70 17.39 17.39 19.70 15.70 18.41 14.79 18.74 13.92 19.15 13.63 21.26 10.37 21.26 10.08 19.15 9.21 18.74 8.30 18.41 6.61 19.70 4.30 17.39 5.59 15.70 5.26 14.79 4.85 13.92 2.74 13.63 2.74 10.37 4.85 10.08 5.26 9.21 5.59 8.30 4.30 6.61 6.61 4.30 8.30 5.59 9.21 5.26 10.08 4.85 10.37 2.74 13.63 2.74 13.92 4.85 14.79 5.26 15.70 5.59 17.39 4.30 19.70 6.61 18.41 8.30Z"/><circle cx="12" cy="12" r="3.2"/></svg>',
    menu: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    chevronDown: '<svg class=i viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="m6 9 6 6 6-6"/></svg>',
    person: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><circle cx=12 cy=7 r=4 fill="#fff" stroke="#000" stroke-width=2.5 /><path d="M3 22v-3a9 9 0 0 1 18 0v3Z" fill="#fff" stroke="#000" stroke-width=2.5 /></svg>',
    settings: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="m9 2-1 4-4 1-2 5 3 3v5l5 2 3-3 5 1 4-5-2-4 1-5-5-3-4 1Z" fill="#d2d9ff" stroke="#000" stroke-width=2.5 stroke-linejoin=round /><circle cx=12 cy=12 r=4 fill="#000" /></svg>',
    logout: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M13 3H3v18h10M9 12h12m-5-5 5 5-5 5" fill=none stroke="#000" stroke-width=6 stroke-linejoin=round /><path d="M13 3H3v18h10M9 12h12m-5-5 5 5-5 5" fill=none stroke="#fff" stroke-width=3 stroke-linejoin=round /></svg>',
    eye: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="#fff" stroke="#000" stroke-width=2.5 /><circle cx=12 cy=12 r=3 fill="#000" /></svg>',
    lock: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M7 10V7a5 5 0 0 1 10 0v3" fill=none stroke="#000" stroke-width=6 /><path d="M7 10V7a5 5 0 0 1 10 0v3" fill=none stroke="#fff" stroke-width=3 /><rect x=4 y=9 width=16 height=13 rx=2 fill="#fff" stroke="#000" stroke-width=2 /><path d="M12 14v3" stroke="#000" stroke-width=3 stroke-linecap=round /></svg>',
    app: '<svg class=i viewBox="0 0 48 48" aria-hidden=true><g fill=none stroke-linecap=round stroke-linejoin=round><g stroke="#000" stroke-width=5.5><polyline points="3,45 14,37 22,41 44,20" /><polyline points="36.5,20.5 44,20 43.5,27.5" /></g><g stroke="#fff" stroke-width=2.5><polyline points="3,45 14,37 22,41 44,20" /><polyline points="36.5,20.5 44,20 43.5,27.5" /></g><g transform="rotate(20 19 16)"><rect x=9 y=6 width=20 height=20 rx=2 stroke="#000" stroke-width=5.5 /><rect x=9 y=6 width=20 height=20 rx=2 stroke="#fff" stroke-width=2.5 /><g stroke="#000" stroke-width=3.6><rect x=12.5 y=10.5 width=4 height=4 /><rect x=21.5 y=10.5 width=4 height=4 /><rect x=12.5 y=18.5 width=13 height=3 /></g><g stroke="#fff" stroke-width=1.6><rect x=12.5 y=10.5 width=4 height=4 /><rect x=21.5 y=10.5 width=4 height=4 /><rect x=12.5 y=18.5 width=13 height=3 /></g></g></g></svg>',
    back: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M15 4 7 12l8 8" fill=none stroke="#000" stroke-width=7 stroke-linecap=round stroke-linejoin=round /><path d="M15 4 7 12l8 8" fill=none stroke="#fff" stroke-width=3.5 stroke-linecap=round stroke-linejoin=round /></svg>',
    bell: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" fill="#fff" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    pause: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><rect x=5 y=4 width=5 height=16 rx=1 fill="#fff" stroke="#000" stroke-width=2 /><rect x=14 y=4 width=5 height=16 rx=1 fill="#fff" stroke="#000" stroke-width=2 /></svg>',
    home: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M3 11 12 3l9 8v10H3z" fill="#fff" stroke="#000" stroke-width=2 stroke-linejoin=round /><rect x=10 y=14 width=4 height=7 fill="#000" /></svg>',
    classic: `<svg class=i viewBox="0 0 48 44" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M3 31l6-8m-4 0 6-7m-2 16 3-4M4 39h39M24 38l7-13 7 13"/><g transform="translate(7 -2) rotate(22 19 16)">${modeCube}</g></svg>`,
    platform: `<svg class=i viewBox="0 0 48 44" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" aria-hidden=true><g transform="translate(-5 0)">${modeCube}</g><path d="M2 27h25v5H2zM31 19h14v5H31zM31 34h11v4H31z"/></svg>`,
    stats: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="m2 20 7-8 5 4 8-12m-7 0h7v7" fill=none stroke="#000" stroke-width=6 stroke-linecap=round stroke-linejoin=round /><path d="m2 20 7-8 5 4 8-12m-7 0h7v7" fill=none stroke="#fff" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg>',
    levels: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="m2 7 10-5 10 5-10 5Zm0 5 10 5 10-5M2 17l10 5 10-5" fill=none stroke="#000" stroke-width=6 stroke-linecap=round stroke-linejoin=round /><path d="m2 7 10-5 10 5-10 5Zm0 5 10 5 10-5M2 17l10 5 10-5" fill=none stroke="#fff" stroke-width=2.5 stroke-linecap=round stroke-linejoin=round /></svg>',
    more: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><rect x=3 y=4 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /><rect x=3 y=10.5 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /><rect x=3 y=17 width=18 height=3.5 fill="#fff" stroke="#000" stroke-width=1.5 /></svg>',
    add: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=2 y=2 width=22 height=22 fill="#000" stroke="#fff" stroke-width=2 /><path d="M13 7v12M7 13h12" stroke="#3cff6c" stroke-width=3 /></svg>',
    plus: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M13 4v18M4 13h18" stroke="#000" stroke-width=7 /><path d="M13 4v18M4 13h18" stroke="#3cff6c" stroke-width=3.5 /></svg>',
    wish: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M2 24 13 3l11 21z" fill="#ff8a00" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    tag: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M3 3h11l9 9-11 11-9-9z" fill="#ffe84a" stroke="#000" stroke-width=2 stroke-linejoin=round /><circle cx=8 cy=8 r=2 /></svg>',
    sync: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><circle cx=13 cy=13 r=9 fill="#ff5cf0" stroke="#000" stroke-width=3 /><path d="M13 8v5l3 2" stroke="#000" stroke-width=2.5 fill=none stroke-linecap=round /></svg>',
    warning: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M13 3L24 23H2Z" fill="#ffd34d" stroke="#000" stroke-width=3 stroke-linejoin=round /><path d="M13 10v5m0 4v1" stroke="#000" stroke-width=3 stroke-linecap=round /></svg>',
    retry: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><path d="M21 10a9 9 0 1 0 1 7M21 3v7h-7" fill=none stroke="#000" stroke-width=6 stroke-linecap=round stroke-linejoin=round /><path d="M21 10a9 9 0 1 0 1 7M21 3v7h-7" fill=none stroke="#fff" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg>',
    exp: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=3 y=3 width=20 height=20 rx=3 fill="#00ffff" stroke="#000" stroke-width=2.5 /><path d="M13 7v10m-4-4 4 4 4-4" stroke="#000" stroke-width=2.5 fill=none /></svg>',
    imp: '<svg class=i viewBox="0 0 26 26" aria-hidden=true><rect x=3 y=3 width=20 height=20 rx=3 fill="#ffe84a" stroke="#000" stroke-width=2.5 /><path d="M13 19V9m-4 4 4-4 4 4" stroke="#000" stroke-width=2.5 fill=none /></svg>',
    edit: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ffe84a" stroke="#000" stroke-width=2 stroke-linejoin=round /></svg>',
    del: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M6 6l12 12M18 6 6 18" stroke="#000" stroke-width=6 stroke-linecap=round /><path d="M6 6l12 12M18 6 6 18" stroke="#fff" stroke-width=2.5 stroke-linecap=round /></svg>',
    play: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M7 4v16l13-8z" fill="#fff" stroke="#000" stroke-width=2.5 stroke-linejoin=round /></svg>',
    check: '<svg class=i viewBox="0 0 24 24" aria-hidden=true><path d="M4 13l5 5L20 6" fill=none stroke="#000" stroke-width=6 stroke-linecap=round stroke-linejoin=round /><path d="M4 13l5 5L20 6" fill=none stroke="#3cff6c" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg>'
};
const THEMES = ['nebula', 'graphite', 'ocean', 'amber', 'crimson', 'porcelain'];
const BACKGROUNDS = ['grid', 'aurora', 'celestial', 'orbital'];
const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
function countryFlag(code) {
    return COUNTRY_CODES.includes(code) ? `<img class=flag src="assets/flags/${code.toLowerCase()}.svg" alt="" width=24 height=18 loading=lazy decoding=async>` : '';
}

function profileCountry(code) {
    const flag = countryFlag(code);
    if (!flag)
        return '';
    const name = new Intl.DisplayNames([ui.lang], { type: 'region' }).of(code);
    return `<p class=profile-country>${flag}<span>${escapeHtml(name)}</span></p>`;
}

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
const CUBE_COUNT = 485;
// The cube picker shows twenty cubes per page.
const CUBES_PER_PAGE = 20;
const validCubeId = id => Number.isInteger(id) && id >= 1 && id <= CUBE_COUNT;
// Each cube file stacks the secondary, primary and fixed-detail layers of the original Icon Kit sprite.
function catalogCube(id, primary, secondary) {
    const src = `assets/cubes/${validCubeId(id) ? id : 2}.webp`;
    const uid = 'kit' + ++cubeIds;
    const filters = [isHexColor(secondary) ? secondary : DEFAULT_SECONDARY_COLOR, isHexColor(primary) ? primary : PROFILE_COLORS[0]].map((color, layer) => {
        const [r, g, b] = color.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255);
        return `<filter id="${uid}-${layer}" color-interpolation-filters="sRGB"><feColorMatrix values="${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0"/></filter>`;
    }).join('');
    const layers = [0, 1, 2].map(layer => `<g${layer < 2 ? ` filter="url(#${uid}-${layer})"` : ''}><svg width="80" height="80" viewBox="0 ${layer * 80} 80 80" overflow="hidden"><image href="${src}" width="80" height="240"/></svg></g>`).join('');
    return `<svg class=i viewBox="0 0 80 80" aria-hidden=true><defs>${filters}</defs>${layers}</svg>`;
}

const FLAGS = { es: '<svg class=fl viewBox="0 0 60 40"><rect width=60 height=40 fill="#c60b1e"/><rect y=10 width=60 height=20 fill="#ffc400"/></svg>', en: '<svg class=fl viewBox="0 0 60 40"><rect width=60 height=40 fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width=8 /><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width=3 /><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width=13 /><path d="M30 0V40M0 20H60" stroke="#c8102e" stroke-width=7 /></svg>' };
const DIFFICULTIES = ['Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'];
const RATING_TIERS = ['rated', 'featured', 'epic', 'legendary', 'mythic'];
const AREDL_API = 'https://api.aredl.net/v2/api/';
const DEMONLIST_API = 'https://api.demonlist.org/';
const RANKING_MAX_AGE = 12 * 3600 * 1000;
const RANKING_RETRY_DELAY = 5 * 60 * 1000;
const RANKING_CHECK_INTERVAL = 15 * 60 * 1000;
// GDHistory sends no CORS headers, so the app reads it through the project's relay (relay/README.md)
const LEVEL_RELAY_API = 'https://ppl-level-relay.waquermaster.workers.dev/';
const SUPABASE_URL = 'https://mjgklvdnuhbnyucytaji.supabase.co';
// The publishable key is public by design: RLS protects the data, so secret scanners are told to skip it
const SUPABASE_KEY = 'sb_publishable_k3LU7r-8Ut5FGczl0vTkGw_N8DDBFkI'; // gitleaks:allow
// Email and password sign-in wait for an SMTP provider; until then the hosted project has its email provider turned off
const EMAIL_AUTH = false;
// The dev site has no database of its own, so its build turns accounts off (scripts/build-site.js)
const ACCOUNTS = true;
