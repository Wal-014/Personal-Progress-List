import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/** Reads the size from the first start-of-frame segment; 0xC4, 0xC8 and 0xCC share its range but are not frames. */
function jpegSize(jpeg) {
    assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff', 'the social preview must be a JPEG');
    for (let offset = 2; offset + 4 <= jpeg.length; offset += 2 + jpeg.readUInt16BE(offset + 2)) {
        const marker = jpeg[offset + 1];
        assert.equal(jpeg[offset], 0xff, 'expected a JPEG marker');
        if (marker == 0xda) break;
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
            return { width: jpeg.readUInt16BE(offset + 7), height: jpeg.readUInt16BE(offset + 5) };
    }
    assert.fail('the JPEG must contain a start-of-frame marker');
}

test('the social preview image exists and matches its declared JPEG dimensions', () => {
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
    assert.ok(existsSync(imagePath), 'the social preview JPEG must exist');
    assert.deepEqual(jpegSize(readFileSync(imagePath)), { width: Number(meta('og:image:width')), height: Number(meta('og:image:height')) });
});
