"""Uygulama simgeleri (Görev 11): boyutlar, zemin, altın düğüm, maskable güvenli alan."""
import math

import pytest
from PIL import Image

from conftest import KOK

BORU = (0x1F, 0x6B, 0x4F)
DUGUM = (0xC4, 0x9A, 0x2C)


def ac(ad):
    return Image.open(KOK / ad).convert('RGBA')


def yakin(a, b, pay=14):
    return all(abs(x - y) <= pay for x, y in zip(a[:3], b[:3]))


def altin_mi(piksel):
    r, g, b, a = piksel
    return a > 200 and r > 150 and g > 110 and b < 100 and r - b > 80


@pytest.mark.parametrize('ad,boyut', [('simge-180.png', 180), ('simge-192.png', 192),
                                       ('simge-512.png', 512), ('simge-512-maskable.png', 512)])
def test_simge_boyutu(ad, boyut):
    resim = Image.open(KOK / ad)
    assert resim.size == (boyut, boyut)
    assert resim.format == 'PNG'


def test_ios_simgesi_opak_ve_koseler_yesil():
    # iOS kendi köşe yuvarlamasını uygular; saydam piksel siyah görünür.
    resim = ac('simge-180.png')
    assert resim.getchannel('A').getextrema() == (255, 255)
    for kose in [(0, 0), (179, 0), (0, 179), (179, 179)]:
        assert yakin(resim.getpixel(kose), BORU), kose


@pytest.mark.parametrize('ad', ['simge-192.png', 'simge-512.png'])
def test_normal_simge_yuvarlak_kose_ve_altin_dugum(ad):
    resim = ac(ad)
    n = resim.size[0]
    assert resim.getpixel((0, 0))[3] == 0  # köşe saydam (mağaza simgesi gibi yuvarlak kare)
    assert resim.getpixel((n // 2, n // 20))[3] == 255  # üst kenar ortası dolu
    assert yakin(resim.getpixel((n // 8, n // 3)), BORU)  # zemin yeşil
    # merkezin hemen üstü/altı altın düğüm (saat ibrelerinin dışında)
    assert altin_mi(resim.getpixel((int(n * 0.30), n // 2)))
    assert altin_mi(resim.getpixel((n // 2, int(n * 0.70))))


def test_maskable_tam_kenar_ve_icerik_guvenli_alanda():
    resim = ac('simge-512-maskable.png')
    n = resim.size[0]
    assert resim.getchannel('A').getextrema() == (255, 255)  # tam kenara kadar opak
    for kose in [(0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1)]:
        assert yakin(resim.getpixel(kose), BORU), kose
    merkez, yaricap = n / 2, n * 0.4  # güvenli alan: çapı simgenin %80'i olan daire
    altinlar = [(x, y) for y in range(n) for x in range(n) if altin_mi(resim.getpixel((x, y)))]
    assert len(altinlar) > n * n * 0.05  # düğüm görünür boyutta
    uzak = [(x, y) for x, y in altinlar if math.hypot(x - merkez, y - merkez) > yaricap]
    assert uzak == []


def test_simgeler_birbirine_benzer_cizim():
    # Aynı çizimin farklı boyutları: 192 ile 512'nin ortasındaki piksel aynı renk ailesinden
    a, b = ac('simge-192.png'), ac('simge-512.png')
    assert yakin(a.getpixel((int(192 * 0.30), 96)), b.getpixel((int(512 * 0.30), 256)), pay=30)
