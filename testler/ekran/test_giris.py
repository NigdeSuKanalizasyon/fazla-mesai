"""Kabuk, giriş ve oturum (Görev 8)."""
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from playwright.sync_api import expect

from conftest import CIKTI, GORUNUM, PAROLA, TOKEN

AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
             'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
SEKMELER = [('cizelge', 'Çizelge'), ('toplamlar', 'Mesailer'),
            ('calisanlar', 'Çalışanlar'), ('ayarlar', 'Ayarlar')]

PAROLA_YANLIS = 'Parola yanlış.'
INTERNET_YOK = 'İnternet bağlantısı yok. Kayıtlar internetle açılır.'
YETKI = "GitHub anahtarının süresi dolmuş. Anıl'a haber verin."
DEPO_YOK = "Kayıt deposuna ulaşılamıyor. Anıl'a haber verin."

GUN_MS = 24 * 60 * 60 * 1000

# IndexedDB'deki oturum kaydını okur; veritabanı yoksa yaratmadan null döner.
KAYIT_OKU = """() => new Promise((ok, hata) => {
  const ac = indexedDB.open('fazla-mesai');
  ac.onupgradeneeded = () => ac.transaction.abort();  // yoksa yaratma
  ac.onerror = () => (ac.error?.name === 'AbortError' ? ok(null) : hata(ac.error));
  ac.onsuccess = () => {
    const db = ac.result;
    if (!db.objectStoreNames.contains('oturum')) { db.close(); ok(null); return; }
    const al = db.transaction('oturum').objectStore('oturum').get('anahtar');
    al.onerror = () => { db.close(); hata(al.error); };
    al.onsuccess = () => {
      db.close();
      const k = al.result;
      if (k === undefined) { ok(null); return; }
      ok({
        alanlar: Object.keys(k).sort(),
        cryptoKey: k.anahtar instanceof CryptoKey,
        disariVerilir: k.anahtar?.extractable,
        algoritma: k.anahtar?.algorithm?.name,
        zaman: k.zaman,
        metin: JSON.stringify(k),
      });
    };
  };
})"""

# Oturum kaydının zamanını `gun` gün geriye alır.
ZAMANI_GERI_AL = """(gun) => new Promise((ok, hata) => {
  const ac = indexedDB.open('fazla-mesai');
  ac.onerror = () => hata(ac.error);
  ac.onsuccess = () => {
    const db = ac.result;
    const tx = db.transaction('oturum', 'readwrite');
    const depo = tx.objectStore('oturum');
    const al = depo.get('anahtar');
    al.onsuccess = () => { const k = al.result; k.zaman -= gun * %d; depo.put(k, 'anahtar'); };
    tx.oncomplete = () => { db.close(); ok(); };
    tx.onerror = () => { db.close(); hata(tx.error); };
  };
})""" % GUN_MS


def bu_ay():
    simdi = datetime.now(ZoneInfo('Europe/Istanbul'))
    return f'{AY_ADLARI[simdi.month - 1]} {simdi.year}'


def parola_kutusu(sayfa):
    return sayfa.get_by_label('Parola', exact=True)


def giris_dugmesi(sayfa):
    return sayfa.get_by_role('button', name='Giriş yap')


def sekme(sayfa, kimlik):
    return sayfa.locator(f'nav.sekmeler [data-sekme="{kimlik}"]')


def ana_ekran_yok(sayfa):
    expect(sayfa.locator('nav.sekmeler')).to_have_count(0)


def parolayla_dene(sayfa, parola):
    parola_kutusu(sayfa).fill(parola)
    giris_dugmesi(sayfa).click()


# --- Görev 8'in testleri -----------------------------------------------------

def test_yanlis_parola(sayfa, ac, sahte_github):
    ac()
    parolayla_dene(sayfa, 'yanlis-parola-12')
    expect(sayfa.get_by_text(PAROLA_YANLIS, exact=True)).to_be_visible()
    expect(parola_kutusu(sayfa)).to_have_value('')  # spec 9: kutu temizlenir
    ana_ekran_yok(sayfa)
    assert sahte_github.istekler == []  # token çözülemedi, GitHub'a hiç gidilmedi
    assert sayfa.evaluate(KAYIT_OKU) is None


