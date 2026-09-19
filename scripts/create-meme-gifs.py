"""Legacy fallback animator.

The active meme pack now uses source GIFs from the recorded imageSourceUrl values.
This script is kept only for experiments and is not part of the shipped asset path.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "public" / "assets" / "meme-packs" / "images"

ASSETS = {
    "impact-boom-01": "impact-boom-01.png",
    "deadpan-drop-01": "deadpan-drop-01.jpg",
    "party-horn-01": "party-horn-01.jpg",
    "fail-buzzer-01": "fail-buzzer-01.png",
    "surprise-rise-01": "surprise-rise-01.png",
    "victory-fanfare-01": "victory-fanfare-01.jpg",
}

FRAME_COUNT = 8
FRAME_DURATION_MS = 140
MAX_DIMENSION = 480


def animated_frame(base: Image.Image, progress: float) -> Image.Image:
    width, height = base.size
    pulse = 1.0 + 0.035 * (1.0 - math.cos(progress * math.tau)) / 2.0
    zoomed = base.resize((round(width * pulse), round(height * pulse)), Image.Resampling.LANCZOS)
    shift_x = round(math.sin(progress * math.tau) * width * 0.012)
    shift_y = round(math.cos(progress * math.tau) * height * 0.008)
    left = (zoomed.width - width) // 2 + shift_x
    top = (zoomed.height - height) // 2 + shift_y
    left = max(0, min(left, zoomed.width - width))
    top = max(0, min(top, zoomed.height - height))
    return zoomed.crop((left, top, left + width, top + height))


def make_gif(asset_id: str, source_name: str) -> None:
    source_path = IMAGE_DIR / source_name
    output_path = IMAGE_DIR / f"{asset_id}.gif"
    with Image.open(source_path) as source:
        source = source.convert("RGB")
        source.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
        frames = [
            animated_frame(source, index / FRAME_COUNT).quantize(colors=256, method=Image.Quantize.MEDIANCUT)
            for index in range(FRAME_COUNT)
        ]
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=FRAME_DURATION_MS,
            loop=0,
            optimize=True,
            disposal=2,
        )
    print(f"{asset_id}: {source_name} -> {output_path.name}")


if __name__ == "__main__":
    for asset_id, source_name in ASSETS.items():
        make_gif(asset_id, source_name)
