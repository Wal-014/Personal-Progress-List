"""Build the lossless cube atlas from the GDBrowser Icon Kit (requires Pillow and requests).

The atlas has 20 columns of 80x240 tiles. Each tile stacks the secondary, primary
and fixed-detail layers from top to bottom.
"""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from tempfile import gettempdir
import plistlib
import re
import time
import requests
from PIL import Image

CACHE = Path(gettempdir()) / 'ppl-iconkit-sources'
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets-src' / 'cubes.webp'
SIZE = 80
COLUMNS = 20


def source(name):
    if not re.fullmatch(r'player_[0-9]{2,3}-uhd\.(png|plist)', name):
        raise ValueError(f'Invalid sprite filename: {name}')
    path = CACHE / name
    if not path.exists():
        for attempt in range(3):
            try:
                url = f'https://gdbrowser.com/iconkit/icons/{name}'
                with requests.get(url, timeout=30, allow_redirects=False, headers={'User-Agent': 'Personal-Progress-List/1.0'}) as response:
                    if response.status_code != 200:
                        raise OSError(f'{name}: HTTP {response.status_code}')
                    data = response.content
                path.write_bytes(data)
                break
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(1 + attempt)
    return path.read_bytes()


def numbers(value):
    return [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', value)]


def cube_layers(index):
    name = f'player_{index:02d}'
    frames = plistlib.loads(source(name + '-uhd.plist'))['frames']
    sheet = Image.open(BytesIO(source(name + '-uhd.png'))).convert('RGBA')
    layers = []
    for suffix in ['_2_001.png', '_001.png', '_extra_001.png']:
        frame = frames.get(name + suffix)
        if not frame:
            if suffix == '_extra_001.png':
                continue
            raise ValueError(f'Missing layer: {name}{suffix}')
        x, y, w, h = map(int, numbers(frame['textureRect']))
        if frame['textureRotated'] and [w, h] == numbers(frame['spriteSize']):
            w, h = h, w
        tile = sheet.crop((x, y, x + w, y + h))
        if frame['textureRotated']:
            tile = tile.transpose(Image.Transpose.ROTATE_90)
        dx, dy = numbers(frame['spriteOffset'])
        layers.append((tile, dx - tile.width / 2, -dy - tile.height / 2))
    left = min(x for _, x, _ in layers)
    top = min(y for _, _, y in layers)
    width = max(x + tile.width for tile, x, _ in layers) - left
    height = max(y + tile.height for tile, _, y in layers) - top
    scale = (SIZE - 4) / max(width, height)
    result = []
    for tile, x, y in layers:
        resized = tile.resize((max(1, round(tile.width * scale)), max(1, round(tile.height * scale))), Image.Resampling.LANCZOS)
        offset = (round((SIZE - width * scale) / 2 + (x - left) * scale),
                  round((SIZE - height * scale) / 2 + (y - top) * scale))
        result.append((resized, offset))
    return result


def main():
    config = (ROOT / 'js' / 'config.js').read_text(encoding='utf-8')
    count_match = re.search(r'^const CUBE_COUNT = (\d+);', config, re.MULTILINE)
    if not count_match:
        raise ValueError('Missing CUBE_COUNT in js/config.js')
    count = int(count_match[1])
    rows = (count + COLUMNS - 1) // COLUMNS
    tile_height = 3 * SIZE
    atlas = Image.new('RGBA', (COLUMNS * SIZE, rows * tile_height))
    CACHE.mkdir(exist_ok=True)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        for index, layers in enumerate(pool.map(cube_layers, range(1, count + 1))):
            cube = Image.new('RGBA', (SIZE, tile_height))
            for layer, (tile, (dx, dy)) in enumerate(layers):
                cube.paste(tile, (dx, layer * SIZE + dy))
            atlas.paste(cube, (index % COLUMNS * SIZE, index // COLUMNS * tile_height))
    # Preserve RGB values even where alpha is zero.
    atlas.save(DEST, 'WEBP', lossless=True, quality=100, method=6, exact=True)


if __name__ == '__main__':
    main()
