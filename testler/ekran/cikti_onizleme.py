"""Çıktı düzeninin görsel kontrolü (elle çalıştırılır, pytest toplamaz).

    python3 testler/ekran/cikti_onizleme.py

ciktiHtml() çıktısını stil.css ile Chromium'da yazdırma ortamında PDF'e çevirir:
  * sayfa sayısı (pdfinfo): 0 satır -> 1, 20 -> 1, 21 -> 2, 41 -> 3; A4 yatay
  * hiçbir hücre metni taşmaz (başlıklar, uzun ad/neden, "23 saat 59 dakika")
  * ilk iki sayfa PNG olarak testler/ekran/cikti/ altına yazılır; kâğıt formla
    (kagit-form.jpg) gözle karşılaştırılır.
Çıktı dosyaları git'e girmez (.gitignore).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / 'testler' / 'ekran' / 'cikti'

NODE = """
import { ciktiHtml } from './uygulama/cikti.js';
let s = '';
for await (const parca of process.stdin) s += parca;
process.stdout.write(ciktiHtml(JSON.parse(s)));
"""

CALISANLAR = [
    {'id': 'c1', 'ad': 'Ali Veli', 'aktif': True},
    {'id': 'c2', 'ad': 'Çağrı Işık', 'aktif': True},
    {'id': 'c3', 'ad': 'Şule Öztürk Çağlayan Işıklı Gündoğdu', 'aktif': True},
]
AYARLAR = {
    'bolumYazisi': 'Su ve Kanalizasyon Müdürlüğü',
    'imza': {'bolumAmiri': 'Şule Öztürk', 'puantor': 'Çağrı Işık', 'bolumMuduru': 'Ali Veli'},
}
NEDEN_60 = ('Şebeke arızası nedeniyle İğdır hattında acil vana değişimi ve kontrol yapıldı')[:60]


def ornek_satirlar(adet):
    """Hafta içi, cumartesi, pazar ve uç uzunlukta satırlar karışık."""
    satirlar = []
    for i in range(adet):
        gun = 1 + i % 28
        tarih = f'2026-10-{gun:02d}'
        satir = {'id': f's{i}', 'tarih': tarih, 'calisanId': f'c{1 + i % 3}',
                 'neden': 'Pompa arızası', 'baslama': '17:00', 'bitis': '19:40'}
        satirlar.append(satir)
    if adet >= 4:
        satirlar[0].update(tarih='2026-10-17', baslama='00:00', bitis='23:59', neden=NEDEN_60)  # cumartesi, 23 saat 59 dakika
        satirlar[1].update(tarih='2026-10-18', baslama=None, bitis=None, neden='Vardiya desteği')  # pazar
        satirlar[2].update(neden='Ş' * 60)  # boşluksuz 60 karakter
        satirlar[3].update(tarih='2026-10-14', baslama='18:00', bitis='20:00', calisanId='c3')
    return satirlar


def html_uret(adet, ad):
    girdi = {'satirlar': ornek_satirlar(adet), 'calisanlar': CALISANLAR,
             'ayarlar': AYARLAR, 'tanzim': '2026-10-14'}
    govde = subprocess.run(['node', '--input-type=module', '-e', NODE], cwd=KOK, input=json.dumps(girdi),
                           capture_output=True, text=True, check=True).stdout
    yol = CIKTI / f'{ad}.html'
    yol.write_text(
        '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Önizleme</title>'
        '<link rel="stylesheet" href="../../../stil.css"></head><body>' + govde + '</body></html>',
        encoding='utf-8')
    return yol


def pdfinfo(yol):
    metin = subprocess.run(['pdfinfo', str(yol)], capture_output=True, text=True, check=True).stdout
    sayfa = int(re.search(r'Pages:\s+(\d+)', metin).group(1))
    boyut = re.search(r'Page size:\s+(.+)', metin).group(1).strip()
    return sayfa, boyut


def a4_yatay(boyut):
    """'841.92 x 594.96 pts (A4)': Chromium piksel yuvarlaması yüzünden 1-2 pt oynar."""
    g, y = map(float, re.match(r'([\d.]+) x ([\d.]+)', boyut).groups())
    return abs(g - 841.89) < 2 and abs(y - 595.28) < 2


# Hücre içinde hiçbir şey taşmamalı: metin kutusu en fazla iki satır, başlıklar hücreye sığar.
TASMA_KONTROLU = """
() => {
  const sorunlar = [];
  const stil = document.createElement('style');
  stil.textContent = '.cikti-metin{-webkit-line-clamp:none !important;line-clamp:none !important;display:block !important}';
  document.head.appendChild(stil);
  const kutu = (el) => el.getBoundingClientRect();
  document.querySelectorAll('.cikti-hucre').forEach((hucre) => {
    const ic = hucre.firstElementChild;
    if (!ic) return;
    const h = kutu(hucre), m = kutu(ic);
    const satirYuksekligi = parseFloat(getComputedStyle(ic).lineHeight);
    const satirSayisi = Math.round(m.height / satirYuksekligi);
    const cizgiKalinligi = parseFloat(getComputedStyle(hucre).borderBottomWidth);
    const siniflar = hucre.className;
    if (ic.classList.contains('cikti-metin') && satirSayisi > 2)
      sorunlar.push(`${satirSayisi} satır: ${ic.textContent.slice(0, 30)} [${siniflar}]`);
    if (m.height > h.height - cizgiKalinligi + 0.5)
      sorunlar.push(`dikey taşma: ${ic.textContent.slice(0, 30)} [${siniflar}] ${m.height.toFixed(2)} > ${h.height.toFixed(2)}`);
    if (ic.scrollWidth > ic.clientWidth + 1 || m.width > h.width + 0.5)
      sorunlar.push(`yatay taşma: ${ic.textContent.slice(0, 30)} [${siniflar}]`);
  });
  stil.remove();
  return sorunlar;
}
"""


def main():
    CIKTI.mkdir(parents=True, exist_ok=True)
    hata = False
    with sync_playwright() as p:
        tarayici = p.chromium.launch()
        sayfa = tarayici.new_page()
        for adet, beklenen in [(0, 1), (20, 1), (21, 2), (41, 3)]:
            html = html_uret(adet, f'satir-{adet}')
            sayfa.goto(html.as_uri())
            sayfa.emulate_media(media='print')
            if adet == 21:
                # Figtree depoya Görev 8'de gelir; burada Carlito (Calibri ölçülü), Arial ölçülü ve
                # çok geniş bir yazı tipiyle (DejaVu Sans) denenir: hücreler hepsinde taşmamalı.
                for yazi in (None, 'Liberation Sans', 'DejaVu Sans'):
                    stil = sayfa.add_style_tag(
                        content=f'.cikti-sayfa {{ font-family: "{yazi}" !important }}' if yazi else '.cikti-sayfa {}')
                    sorunlar = sayfa.evaluate(TASMA_KONTROLU)
                    print(f"taşma kontrolü [{yazi or 'varsayılan'}]:", 'temiz' if not sorunlar else sorunlar)
                    hata |= bool(sorunlar)
                    stil.evaluate('e => e.remove()')
                bolum_sayisi = sayfa.evaluate("document.querySelectorAll('.cikti-sayfa').length")
                assert bolum_sayisi == 2, bolum_sayisi
            # 1) yazdır penceresinin yaptığı gibi: @page boyutu geçerli
            pdf_css = CIKTI / f'satir-{adet}-css.pdf'
            sayfa.pdf(path=str(pdf_css), prefer_css_page_size=True, print_background=True)
            # 2) planın adımındaki gibi: format A4 + landscape
            pdf = CIKTI / f'satir-{adet}.pdf'
            sayfa.pdf(path=str(pdf), format='A4', landscape=True, print_background=True)
            for yol in (pdf_css, pdf):
                sayi, boyut = pdfinfo(yol)
                ok = sayi == beklenen and a4_yatay(boyut)
                hata |= not ok
                print(f"{yol.name}: {sayi} sayfa (beklenen {beklenen}), {boyut} {'OK' if ok else 'HATA'}")
        tarayici.close()

    pdf = CIKTI / 'satir-21.pdf'
    subprocess.run(['pdftoppm', '-r', '110', '-png', '-f', '1', '-l', '2', str(pdf), str(CIKTI / 'sayfa')], check=True)
    print('PNG:', *sorted(str(x) for x in CIKTI.glob('sayfa-*.png')), sep='\n  ')
    sys.exit(1 if hata else 0)


if __name__ == '__main__':
    main()
