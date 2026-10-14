"""Uygulama simgelerini üretir (Pillow): simge-180/192/512/512-maskable.png

    python3 araclar/simge-uret.py

Çizim giriş ekranındaki işaretle (uygulama/ekranlar/giris.js, ISARET) aynıdır: yeşil zemin,
boru şeridi, altın düğüm ve içinde saat. 64x64'lük çizim kendi boyutuna ölçeklenir; kenarlar
4 kat büyük çizilip küçültülerek yumuşatılır.

  simge-180.png           iOS ana ekranı: opak, köşeler yuvarlatılmamış (iOS kendisi yuvarlar)
  simge-192.png / 512.png yuvarlak köşeli kare, köşeler saydam
  simge-512-maskable.png  tam kenara kadar yeşil; içerik ortadaki güvenli dairenin (çap %80) içinde
"""
from pathlib import Path

from PIL import Image, ImageDraw

BORU = (0x1F, 0x6B, 0x4F)
DUGUM = (0xC4, 0x9A, 0x2C)
MUREKKEP = (0x16, 0x30, 0x2B)
BEYAZ = (255, 255, 255)
BUYUTME = 4  # kenar yumuşatma için ara çizim katsayısı

KLASOR = Path(__file__).resolve().parents[1]


def kapsul(cizici, bas, son, kalinlik, renk):
    """İki nokta arasında uçları yuvarlak kalın çizgi (Pillow'un kalın çizgisi uçlarda bozulur)."""
    (x1, y1), (x2, y2) = bas, son
    uzunluk = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    dx, dy = (y2 - y1) / uzunluk * kalinlik / 2, -(x2 - x1) / uzunluk * kalinlik / 2
    cizici.polygon([(x1 + dx, y1 + dy), (x2 + dx, y2 + dy), (x2 - dx, y2 - dy), (x1 - dx, y1 - dy)], fill=renk)
    r = kalinlik / 2
    for x, y in (bas, son):
        cizici.ellipse([x - r, y - r, x + r, y + r], fill=renk)


def isaret(boyut, yuvarlak):
    n = boyut * BUYUTME
    k = n / 64  # 64'lük çizim birimi -> piksel
    resim = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    cizici = ImageDraw.Draw(resim)
    if yuvarlak:
        cizici.rounded_rectangle([0, 0, n - 1, n - 1], radius=16 * k, fill=BORU + (255,))
    else:
        cizici.rectangle([0, 0, n, n], fill=BORU + (255,))

    boru = Image.new('RGBA', (n, n), (0, 0, 0, 0))  # yarı saydam beyaz boru şeridi
    ImageDraw.Draw(boru).rectangle([0, 28 * k, n, 36 * k], fill=BEYAZ + (round(255 * 0.32),))
    resim = Image.alpha_composite(resim, boru)
    cizici = ImageDraw.Draw(resim)

    cizici.ellipse([(32 - 15) * k, (32 - 15) * k, (32 + 15) * k, (32 + 15) * k], fill=DUGUM + (255,))
    kalinlik = 3.2 * k  # saatin ibreleri: yelkovan yukarı, akrep sağ-aşağı (uçlar yuvarlak)
    noktalar = [(32 * k, 24.5 * k), (32 * k, 32.5 * k), (37.5 * k, 36 * k)]
    for bas, son in zip(noktalar, noktalar[1:]):
        kapsul(cizici, bas, son, kalinlik, MUREKKEP + (255,))
    return resim.resize((boyut, boyut), Image.LANCZOS)


def kaydet(ad, boyut, yuvarlak, opak):
    resim = isaret(boyut, yuvarlak)
    if opak:
        resim = resim.convert('RGB')
    resim.save(KLASOR / ad, optimize=True)
    print(f'{ad}: {boyut}x{boyut}')


if __name__ == '__main__':
    kaydet('simge-180.png', 180, yuvarlak=False, opak=True)
    kaydet('simge-192.png', 192, yuvarlak=True, opak=False)
    kaydet('simge-512.png', 512, yuvarlak=True, opak=False)
    kaydet('simge-512-maskable.png', 512, yuvarlak=False, opak=True)
