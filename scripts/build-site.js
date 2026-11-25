/**
 * Copies the files the site serves into _site/, the folder the deploy jobs publish,
 * so tests, docs and tooling stay out of the live site. Both builds stamp the service worker
 * cache name with a hash of the published files, except the worker and the daily data.
 * `npm run site` builds production (GitHub Pages); `npm run site -- development` builds the dev site,
 * which has no database of its own, so accounts are off and the page cannot reach the production project.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const OUT = '_site';
// Folders are copied whole; docs/brand/card-2.jpg is the social preview image index.html points to
export const SITE_FILES = ['index.html', 'manifest.json', 'sw.js', 'favicon.png', 'icon.svg', 'css', 'js', 'data', 'assets', 'fonts', 'vendor', 'docs/brand/card-2.jpg'];

const ACCOUNTS_ON = 'const ACCOUNTS = true;';
export const RELEASE_LINE = '0.1.0-beta';
export const BETA_BASE = '41f339b260a0735510b0fe07531c9a0ba639886b';

// Cloudflare applies this file to the dev Worker's responses; this header policy only adds
// frame-ancestors, which a <meta> policy cannot set, and leaves the rest to the page's own policy
export const DEV_HEADERS = `/*
  X-Robots-Tag: noindex
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000
`;

export function releaseVersion(line, count) {
    if (!line.includes('-'))
        return line;
    if (!Number.isInteger(count) || count < 1)
        throw new Error('Prerelease count must be a positive integer');
    return `${line}.${count}`;
}

export function stampVersion(config, version) {
    const declaration = /^const APP_VERSION = '[^'\r\n]*';$/m;
    if (!declaration.test(config))
        throw new Error('js/config.js has no APP_VERSION declaration');
    return config.replace(declaration, () => `const APP_VERSION = '${version}';`);
}

export function countReleaseCommits(base = BETA_BASE, cwd) {
    try {
        return Number(execFileSync('git', ['rev-list', '--first-parent', '--count', `${base}..HEAD`], {
            cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
        }).trim());
    } catch (error) {
        throw new Error('Could not count production releases. Check out the full Git history containing BETA_BASE.', { cause: error });
    }
}

export function stampCache(sw, hash) {
    const declaration = /^const CACHE = '([^'\r\n]+)';$/m;
    if (!declaration.test(sw))
        throw new Error('sw.js has no CACHE declaration');
    return sw.replace(declaration, (_, name) => `const CACHE = '${name}-${hash}';`);
}

/**
 * Hash of the published files, so any code, style or image change renames the service worker cache and reaches open tabs.
 * The worker itself and the data folder, which the daily refresh rewrites, are left out with skip.
 */
export function siteHash(dir, skip = []) {
    const files = readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter(file => !skip.some(path => file == path || file.startsWith(path + '/')))
        .sort();
    const hash = createHash('sha256');
    for (const file of files) {
        const content = readFileSync(join(dir, file));
        // The length delimits file contents even when they contain arbitrary bytes.
        hash.update(JSON.stringify([file, content.length]));
        hash.update(content);
    }
    return hash.digest('hex').slice(0, 12);
}

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

export function siteConfig(config, target, productionRelease, countCommits = countReleaseCommits) {
    if (target == 'development')
        return devConfig(config);
    if (productionRelease !== 'true')
        return config;
    const count = RELEASE_LINE.includes('-') ? countCommits() : undefined;
    return stampVersion(config, releaseVersion(RELEASE_LINE, count));
}

function buildDev(config) {
    const pageFile = `${OUT}/index.html`;
    const supabaseOrigin = new URL(vm.runInNewContext(config + ';SUPABASE_URL')).origin;
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
    const configFile = `${OUT}/js/config.js`;
    const config = readFileSync(configFile, 'utf8');
    const builtConfig = siteConfig(config, target, process.env.PRODUCTION_RELEASE);
    if (builtConfig !== config)
        writeFileSync(configFile, builtConfig);
    if (target == 'development')
        buildDev(builtConfig);
    // Stamped last, so the hash covers the rewritten config and page.
    const swFile = `${OUT}/sw.js`;
    writeFileSync(swFile, stampCache(readFileSync(swFile, 'utf8'), siteHash(OUT, ['sw.js', 'data'])));
    console.log(`Copied ${SITE_FILES.length} entries to ${OUT}/ for ${target}`);
}
