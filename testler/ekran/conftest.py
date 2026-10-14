"""Ekran testlerinin ortak düzeni (pytest + Playwright, eşzamanlı API).

    python3 -m pytest testler/ekran -q

Fixture'lar:
  adres            proje kökünü sunan yerel http.server'ın adresi (oturum boyu, boş port)
  tarayici         Chromium (oturum boyu)
  ag               ağ durumu; baglam.set_offline(True) bunu da işaretler
  baglam           yeni tarayıcı bağlamı: 390x780, dokunmatik, tr-TR, Europe/Istanbul
  anahtar_dosyasi  veri/anahtar.json isteğinin yanıtı: .metin (None -> 404)
  sahte_github     bellek içi GitHub Contents API (testler/sahte-github.mjs ile aynı davranış)
  sayfa            bunların hepsine bağlı yeni sayfa
  ac()             uygulamayı açar
  giris_yap()      açar, parolayla girer, ana ekranı bekler
  kutu_uret()      başka parola/token ile token kutusu (anahtar.json içeriği) üretir
  kayit_yaz()      kayıt dosyalarını (çözülmüş hali) uygulamanın anahtarıyla şifreleyip sahte GitHub'a koyar
  kayit_oku()      sahte GitHub'daki bir kayıt dosyasını çözer (dosya yoksa None)

Ağa hiç çıkılmaz: https://api.github.com/** ve veri/anahtar.json istekleri page.route ile
yanıtlanır. Playwright, route ile yanıtlanan istekleri set_offline(True) iken de geçirir; bu yüzden
baglam.set_offline sarılır ve çevrimdışıyken bu istekler 'internetdisconnected' ile düşürülür.
"""
import base64
import functools
import json
import re
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest
from playwright.sync_api import expect, sync_playwright

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / 'testler' / 'ekran' / 'cikti'  # ekran görüntüleri (git'e girmez)

PAROLA = 'deneme-parolasi-12'
TOKEN = 'github_pat_deneme_0123456789abcdef'  # uydurma; gerçek token değildir
TEKRAR = 1000  # testte hızlı olsun diye; gerçek kutu 600.000 kullanır

GORUNUM = {'width': 390, 'height': 780}


def kutu_olustur(parola, token, tekrar=TEKRAR):
    """testler/yardimci/anahtar-uret.mjs ile token kutusu (JSON metni)."""
    sonuc = subprocess.run(
        ['node', 'testler/yardimci/anahtar-uret.mjs', parola, token, str(tekrar)],
        cwd=KOK, capture_output=True, text=True, check=True)
    return sonuc.stdout


# --- Sunucu ve tarayıcı ------------------------------------------------------

class _SessizIsleyici(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope='session')
def adres():
    sunucu = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_SessizIsleyici, directory=str(KOK)))
    is_parcacigi = threading.Thread(target=sunucu.serve_forever, daemon=True)
    is_parcacigi.start()
    yield f'http://127.0.0.1:{sunucu.server_port}/'
    sunucu.shutdown()
    sunucu.server_close()


@pytest.fixture(scope='session')
def tarayici():
    with sync_playwright() as p:
        tarayici = p.chromium.launch()
        yield tarayici
        tarayici.close()


@pytest.fixture(scope='session')
def deneme_kutusu():
    return kutu_olustur(PAROLA, TOKEN)


@pytest.fixture
def kutu_uret():
    return kutu_olustur


class Ag:
    def __init__(self):
        self.cevrimdisi = False


@pytest.fixture
def ag():
    return Ag()


@pytest.fixture
def baglam(tarayici, ag):
    baglam = tarayici.new_context(viewport=GORUNUM, has_touch=True, is_mobile=True,
                                  locale='tr-TR', timezone_id='Europe/Istanbul')
    asil = baglam.set_offline

    def set_offline(offline):
        ag.cevrimdisi = offline
        asil(offline)

    baglam.set_offline = set_offline
    yield baglam
    baglam.close()


# --- veri/anahtar.json -------------------------------------------------------

class AnahtarDosyasi:
    """veri/anahtar.json isteğinin yanıtı. metin None ise 404."""

    def __init__(self, metin, ag):
        self.metin = metin
        self.istekler = []  # her isteğin başlıkları
        self._ag = ag

    def __call__(self, route):
        self.istekler.append(route.request.headers)
        if self._ag.cevrimdisi:
            route.abort('internetdisconnected')
        elif self.metin is None:
            route.fulfill(status=404, content_type='text/html', body='<h1>404</h1>')
        else:
            route.fulfill(status=200, content_type='application/json', body=self.metin)


