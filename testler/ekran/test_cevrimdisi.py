"""Telefona yükleme ve çevrimdışı açılış (Görev 11): servis çalışanı, manifest, yüklenebilirlik."""
import functools
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import pytest
from playwright.sync_api import expect

from conftest import KOK

INTERNET_YOK = 'İnternet bağlantısı yok. Kayıtlar internetle açılır.'
ONBELLEK = 'fazla-mesai-v1'

ANAHTARLAR = f"""() => caches.keys().then(async (adlar) => {{
  const sonuc = {{ adlar }};
  const o = await caches.open('{ONBELLEK}');
  const anahtarlar = await o.keys();
  sonuc.adresler = anahtarlar.map((r) => new URL(r.url).pathname);
  sonuc.tamAdresler = anahtarlar.map((r) => r.url);
  return sonuc;
}})"""


class OzelSunucu:
    """Testin kendi yerel sunucusu: proje klasörünü sunar; dosya engellenebilir, değiştirilebilir ve
    sunucu kapatılabilir. Servis çalışanının istekleri Playwright'ın route'larından geçmez; ağın
    gerçekten gitmesi (sunucunun kapanması) ancak böyle denenir. Kapanınca bağlantı reddedilir."""

    def __init__(self):
        self.engelli = set()  # bu yollar 404 verir
        self.degisen = {}  # yol -> (içerik türü, metin)
        sunucu = self

        class Isleyici(SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                yol = urlsplit(self.path).path
                if yol in sunucu.engelli:
                    self.send_error(404)
                elif yol in sunucu.degisen:
                    tur, metin = sunucu.degisen[yol]
                    govde = metin.encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', tur)
                    self.send_header('Content-Length', str(len(govde)))
                    self.end_headers()
                    self.wfile.write(govde)
                else:
                    super().do_GET()

        self._httpd = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Isleyici, directory=str(KOK)))
        self.adres = f'http://127.0.0.1:{self._httpd.server_port}/'
        self._acik = True
        threading.Thread(target=self._httpd.serve_forever, daemon=True).start()

    def kapat(self):
        if self._acik:
            self._acik = False
            self._httpd.shutdown()
            self._httpd.server_close()


@pytest.fixture
def sunucu():
    sunucu = OzelSunucu()
    yield sunucu
    sunucu.kapat()


@pytest.fixture
def adres(sunucu):  # conftest'teki oturum sunucusu yerine bu dosyadaki testler kendi sunucusunu kullanır
    return sunucu.adres


def internet_kes(baglam, ag, sunucu):
    """Gerçek çevrimdışı: sayfa ağı kapanır (anahtar.json düşer), sunucu da kapanır (servis çalışanı)."""
    baglam.set_offline(True)
    sunucu.kapat()


HAZIR_MI = """async () => {
  const kayit = await navigator.serviceWorker.getRegistration();
  return Boolean(kayit && kayit.active) && navigator.serviceWorker.controller !== null;
}"""


def hazir(sayfa, sure=15):
    """Servis çalışanı kurulup etkin olana ve sayfayı denetlemeye başlayana kadar bekler."""
    bitis = time.monotonic() + sure
    while not sayfa.evaluate(HAZIR_MI):
        assert time.monotonic() < bitis, 'servis çalışanı hazır olmadı'
        time.sleep(0.1)


def test_cevrimdisi_acilis(sayfa, ac, baglam, ag, sunucu):
    ac()
    expect(sayfa.get_by_label('Parola', exact=True)).to_be_visible()
    hazir(sayfa)
    internet_kes(baglam, ag, sunucu)
    sayfa.reload()
    # Sayfa önbellekten açıldı (tarayıcının "internet yok" sayfası değil); kayıtlar internetsiz açılmaz.
    expect(sayfa.get_by_role('heading', name='Fazla Mesai', exact=True)).to_be_visible()
    expect(sayfa.get_by_text(INTERNET_YOK, exact=True)).to_be_visible()


def test_cevrimdisi_kutuphane_ve_yazi_tipleri_onbellekte(sayfa, ac, baglam, ag, sunucu):
    ac()
    hazir(sayfa)
    internet_kes(baglam, ag, sunucu)
    durumlar = sayfa.evaluate("""() => Promise.all(
      ['kutuphane/jspdf.umd.min.js', 'kutuphane/figtree-400.ttf', 'kutuphane/figtree-600.ttf',
       'kutuphane/yazitipi/figtree-latin-400-normal.woff2', 'manifest.webmanifest', 'simge-192.png']
        .map((d) => fetch(d).then((y) => y.status, () => 'hata')))""")
    assert durumlar == [200] * 6


