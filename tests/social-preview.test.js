import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('the social preview image exists and matches its declared PNG dimensions', () => {
    const root = new URL('../', import.meta.url);
    const html = readFileSync(new URL('index.html', root), 'utf8');
    const meta = property => {
        const match = html.match(new RegExp(`<meta property="${property}" content="([^"]+)"`));
        assert.ok(match, `${property} must be declared`);
        return match[1];
    };
    const prefix = 'https://wal-014.github.io/Personal-Progress-List/';
    const imageUrl = meta('og:image');
    assert.ok(imageUrl.startsWith(prefix), 'the image must be hosted with the site');
    const imagePath = new URL(imageUrl.slice(prefix.length), root);
    assert.ok(existsSync(imagePath), 'the social preview PNG must exist');
    const png = readFileSync(imagePath);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), Number(meta('og:image:width')));
    assert.equal(png.readUInt32BE(20), Number(meta('og:image:height')));
});