@pytest.fixture
def anahtar_dosyasi(deneme_kutusu, ag):
    return AnahtarDosyasi(deneme_kutusu, ag)


# --- Sahte GitHub Contents API ----------------------------------------------

BASE64_BICIMI = re.compile(r'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$')
KLASOR_SHA = '0' * 40
YANIT_BASLIKLARI = {
    'content-type': 'application/json; charset=utf-8',
    'x-ratelimit-remaining': '4999',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'x-ratelimit-remaining, retry-after',
}


def _base64_satirli(icerik):
    """GitHub base64'ü 60 karakterlik satırlara böler, sonda satır sonu."""
    duz = base64.b64encode(icerik.encode('utf-8')).decode('ascii')
    satirlar = [duz[i:i + 60] for i in range(0, len(duz), 60)]
    return '\n'.join(satirlar) + '\n' if satirlar else ''


class SahteGitHub:
    """Bellek içi GitHub Contents API; testler/sahte-github.mjs ile aynı davranır:

      GET  /repos/{o}/{r}                    200
      GET  .../contents/{dosya}              200 { type:'file', content (60'ar karakterlik satırlı
                                             base64), encoding:'base64', sha }
      GET  .../contents/{klasor}             200 [{ name, path, type:'file'|'dir', sha, size }]
      GET  .../contents/{olmayan}            404
      PUT  .../contents/{dosya}              yeni: 201 (sha verilmişse 409); var olan: sha yok 422,
                                             eski/yanlış sha 409, doğru 200; message/content yok ya
                                             da content base64 değil 422; gövde JSON değil 400
      diğer yöntemler                        405
    Her yazışta yeni, ardışık bir sha. Sahip/depo adı yok sayılır (adres yine kaydedilir).

    JS sahtesinden fazlası:
      * Authorization 'Bearer <token>' değilse 401 (token gerçekten çözülüp gönderildi mi?).
      * depo_durumu = 404 gibi: depo adresine (GET /repos/{o}/{r}) hep bu durum döner.
      * yazma_durumu = 401 gibi: bütün PUT'lara bu durum döner, dosyalara dokunulmaz.
      * yazma_durumlari = {'mesai/2026-10.json': 500} gibi: yalnızca o dosyaya PUT bu durumla düşer.
      * tut() / birak(): tut()'tan sonra gelen istekler bekletilir, birak() hepsini sırayla yanıtlar.
      * baglam.set_offline(True) iken istekler 'internetdisconnected' ile düşer.

    dosyalar: { yol: {'icerik': str, 'sha': str|None} } (sha verilmezse ilk okunuşta atanır)
    istekler: [{ 'yontem', 'yol' (contents yolu, depo için ''), 'adres' (URL yolu) }]
    sonraki_yanit(durum, kez=1): sıradaki kez isteği bu durumla düşürür (sırayla birikir).
    """

    def __init__(self, token, ag):
        self.token = token
        self.dosyalar = {}
        self.istekler = []
        self.depo_durumu = None
        self.yazma_durumu = None
        self.yazma_durumlari = {}
        self._ag = ag
        self._kuyruk = []
        self._sayac = 0
        self._tutulan = None

    # --- Testlerin kullandıkları ---

    def sonraki_yanit(self, durum, kez=1):
        if not (isinstance(durum, int) and 200 <= durum <= 599):
            raise ValueError('durum 200-599 arasında bir tam sayı olmalı.')
        if not (isinstance(kez, int) and kez >= 1):
            raise ValueError('kez 1 ya da daha büyük bir tam sayı olmalı.')
        self._kuyruk.append({'durum': durum, 'kalan': kez})

    def tut(self):
        if self._tutulan is None:
            self._tutulan = []

    def birak(self):
        bekleyenler, self._tutulan = self._tutulan or [], None
        for route in bekleyenler:
            self._isle(route)

    @property
    def bekleyen_sayisi(self):
        return len(self._tutulan or [])

    # --- Playwright route işleyicisi ---

    def __call__(self, route):
        if self._tutulan is not None:
            self._tutulan.append(route)
            return
        self._isle(route)

    def _isle(self, route):
        istek = route.request
        yontem = istek.method.upper()
        if yontem == 'OPTIONS':  # CORS ön isteği (Playwright çoğunlukla kendisi yanıtlar)
            route.fulfill(status=204, headers={
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, PUT',
                'access-control-allow-headers': 'authorization, accept, content-type, x-github-api-version',
            })
            return
        cozulen = self._adres_coz(istek.url)
        self.istekler.append({'yontem': yontem, 'yol': cozulen['yol'] if cozulen else '',
                              'adres': urlsplit(istek.url).path})

        if self._ag.cevrimdisi:
            route.abort('internetdisconnected')
            return
        if self._kuyruk:
            sira = self._kuyruk[0]
            sira['kalan'] -= 1
            if sira['kalan'] == 0:
                self._kuyruk.pop(0)
            self._yanitla(route, sira['durum'], {'message': f'Sahte hata {sira["durum"]}'})
            return
        if istek.headers.get('authorization') != f'Bearer {self.token}':
            self._yanitla(route, 401, {'message': 'Bad credentials'})
            return
        if cozulen is None:
            self._yanitla(route, 404, {'message': 'Not Found'})
            return

        if cozulen['tur'] == 'depo':
            if yontem != 'GET':
                self._yanitla(route, 405, {'message': 'Method Not Allowed'})
            elif self.depo_durumu is not None:
                self._yanitla(route, self.depo_durumu, {'message': f'Sahte hata {self.depo_durumu}'})
            else:
                self._yanitla(route, 200, {'full_name': '/'.join(urlsplit(istek.url).path.split('/')[2:4])})
            return

        yol = cozulen['yol']
        if yontem == 'GET':
            kayit = self._kayit_bul(yol)
            if kayit:
                self._yanitla(route, 200, {
                    'type': 'file', 'name': yol.split('/')[-1], 'path': yol, 'sha': kayit['sha'],
                    'size': len(kayit['icerik'].encode('utf-8')), 'encoding': 'base64',
                    'content': _base64_satirli(kayit['icerik']),
                })
                return
            liste = self._klasor(yol)
            if liste is not None:
                self._yanitla(route, 200, liste)
            else:
                self._yanitla(route, 404, {'message': 'Not Found'})
            return
        if yontem == 'PUT':
            durum = self.yazma_durumu if self.yazma_durumu is not None else self.yazma_durumlari.get(yol)
            if durum is not None:
                self._yanitla(route, durum, {'message': f'Sahte hata {durum}'})
                return
            durum, govde = self._yaz(yol, istek.post_data)
            self._yanitla(route, durum, govde)
            return
        self._yanitla(route, 405, {'message': 'Method Not Allowed'})

    # --- İç işler ---

    @staticmethod
    def _yanitla(route, durum, govde):
        route.fulfill(status=durum, headers=YANIT_BASLIKLARI,
                      body=None if durum in (204, 205, 304) else json.dumps(govde))

    @staticmethod
    def _adres_coz(adres):
        """'https://api.github.com/repos/{o}/{r}[/contents/{yol}]' -> {'tur', 'yol'} | None"""
        parca = urlsplit(adres)
        if f'{parca.scheme}://{parca.netloc}' != 'https://api.github.com':
            return None
        parcalar = [unquote(p) for p in parca.path.split('/') if p]
        if len(parcalar) < 3 or parcalar[0] != 'repos':
            return None
        if len(parcalar) == 3:
            return {'tur': 'depo', 'yol': ''}
        if parcalar[3] != 'contents':
            return None
        return {'tur': 'icerik', 'yol': '/'.join(parcalar[4:])}

    def _yeni_sha(self):
        self._sayac += 1
        return format(self._sayac, '040x')

    def _kayit_bul(self, yol):
        kayit = self.dosyalar.get(yol)
        if kayit is not None and not kayit.get('sha'):
            kayit['sha'] = self._yeni_sha()
        return kayit

    def _klasor(self, yol):
        onek = f'{yol}/'
        girdiler = {}
        for anahtar in list(self.dosyalar):
            if not anahtar.startswith(onek):
                continue
            geri = anahtar[len(onek):]
            if '/' not in geri:
                kayit = self._kayit_bul(anahtar)
                girdiler[geri] = {'name': geri, 'path': anahtar, 'sha': kayit['sha'],
                                  'size': len(kayit['icerik'].encode('utf-8')), 'type': 'file'}
            else:
                ad = geri.split('/', 1)[0]
                girdiler.setdefault(ad, {'name': ad, 'path': f'{onek}{ad}', 'sha': KLASOR_SHA,
                                         'size': 0, 'type': 'dir'})
        return list(girdiler.values()) if girdiler else None

    def _yaz(self, yol, govde_metni):
        try:
            govde = json.loads(govde_metni or '')
        except ValueError:
            return 400, {'message': 'Problems parsing JSON'}
        if not isinstance(govde, dict):
            return 400, {'message': 'Problems parsing JSON'}
        if not isinstance(govde.get('message'), str) or govde['message'] == '':
            return 422, {'message': 'Invalid request.\n\n"message" wasn\'t supplied.'}
        if not isinstance(govde.get('content'), str):
            return 422, {'message': 'Invalid request.\n\n"content" wasn\'t supplied.'}
        duz = govde['content'].replace('\n', '')
        if not BASE64_BICIMI.match(duz):
            return 422, {'message': 'content is not valid Base64'}

        sha = govde.get('sha')
        mevcut = self._kayit_bul(yol)
        if mevcut is not None:
            if sha is None:
                return 422, {'message': 'Invalid request.\n\n"sha" wasn\'t supplied.'}
            if sha != mevcut['sha']:
                return 409, {'message': f'{yol} does not match {sha}'}
        elif sha is not None:
            return 409, {'message': f'{yol} does not match {sha}'}

        icerik = base64.b64decode(duz).decode('utf-8', errors='replace')
        yeni = self._yeni_sha()
        self.dosyalar[yol] = {'icerik': icerik, 'sha': yeni}
        boyut = len(icerik.encode('utf-8'))
        return (200 if mevcut is not None else 201), {
            'content': {'name': yol.split('/')[-1], 'path': yol, 'sha': yeni, 'size': boyut},
            'commit': {'sha': self._yeni_sha(), 'message': govde['message']},
        }