def test_onbellek_adi_ve_icerigi(sayfa, ac, adres):
    ac()
    hazir(sayfa)
    kayit = sayfa.evaluate("""() => navigator.serviceWorker.getRegistration()
      .then((k) => ({ kapsam: k.scope, betik: k.active.scriptURL }))""")
    assert kayit == {'kapsam': adres, 'betik': adres + 'sw.js'}  # kapsam: uygulamanın klasörü
    sonuc = sayfa.evaluate(ANAHTARLAR)
    assert sonuc['adlar'] == [ONBELLEK]
    adresler = set(sonuc['adresler'])
    for beklenen in ['/', '/index.html', '/stil.css', '/manifest.webmanifest', '/simge-180.png',
                     '/simge-512-maskable.png', '/uygulama/baslat.js', '/uygulama/sifre.js',
                     '/uygulama/ekranlar/giris.js', '/kutuphane/jspdf.umd.min.js',
                     '/kutuphane/figtree-600.ttf']:
        assert beklenen in adresler, beklenen


def test_servis_calisani_api_ve_anahtara_karismaz(sayfa, giris_yap, anahtar_dosyasi, adres):
    giris_yap()
    hazir(sayfa)
    sayfa.reload()  # sayfa artık servis çalışanının denetiminde açılır
    expect(sayfa.locator('nav.sekmeler')).to_be_visible()
    onceki = len(anahtar_dosyasi.istekler)
    sayfa.reload()
    expect(sayfa.locator('nav.sekmeler')).to_be_visible()
    # anahtar.json her açılışta ağdan (route'a) gelir; önbellekten ya da servis çalışanından değil
    assert len(anahtar_dosyasi.istekler) > onceki
    tam = sayfa.evaluate(ANAHTARLAR)['tamAdresler']
    assert not any('anahtar.json' in u or 'api.github.com' in u for u in tam)
    assert all(u.startswith(adres) for u in tam)  # yalnızca uygulamanın kendi dosyaları


def test_agdan_once_sonra_onbellek(sayfa, ac, baglam, ag, sunucu):
    ac()
    hazir(sayfa)
    sunucu.degisen['/stil.css'] = ('text/css', 'body { background: rgb(1, 2, 3) !important }')
    sayfa.reload()  # ağ varsa ağdaki (yeni) dosya gelir, önbellekteki eskisi değil ...
    expect(sayfa.locator('body')).to_have_css('background-color', 'rgb(1, 2, 3)')
    internet_kes(baglam, ag, sunucu)
    sayfa.reload()  # ... ve önbellek onunla tazelenmiştir: ağ yokken de aynı dosya gelir
    expect(sayfa.get_by_text(INTERNET_YOK, exact=True)).to_be_visible()
    expect(sayfa.locator('body')).to_have_css('background-color', 'rgb(1, 2, 3)')


def test_tek_dosya_inmezse_kurulum_bozulmaz(sayfa, ac, sunucu):
    sunucu.engelli.add('/kutuphane/jspdf.umd.min.js')
    ac()
    hazir(sayfa)
    adresler = set(sayfa.evaluate(ANAHTARLAR)['adresler'])
    assert '/kutuphane/jspdf.umd.min.js' not in adresler
    for beklenen in ['/', '/index.html', '/stil.css', '/uygulama/baslat.js', '/kutuphane/figtree-400.ttf']:
        assert beklenen in adresler, beklenen


def test_yuklenebilir(sayfa, ac, baglam):
    ac()
    hazir(sayfa)
    cdp = baglam.new_cdp_session(sayfa)
    hatalar, bitis = None, time.monotonic() + 8
    while time.monotonic() < bitis:  # denetim sayfa yüklendikten biraz sonra tamamlanır
        hatalar = cdp.send('Page.getInstallabilityErrors')['installabilityErrors']
        if hatalar == []:
            break
        time.sleep(0.25)
    assert hatalar == []
    bildirim = cdp.send('Page.getAppManifest')
    assert bildirim['url'].endswith('/manifest.webmanifest')
    assert bildirim['errors'] == []

