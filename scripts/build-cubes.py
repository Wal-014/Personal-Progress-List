"""Build paginated, recolorable cube sheets from the GDBrowser Icon Kit (requires Pillow)."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from tempfile import gettempdir
import plistlib
import re
import time
from urllib.request import Request, urlopen
from PIL import Image

SOURCE = 'https://gdbrowser.com/iconkit/icons/'
CACHE = Path(gettempdir()) / 'ppl-iconkit-sources'
DEST = Path(__file__).resolve().parents[1] / 'assets' / 'cubes'
SIZE = 80
PER_PAGE = 20
COLUMNS = 5


def source(name):
    path = CACHE / name
    if not path.exists():
        for attempt in range(3):
            try:
                with urlopen(Request(SOURCE + name, headers={'User-Agent': 'Personal-Progress-List/1.0'}), timeout=30) as response:
                    path.write_bytes(response.read())
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
    CACHE.mkdir(exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        for slot, layers in enumerate(pool.map(cube_layers, range(1, 486))):
            cell = slot % PER_PAGE
            if cell == 0:
                page = Image.new('RGBA', (COLUMNS * SIZE, 3 * PER_PAGE // COLUMNS * SIZE))
            for plane, (tile, (dx, dy)) in enumerate(layers):
                x = cell % COLUMNS * SIZE + dx
                y = (plane * PER_PAGE // COLUMNS + cell // COLUMNS) * SIZE + dy
                page.paste(tile, (x, y))
            if cell == PER_PAGE - 1 or slot == 484:
                page.save(DEST / f'{slot // PER_PAGE}.webp', lossless=True)


if __name__ == '__main__':
    main()