@pytest.fixture
def sahte_github(ag):
    return SahteGitHub(TOKEN, ag)


# --- Sayfa ve yardımcılar ----------------------------------------------------

@pytest.fixture
def sayfa(baglam, sahte_github, anahtar_dosyasi):
    sayfa = baglam.new_page()
    sayfa.route('**/veri/anahtar.json', anahtar_dosyasi)
    sayfa.route('https://api.github.com/**', sahte_github)
    yield sayfa
    sayfa.close()


@pytest.fixture
def ac(sayfa, adres):
    def ac():
        sayfa.goto(adres)
        return sayfa
    return ac


@pytest.fixture
def giris_yap(sayfa, ac):
    def giris_yap(parola=PAROLA):
        ac()
        sayfa.get_by_label('Parola', exact=True).fill(parola)
        sayfa.get_by_role('button', name='Giriş yap').click()
        expect(sayfa.locator('nav.sekmeler')).to_be_visible()
        return sayfa
    return giris_yap


# --- Şifreli kayıt dosyaları -------------------------------------------------

# Dosyalar sayfanın içinde, uygulamanın kendi sifre.js'iyle şifrelenir/çözülür: anahtar parolayla
# ve anahtar.json'daki tuzla üretilir, yani uygulamanın girişte ürettiği anahtarın aynısıdır.
SIFRELE = """async ({ parola, kutu, dosyalar }) => {
  const s = await import('./uygulama/sifre.js');
  const anahtar = await s.kutudanAnahtar(parola, JSON.parse(kutu));
  const sonuc = {};
  for (const [yol, veri] of Object.entries(dosyalar)) {
    sonuc[yol] = typeof veri === 'string' ? veri : JSON.stringify(await s.sifrele(anahtar, veri));
  }
  return sonuc;
}"""