def test_dogru_parola_ana_ekran(sayfa, giris_yap, sahte_github):
    giris_yap()
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')
    for kimlik, ad in SEKMELER:
        expect(sekme(sayfa, kimlik)).to_have_text(ad)
    expect(sayfa.locator('nav.sekmeler [data-sekme]')).to_have_count(4)
    expect(sayfa.get_by_role('heading', name=bu_ay(), exact=True)).to_be_visible()
    # depo denetlendi, doğru depoya, çözülmüş token ile (yanlış token sahtede 401 olurdu)
    assert {'yontem': 'GET', 'yol': '', 'adres': '/repos/NigdeSuKanalizasyon/fazla-mesai-veri'} \
        in sahte_github.istekler


def test_yeniden_acinca_parola_sormaz(sayfa, giris_yap):
    giris_yap()
    sayfa.reload()
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')
    expect(sayfa.get_by_role('heading', name=bu_ay(), exact=True)).to_be_visible()
    expect(parola_kutusu(sayfa)).to_have_count(0)


def test_30_gun_sonra_sorar(sayfa, giris_yap):
    giris_yap()
    sayfa.evaluate(ZAMANI_GERI_AL, 31)
    sayfa.reload()
    expect(parola_kutusu(sayfa)).to_be_visible()
    ana_ekran_yok(sayfa)
    assert sayfa.evaluate(KAYIT_OKU) is None  # eskimiş kayıt silindi


def test_cikis(sayfa, giris_yap):
    giris_yap()
    sekme(sayfa, 'ayarlar').click()
    sayfa.get_by_role('button', name='Çıkış').click()
    expect(parola_kutusu(sayfa)).to_be_visible()
    ana_ekran_yok(sayfa)
    sayfa.reload()
    expect(parola_kutusu(sayfa)).to_be_visible()
    ana_ekran_yok(sayfa)
    assert sayfa.evaluate(KAYIT_OKU) is None


def test_depo_yok(sayfa, ac, sahte_github):
    sahte_github.depo_durumu = 404
    ac()
    parolayla_dene(sayfa, PAROLA)
    expect(sayfa.get_by_text(DEPO_YOK, exact=True)).to_be_visible()
    ana_ekran_yok(sayfa)
    expect(sayfa.get_by_text('Kayıt deposu bulunamadı')).to_have_count(0)  # github.js'in iç metni değil
    assert sayfa.evaluate(KAYIT_OKU) is None  # giriş tamamlanmadı, oturum kaydedilmedi


def test_internet_yok(sayfa, baglam, ac):
    ac()
    expect(parola_kutusu(sayfa)).to_be_visible()
    baglam.set_offline(True)
    parolayla_dene(sayfa, PAROLA)
    expect(sayfa.get_by_text(INTERNET_YOK, exact=True)).to_be_visible()
    ana_ekran_yok(sayfa)
    expect(parola_kutusu(sayfa)).to_have_value(PAROLA)  # parola doğruydu, silinmez
    baglam.set_offline(False)
    giris_dugmesi(sayfa).click()  # internet gelince aynı düğmeyle tekrar
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')


# --- Ek testler --------------------------------------------------------------

def test_acilirken_dugme_pasif(sayfa, ac, sahte_github):
    ac()
    sahte_github.tut()
    parolayla_dene(sayfa, PAROLA)
    dugme = sayfa.get_by_role('button', name='Açılıyor…')
    expect(dugme).to_be_disabled()
    expect(giris_dugmesi(sayfa)).to_have_count(0)
    sahte_github.birak()
    expect(sayfa.locator('nav.sekmeler')).to_be_visible()


def test_oturum_kaydi_bicimi(sayfa, giris_yap):
    giris_yap()
    kayit = sayfa.evaluate(KAYIT_OKU)
    assert kayit['alanlar'] == ['anahtar', 'zaman']
    assert kayit['cryptoKey'] is True
    assert kayit['disariVerilir'] is False  # non-extractable
    assert kayit['algoritma'] == 'AES-GCM'
    simdi = sayfa.evaluate('Date.now()')
    assert 0 <= simdi - kayit['zaman'] < 60_000
    assert TOKEN not in kayit['metin'] and PAROLA not in kayit['metin']
    # başka tarayıcı deposu varsa anahtarları 'fazla-mesai.' ile başlar; token/parola yok
    depolar = sayfa.evaluate("""() => [localStorage, sessionStorage].flatMap((d) =>
        Object.keys(d).map((k) => [k, d.getItem(k)]))""")
    for anahtar, deger in depolar:
        assert anahtar.startswith('fazla-mesai.')
        assert TOKEN not in deger and PAROLA not in deger


def test_29_gun_sonra_sormaz(sayfa, giris_yap):
    giris_yap()
    sayfa.evaluate(ZAMANI_GERI_AL, 29)
    sayfa.reload()
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')
    expect(parola_kutusu(sayfa)).to_have_count(0)


