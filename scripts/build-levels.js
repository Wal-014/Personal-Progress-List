/**
 * Downloads the community sheet of rated levels and writes the slim copy the app reads (data/levels.json).
 * Each level is [id, name, creator, difficulty index or -1, 1 for platformer].
 * Run by the deploy job every day, or locally with `npm run levels`.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHEET = 'https://docs.google.com/spreadsheets/d/1BBx9X8IYBtr7dA5cWu_smM2XBkLZzCXy7TjeEWRgag0/gviz/tq?tqx=out:csv&gid=0';
const OUT = 'data/levels.json';
// Same order as DIFFICULTIES in js/config.js
export const DIFFICULTIES = ['Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'];
// The sheet has about 59,000 rated levels; far fewer means its layout changed and the old copy should stay live
const MIN_LEVELS = 30000;

/** Parses RFC 4180 CSV: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c == '"' && text[i + 1] == '"') {
                field += '"';
                i++;
            }
            else if (c == '"')
                quoted = false;
            else
                field += c;
        }
        else if (c == '"')
            quoted = true;
        else if (c == ',') {
            row.push(field);
            field = '';
        }
        else if (c == '\n' || c == '\r') {
            if (c == '\r' && text[i + 1] == '\n')
                i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        }
        else
            field += c;
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

/** Turns sheet rows (name, creator, user ID, level ID, …, difficulty, reward) into slim levels. Header and divider rows have no numeric ID and are skipped; a repeated ID keeps its first row. */
export function toLevels(rows) {
    const seen = new Set(), levels = [];
    for (const r of rows) {
        const id = (r[3] || '').trim();
        if (!/^\d+$/.test(id) || seen.has(id))
            continue;
        seen.add(id);
        // Platformer levels reward moons instead of stars
        levels.push([+id, r[0].trim(), (r[1] || '').trim(), DIFFICULTIES.indexOf((r[8] || '').trim()), (r[9] || '').includes('🌙') ? 1 : 0]);
    }
    return levels;
}

async function main() {
    const res = await fetch(SHEET);
    if (!res.ok)
        throw Error(`Sheet download failed: HTTP ${res.status}`);
    const levels = toLevels(parseCsv(await res.text()));
    if (levels.length < MIN_LEVELS)
        throw Error(`Only ${levels.length} levels in the sheet; expected at least ${MIN_LEVELS}`);
    writeFileSync(OUT, JSON.stringify(levels));
    console.log(`Wrote ${levels.length} levels to ${OUT}`);
}

if (import.meta.url == pathToFileURL(process.argv[1]).href)
    await main();