COZ = """async ({ parola, kutu, metin }) => {
  const s = await import('./uygulama/sifre.js');
  const anahtar = await s.kutudanAnahtar(parola, JSON.parse(kutu));
  return s.coz(anahtar, JSON.parse(metin));
}"""


@pytest.fixture
def kayit_yaz(sayfa, ac, adres, sahte_github, anahtar_dosyasi):
    """kayit_yaz({'calisanlar.json': {...}, 'mesai/2026-10.json': {...}}). Değer metinse olduğu gibi
    (şifresiz, bozuk dosya için) yazılır. Sayfa henüz açılmadıysa önce açılır (şifreleme sayfada yapılır)."""
    def kayit_yaz(dosyalar):
        if not sayfa.url.startswith(adres):
            ac()
        metinler = sayfa.evaluate(SIFRELE, {'parola': PAROLA, 'kutu': anahtar_dosyasi.metin, 'dosyalar': dosyalar})
        for yol, metin in metinler.items():
            sahte_github.dosyalar[yol] = {'icerik': metin, 'sha': None}
    return kayit_yaz


@pytest.fixture
def kayit_oku(sayfa, sahte_github, anahtar_dosyasi):
    def kayit_oku(yol):
        kayit = sahte_github.dosyalar.get(yol)
        if kayit is None:
            return None
        return sayfa.evaluate(COZ, {'parola': PAROLA, 'kutu': anahtar_dosyasi.metin, 'metin': kayit['icerik']})
    return kayit_oku
