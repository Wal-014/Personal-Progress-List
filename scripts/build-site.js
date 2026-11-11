/**
 * Copies the files the site serves into _site/, the folder the deploy job publishes to GitHub Pages,
 * so tests, docs and tooling stay out of the live site.
 * Run by the deploy job after `npm run levels`, or locally with `npm run site`.
 */
import { cpSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OUT = '_site';
// Folders are copied whole; docs/brand/card.png is the social preview image index.html points to
export const SITE_FILES = ['index.html', 'manifest.json', 'sw.js', 'favicon.png', 'icon.svg', 'css', 'js', 'data', 'assets', 'fonts', 'vendor', 'docs/brand/card.png'];

if (import.meta.url == pathToFileURL(process.argv[1]).href) {
    rmSync(OUT, { recursive: true, force: true });
    for (const entry of SITE_FILES)
        cpSync(entry, `${OUT}/${entry}`, { recursive: true });
    console.log(`Copied ${SITE_FILES.length} entries to ${OUT}/`);
}
