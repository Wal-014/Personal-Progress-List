import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const imageExtension = /\.(?:png|jpe?g|webp|gif|svg|avif)$/i;
const fontExtension = /\.woff2?$/i;

test('every tracked docs image is referenced by a tracked text file', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    const unreferenced = new Set(files.filter(file => file.startsWith('docs/') && imageExtension.test(file)));

    for (const file of files) {
        if (file.startsWith('vendor/') || imageExtension.test(file) || fontExtension.test(file)) continue;
        const bytes = readFileSync(join(root, file));
        if (bytes.includes(0)) continue;
        const content = bytes.toString('utf8');
        const directory = posix.dirname(file);
        for (const image of unreferenced)
            if (content.includes(image) || content.includes(posix.relative(directory, image)))
                unreferenced.delete(image);
    }

    assert.deepEqual([...unreferenced], [],
        'Upload pull request screenshots to the pr-media release instead: gh release upload pr-media <pr>-<name>.jpg');
});
