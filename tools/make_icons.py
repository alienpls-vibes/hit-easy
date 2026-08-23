"""
Gera os icones do PWA sem dependencias externas (so zlib/struct da stdlib).

Desenho: fundo quase preto e cinco pips WUBRG em anel - le como "Magic" mesmo
a 48px, e mantem a mesma linguagem do brand-mark que aparece no app.

Uso:  python tools/make_icons.py
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"

BG = (8, 8, 10)
PIPS = [
    (232, 220, 190),  # W
    (92, 159, 214),   # U
    (155, 130, 184),  # B
    (217, 96, 76),    # R
    (79, 169, 124),   # G
]
SS = 4  # supersampling: desenha grande e reduz, o que da o antialias


def write_png(path, width, height, rgba):
    """Escreve um PNG RGBA de 8 bits. rgba e uma bytearray de w*h*4."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filtro "None" por linha
        raw.extend(rgba[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def render(size, corner_ratio, ring_ratio, pip_ratio):
    big = size * SS
    buf = bytearray(big * big * 4)

    radius = corner_ratio * big
    cx = cy = big / 2.0
    ring = ring_ratio * big
    pip_r = pip_ratio * big

    # Centros dos pips: um anel comecando no topo.
    centers = []
    for i in range(5):
        angle = -math.pi / 2 + i * (2 * math.pi / 5)
        centers.append((cx + ring * math.cos(angle), cy + ring * math.sin(angle)))

    for y in range(big):
        for x in range(big):
            # Recorte de canto arredondado (corner_ratio 0.5 vira circulo).
            dx = max(radius - x, x - (big - radius), 0.0)
            dy = max(radius - y, y - (big - radius), 0.0)
            if dx * dx + dy * dy > radius * radius:
                continue

            color = BG
            px, py = x + 0.5, y + 0.5
            for (ox, oy), pip in zip(centers, PIPS):
                if (px - ox) ** 2 + (py - oy) ** 2 <= pip_r * pip_r:
                    color = pip
                    break

            o = (y * big + x) * 4
            buf[o] = color[0]
            buf[o + 1] = color[1]
            buf[o + 2] = color[2]
            buf[o + 3] = 255

    # Downsample por media de blocos SS x SS.
    out = bytearray(size * size * 4)
    n = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                row = ((y * SS + sy) * big + x * SS) * 4
                for sx in range(SS):
                    o = row + sx * 4
                    r += buf[o]
                    g += buf[o + 1]
                    b += buf[o + 2]
                    a += buf[o + 3]
            o = (y * size + x) * 4
            out[o] = r // n
            out[o + 1] = g // n
            out[o + 2] = b // n
            out[o + 3] = a // n
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    jobs = [
        # (arquivo, tamanho, canto, raio do anel, raio do pip)
        ("icon-192.png", 192, 0.22, 0.26, 0.088),
        ("icon-512.png", 512, 0.22, 0.26, 0.088),
        # Maskable: fundo ate a borda e conteudo dentro da zona segura (~60%).
        ("icon-maskable.png", 512, 0.5, 0.19, 0.065),
    ]
    for name, size, corner, ring, pip in jobs:
        write_png(OUT / name, size, size, render(size, corner, ring, pip))
        print("gerado:", name, f"({size}x{size})")


if __name__ == "__main__":
    main()