def test_oturum_modulu_sinirlar(sayfa, ac):
    ac()
    expect(parola_kutusu(sayfa)).to_be_visible()
    sonuc = sayfa.evaluate("""async () => {
      const o = await import('./uygulama/oturum.js');
      const gun = 864e5;
      const yeniAnahtar = (disari) => crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, disari, ['encrypt', 'decrypt']);
      const hamYaz = (deger) => new Promise((ok, hata) => {
        const ac = indexedDB.open('fazla-mesai');
        ac.onsuccess = () => {
          const tx = ac.result.transaction('oturum', 'readwrite');
          tx.objectStore('oturum').put(deger, 'anahtar');
          tx.oncomplete = () => { ac.result.close(); ok(); };
          tx.onerror = () => hata(tx.error);
        };
      });
      const anahtarMi = async (vaat) => (await vaat) instanceof CryptoKey;
      const anahtar = await yeniAnahtar(false);
      const s = {};
      await o.oturumKaydet(anahtar, 1000);
      s.sinirdanOnce = await anahtarMi(o.oturumGetir(1000 + 30 * gun - 1));
      s.sinirda = await o.oturumGetir(1000 + 30 * gun);
      s.sonraSilinmis = await o.oturumGetir(1000);
      await o.oturumKaydet(anahtar, 1000 + 10 * gun);
      s.ileriTarihli = await o.oturumGetir(1000);
      await hamYaz({ anahtar: 'metin', zaman: Date.now() });
      s.anahtarDegil = await o.oturumGetir();
      await hamYaz({ anahtar, zaman: String(Date.now()) });
      s.zamanMetin = await o.oturumGetir();
      await hamYaz(null);
      s.bosKayit = await o.oturumGetir();
      s.disariVerilebilirReddedilir = await o.oturumKaydet(await yeniAnahtar(true))
        .then(() => false, (hata) => hata instanceof TypeError);
      s.reddedilenYazilmadi = await o.oturumGetir();
      await o.oturumKaydet(anahtar);
      s.kayitli = await anahtarMi(o.oturumGetir());
      await o.oturumSil();
      s.silindi = await o.oturumGetir();
      return s;
    }""")
    assert sonuc == {
        'sinirdanOnce': True, 'sinirda': None, 'sonraSilinmis': None, 'ileriTarihli': None,
        'anahtarDegil': None, 'zamanMetin': None, 'bosKayit': None,
        'disariVerilebilirReddedilir': True, 'reddedilenYazilmadi': None,
        'kayitli': True, 'silindi': None,
    }
    assert sayfa.evaluate(KAYIT_OKU) is None


def test_parola_degisince_oturum_silinir(sayfa, giris_yap, anahtar_dosyasi, kutu_uret):
    giris_yap()
    anahtar_dosyasi.metin = kutu_uret('yeni-deneme-parolasi-34', TOKEN)  # parola değiştirildi
    sayfa.reload()
    expect(parola_kutusu(sayfa)).to_be_visible()
    ana_ekran_yok(sayfa)
    assert sayfa.evaluate(KAYIT_OKU) is None
    parolayla_dene(sayfa, 'yeni-deneme-parolasi-34')
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')


def test_anahtar_dosyasi_yok(sayfa, ac, anahtar_dosyasi, deneme_kutusu):
    anahtar_dosyasi.metin = None  # 404
    ac()
    expect(sayfa.get_by_text(DEPO_YOK, exact=True)).to_be_visible()
    expect(parola_kutusu(sayfa)).to_have_count(0)
    anahtar_dosyasi.metin = deneme_kutusu
    sayfa.get_by_role('button', name='Tekrar dene').click()
    expect(parola_kutusu(sayfa)).to_be_visible()


def test_anahtar_dosyasi_bozuk(sayfa, ac, anahtar_dosyasi):
    anahtar_dosyasi.metin = '{"surum": 2}'
    ac()
    expect(sayfa.get_by_text(DEPO_YOK, exact=True)).to_be_visible()
    expect(parola_kutusu(sayfa)).to_have_count(0)


def test_anahtar_dosyasi_onbelleksiz(sayfa, ac):
    # page.route HTTP önbelleğini kapatır; bu yüzden fetch'e verilen seçenek doğrudan izlenir.
    sayfa.add_init_script("""(() => {
      const asil = window.fetch;
      window.__anahtarIstekleri = [];
      window.fetch = function (adres, secenek) {
        if (String(adres).includes('anahtar.json')) window.__anahtarIstekleri.push(secenek?.cache ?? null);
        return asil.apply(this, arguments);
      };
    })()""")
    ac()
    expect(parola_kutusu(sayfa)).to_be_visible()
    assert sayfa.evaluate('window.__anahtarIstekleri') == ['no-store']


