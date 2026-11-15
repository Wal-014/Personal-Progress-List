/**
 * Copies the files the site serves into _site/, the folder the deploy jobs publish,
 * so tests, docs and tooling stay out of the live site.
 * `npm run site` builds production (GitHub Pages); `npm run site -- development` builds the dev site,
 * which has no database of its own, so accounts are off and the page cannot reach the production project.
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const OUT = '_site';
// Folders are copied whole; docs/brand/card.png is the social preview image index.html points to
export const SITE_FILES = ['index.html', 'manifest.json', 'sw.js', 'favicon.png', 'icon.svg', 'css', 'js', 'data', 'assets', 'fonts', 'vendor', 'docs/brand/card.png'];

const ACCOUNTS_ON = 'const ACCOUNTS = true;';

// Cloudflare applies this file to the dev Worker's responses; this header policy only adds
// frame-ancestors, which a <meta> policy cannot set, and leaves the rest to the page's own policy
export const DEV_HEADERS = `/*
  X-Robots-Tag: noindex
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000
`;

/** Each rewrite throws when its target is gone, so a moved line cannot ship a dev site with accounts on. */
export function devConfig(config) {
    if (!config.includes(ACCOUNTS_ON))
        throw new Error(`js/config.js has no "${ACCOUNTS_ON}"`);
    return config.replace(ACCOUNTS_ON, 'const ACCOUNTS = false;');
}

export function devPage(html, supabaseOrigin) {
    const policy = html.match(/connect-src [^;"]*/)?.[0];
    if (!policy?.split(' ').includes(supabaseOrigin))
        throw new Error(`index.html connect-src does not list ${supabaseOrigin}`);
    return html.replace(policy, policy.split(' ').filter(source => source != supabaseOrigin).join(' '));
}

function buildDev() {
    const configFile = `${OUT}/js/config.js`, pageFile = `${OUT}/index.html`;
    const config = readFileSync(configFile, 'utf8');
    const supabaseOrigin = new URL(vm.runInNewContext(config + ';SUPABASE_URL')).origin;
    writeFileSync(configFile, devConfig(config));
    writeFileSync(pageFile, devPage(readFileSync(pageFile, 'utf8'), supabaseOrigin));
    writeFileSync(`${OUT}/_headers`, DEV_HEADERS);
}

if (import.meta.url == pathToFileURL(process.argv[1]).href) {
    const target = process.argv[2] || 'production';
    if (!['production', 'development'].includes(target)) {
        console.error(`Unknown environment "${target}"; use production or development`);
        process.exit(1);
    }
    rmSync(OUT, { recursive: true, force: true });
    for (const entry of SITE_FILES)
        cpSync(entry, `${OUT}/${entry}`, { recursive: true });
    if (target == 'development')
        buildDev();
    console.log(`Copied ${SITE_FILES.length} entries to ${OUT}/ for ${target}`);
}
