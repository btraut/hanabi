#!/usr/bin/env python3
"""Build the production Hanabi card faces from one consistent raster template."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND_ATLAS = ROOT / "docs/design/hanabi-card-background-atlas-v2.png"
EMBLEMS = ROOT / "apps/web/public/images/hanabi/generated/card-emblems"
OUTPUT = ROOT / "apps/web/src/assets/hanabi/card-faces"

WIDTH = 500
HEIGHT = 640


SUITS = {
    "red": {
        "background_box": (61, 42, 383, 489),
        "dark": (92, 7, 22),
        "light": (224, 69, 62),
    },
    "blue": {
        "background_box": (432, 42, 743, 489),
        "dark": (0, 69, 132),
        "light": (61, 181, 226),
    },
    "green": {
        "background_box": (793, 42, 1104, 489),
        "dark": (22, 76, 18),
        "light": (104, 178, 52),
    },
    "yellow": {
        "background_box": (1154, 42, 1476, 489),
        "dark": (126, 61, 0),
        "light": (207, 126, 0),
    },
    "white": {
        "background_box": (61, 539, 383, 979),
        "dark": (56, 62, 71),
        "light": (189, 195, 202),
    },
    "purple": {
        "background_box": (432, 539, 743, 979),
        "dark": (86, 32, 135),
        "light": (214, 160, 238),
    },
    "rainbow": {
        "background_box": (793, 539, 1104, 979),
        "dark": (26, 36, 69),
        "light": (220, 184, 80),
    },
    "black": {
        "background_box": (1154, 539, 1476, 979),
        "dark": (74, 76, 80),
        "light": (215, 213, 201),
    },
}


def background_plate(atlas: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    plate = atlas.crop(box).convert("RGB")
    plate = plate.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return ImageEnhance.Sharpness(plate).enhance(1.08).convert("RGBA")


def tint_emblem(name: str, spec: dict[str, object]) -> Image.Image:
    emblem = Image.open(EMBLEMS / f"{name}.png").convert("RGBA")
    alpha = emblem.getchannel("A")

    if name == "rainbow":
        rgb = emblem.convert("RGB")
        rgb = ImageEnhance.Color(rgb).enhance(0.68)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.5)
        rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
    else:
        gray = ImageOps.autocontrast(ImageOps.grayscale(emblem.convert("RGB")), cutoff=1)
        gray = gray.point(lambda value: round(255 * (value / 255) ** 1.55))
        if name == "yellow":
            gray = ImageOps.posterize(gray.convert("RGB"), 3).convert("L")
        gray = ImageEnhance.Contrast(gray).enhance(0.94)
        rgb = ImageOps.colorize(gray, black=spec["dark"], white=spec["light"])

    rgb.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox:
        rgb = rgb.crop(bbox)

    max_width = 300
    max_height = 230 if name == "purple" else 258 if name == "rainbow" else 242
    scale = min(max_width / rgb.width, max_height / rgb.height)
    return rgb.resize(
        (round(rgb.width * scale), round(rgb.height * scale)),
        Image.Resampling.LANCZOS,
    )


def build_face(atlas: Image.Image, name: str, spec: dict[str, object]) -> Image.Image:
    card = background_plate(atlas, spec["background_box"])

    emblem = tint_emblem(name, spec)
    emblem_x = (WIDTH - emblem.width) // 2
    emblem_y = round(HEIGHT * 0.55)

    if name == "rainbow":
        emblem_alpha = Image.new("L", card.size, 0)
        emblem_alpha.paste(emblem.getchannel("A"), (emblem_x, emblem_y))
        expanded_alpha = emblem_alpha.filter(ImageFilter.MaxFilter(13))
        halo_alpha = ImageChops.subtract(expanded_alpha, emblem_alpha).point(
            lambda value: round(value * 0.62)
        )
        halo = Image.new("RGBA", card.size, (255, 244, 216, 0))
        halo.putalpha(halo_alpha)
        card.alpha_composite(halo)

    card.alpha_composite(emblem, (emblem_x, emblem_y))

    return card


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(BACKGROUND_ATLAS).convert("RGB")
    for name, spec in SUITS.items():
        build_face(atlas, name, spec).save(OUTPUT / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