def test_oturumla_acilista_hata_tekrar_dene(sayfa, giris_yap, sahte_github):
    giris_yap()
    sahte_github.depo_durumu = 401
    sayfa.reload()
    expect(sayfa.get_by_text(YETKI, exact=True)).to_be_visible()
    ana_ekran_yok(sayfa)
    assert sayfa.evaluate(KAYIT_OKU) is not None  # oturum sessizce silinmez
    sahte_github.depo_durumu = None
    sayfa.get_by_role('button', name='Tekrar dene').click()
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')


def test_enter_ile_giris(sayfa, ac):
    ac()
    parola_kutusu(sayfa).fill(PAROLA)
    parola_kutusu(sayfa).press('Enter')
    expect(sekme(sayfa, 'cizelge')).to_have_attribute('aria-current', 'page')
    # odak ekran alanına geçer; klavyeyle girilse de ekranın çevresinde odak halkası çizilmez
    assert sayfa.evaluate("document.activeElement.classList.contains('ekran')")
    assert sayfa.evaluate("getComputedStyle(document.querySelector('.ekran')).outlineStyle") == 'none'


def test_sekmeler_arasi_gecis(sayfa, giris_yap):
    giris_yap()
    baslik = sayfa.get_by_role('heading', name=bu_ay(), exact=True)
    sekme(sayfa, 'ayarlar').click()
    expect(sekme(sayfa, 'ayarlar')).to_have_attribute('aria-current', 'page')
    expect(sekme(sayfa, 'cizelge')).not_to_have_attribute('aria-current', 'page')
    expect(sayfa.get_by_role('button', name='Çıkış')).to_be_visible()
    expect(baslik).to_have_count(0)
    sekme(sayfa, 'toplamlar').click()
    expect(sekme(sayfa, 'toplamlar')).to_have_attribute('aria-current', 'page')
    expect(sayfa.get_by_role('button', name='Çıkış')).to_have_count(0)
    sekme(sayfa, 'cizelge').click()
    expect(baslik).to_be_visible()


def test_bildirim_2_8_saniye(sayfa, ac):
    sayfa.clock.install()
    ac()
    expect(parola_kutusu(sayfa)).to_be_visible()
    # Saat durdurulur: zamanlayıcılar yalnız run_for ile ilerler (bekleme süresince kendiliğinden değil).
    sayfa.clock.pause_at(sayfa.evaluate('Date.now()') + 1000)
    sayfa.evaluate("import('./uygulama/baslat.js').then((m) => m.bildir('Kaydedildi'))")
    bildirim = sayfa.locator('.bildirim')  # gizlenince erişilebilirlik ağacından çıkar
    expect(bildirim).to_have_attribute('role', 'status')
    expect(bildirim).to_have_text('Kaydedildi')
    expect(bildirim).to_be_visible()
    expect(bildirim).to_have_class(re.compile(r'\bgorunur\b'))
    sayfa.clock.run_for(2799)
    expect(bildirim).to_have_class(re.compile(r'\bgorunur\b'))
    sayfa.clock.run_for(1)
    expect(bildirim).not_to_have_class(re.compile(r'\bgorunur\b'))


def test_390_genislikte_tasma_yok(sayfa, ac, giris_yap):
    """Yatay kaydırma yok; giriş ve ana ekranın açık/koyu ekran görüntüleri cikti/ altına."""
    CIKTI.mkdir(exist_ok=True)
    genislik = 'document.documentElement.scrollWidth'
    ac()
    expect(parola_kutusu(sayfa)).to_be_visible()
    assert sayfa.evaluate(genislik) <= GORUNUM['width']
    sayfa.screenshot(path=CIKTI / 'giris-390.png')
    sayfa.emulate_media(color_scheme='dark')
    sayfa.screenshot(path=CIKTI / 'giris-390-koyu.png')
    sayfa.emulate_media(color_scheme='light')
    giris_yap()
    expect(sayfa.get_by_role('heading', name=bu_ay(), exact=True)).to_be_visible()
    assert sayfa.evaluate(genislik) <= GORUNUM['width']
    sayfa.screenshot(path=CIKTI / 'kabuk-390.png')
    sayfa.emulate_media(color_scheme='dark')
    sayfa.screenshot(path=CIKTI / 'kabuk-390-koyu.png')
