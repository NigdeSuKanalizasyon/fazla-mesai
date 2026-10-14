"""Bakım araçları (Görev 11): araclar/kurulum.html ve araclar/parola-degistir.html.

Araçlar ES modülü içe aktarır; bu yüzden testte de http üzerinden (yerel sunucu) açılır.
Veri dosyaları testte Node yardımcısıyla (testler/yardimci/veri-islem.mjs) şifrelenir/çözülür.
"""
import json
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import expect

from conftest import KOK, PAROLA, TOKEN

ESKI = PAROLA
YENI = 'yeni-parola-denemesi-34'
KURULUM = 'araclar/kurulum.html'
PAROLA_DEGISTIR = 'araclar/parola-degistir.html'

# Uydurma ad ve kayıtlar
VERI = {
    'calisanlar.json': {'calisanlar': [
        {'id': 'c_ali00001', 'ad': 'Ali Veli', 'aktif': True},
        {'id': 'c_cagri002', 'ad': 'Çağrı Işık', 'aktif': True},
        {'id': 'c_sule0003', 'ad': 'Şule Öztürk', 'aktif': False},
    ]},
    'ayarlar.json': {'bolumYazisi': 'Deneme Bölümü',
                     'imza': {'bolumAmiri': 'Ali Veli', 'puantor': 'Çağrı Işık', 'bolumMuduru': 'Şule Öztürk'}},
    'mesai/2026-09.json': {'satirlar': [
        {'id': 's_aaaa0001', 'tarih': '2026-09-12', 'calisanId': 'c_ali00001',
         'neden': 'Ana hat arızası', 'baslama': '14:00', 'bitis': '19:40'},
        {'id': 's_aaaa0002', 'tarih': '2026-09-13', 'calisanId': 'c_cagri002',
         'neden': 'Pompa değişimi', 'baslama': None, 'bitis': None},
    ]},
    'mesai/2026-10.json': {'satirlar': [
        {'id': 's_bbbb0001', 'tarih': '2026-10-03', 'calisanId': 'c_sule0003',
         'neden': 'Vana bakımı', 'baslama': '09:00', 'bitis': '12:30'},
    ]},
}


def veri_islem(komut, parola, kutu_metni, dosyalar):
    sonuc = subprocess.run(
        ['node', 'testler/yardimci/veri-islem.mjs', komut, parola], cwd=KOK, check=True,
        input=json.dumps({'kutu': json.loads(kutu_metni), 'dosyalar': dosyalar}),
        capture_output=True, text=True)
    return json.loads(sonuc.stdout)


def depoya_koy(sahte_github, kutu_metni, veri=VERI, parola=ESKI):
    """Veriyi eski parolayla şifreleyip sahte veri deposuna koyar; { yol: şifreli metin } döner."""
    sifreli = veri_islem('sifrele', parola, kutu_metni, veri)
    for yol, metin in sifreli.items():
        sahte_github.dosyalar[yol] = {'icerik': metin, 'sha': None}
    return sifreli


def depodaki(sahte_github):
    return {yol: kayit['icerik'] for yol, kayit in sahte_github.dosyalar.items()}


def yazislar(sahte_github):
    return [i for i in sahte_github.istekler if i['yontem'] == 'PUT']


def indirmeleri_say(sayfa):
    liste = []
    sayfa.on('download', lambda d: liste.append(d))
    return liste


# --- kurulum.html ------------------------------------------------------------

def kurulumu_doldur(sayfa, token=TOKEN, parola=YENI, tekrar=None):
    sayfa.get_by_label('GitHub token', exact=True).fill(token)
    sayfa.get_by_label('Parola', exact=True).fill(parola)
    sayfa.get_by_label('Parola (tekrar)', exact=True).fill(parola if tekrar is None else tekrar)


def olustur(sayfa):
    sayfa.get_by_role('button', name='Oluştur', exact=True).click()


def test_kurulum_kisa_parola(sayfa, adres):
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + KURULUM)
    kurulumu_doldur(sayfa, parola='abcdefghijk')  # 11 karakter
    olustur(sayfa)
    expect(sayfa.get_by_text('Parola en az 12 karakter olmalı.', exact=True)).to_be_visible()
    sayfa.wait_for_timeout(300)
    assert indirmeler == []


def test_kurulum_parolalar_ayni_degil(sayfa, adres):
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + KURULUM)
    kurulumu_doldur(sayfa, parola='abcdefghijkl1', tekrar='abcdefghijkl2')
    olustur(sayfa)
    expect(sayfa.get_by_text('Parolalar aynı değil.', exact=True)).to_be_visible()
    sayfa.wait_for_timeout(300)
    assert indirmeler == []


def test_kurulum_bos_token(sayfa, adres):
    sayfa.goto(adres + KURULUM)
    kurulumu_doldur(sayfa, token='   ')
    olustur(sayfa)
    expect(sayfa.get_by_text('GitHub token boş olamaz.', exact=True)).to_be_visible()


def test_kurulum_dosya_calisir(sayfa, adres, anahtar_dosyasi, sahte_github):
    sayfa.goto(adres + KURULUM)
    kurulumu_doldur(sayfa, parola='abcdefghijkl')  # tam 12 karakter kabul edilir
    with sayfa.expect_download() as indirme:
        olustur(sayfa)
    assert indirme.value.suggested_filename == 'anahtar.json'
    metin = Path(indirme.value.path()).read_text(encoding='utf-8')
    kutu = json.loads(metin)
    assert set(kutu) == {'surum', 'tuz', 'tekrar', 'iv', 'veri'}
    assert kutu['surum'] == 1 and kutu['tekrar'] == 600000
    assert TOKEN not in metin and 'abcdefghijkl' not in metin  # yalnızca şifreli
    expect(sayfa.get_by_text('anahtar.json indirildi.', exact=False)).to_be_visible()
    # Alanlar temizlenir: parola sayfada kalmaz
    expect(sayfa.get_by_label('Parola', exact=True)).to_have_value('')

    # Uygulamaya bu dosyayla, bu parolayla girilir (token doğru çözülür: sahte GitHub 401 vermez)
    anahtar_dosyasi.metin = metin
    sayfa.goto(adres)
    sayfa.get_by_label('Parola', exact=True).fill('abcdefghijkl')
    sayfa.get_by_role('button', name='Giriş yap').click()
    expect(sayfa.locator('nav.sekmeler')).to_be_visible()
    assert any(i['yol'] == '' and i['yontem'] == 'GET' for i in sahte_github.istekler)


def test_kurulum_internete_baglanmaz(sayfa, adres, sahte_github, anahtar_dosyasi):
    istekler = []
    sayfa.on('request', lambda r: istekler.append((r.method, r.url, r.post_data or '')))
    sayfa.goto(adres + KURULUM)
    kurulumu_doldur(sayfa)
    with sayfa.expect_download():
        olustur(sayfa)
    assert istekler, 'sayfanın kendisi yüklenmiş olmalı'
    for yontem, url, govde in istekler:
        assert yontem == 'GET' and url.startswith(adres), (yontem, url)  # yalnızca kendi dosyaları
        assert TOKEN not in url + govde and YENI not in url + govde
    assert not any('anahtar.json' in url for _, url, _ in istekler)
    assert sahte_github.istekler == [] and anahtar_dosyasi.istekler == []


def test_kurulum_sayfa_uyarisi_ve_form_kendiliginden_gonderilmez(sayfa, adres):
    sayfa.goto(adres + KURULUM)
    expect(sayfa.get_by_text('çift tıklayarak açılmaz', exact=False).first).to_be_visible()
    # Enter ile gönderim sayfayı yenilemez/adrese parola yazmaz
    kurulumu_doldur(sayfa, parola='abcdefghijk')
    sayfa.get_by_label('Parola (tekrar)', exact=True).press('Enter')
    expect(sayfa.get_by_text('Parola en az 12 karakter olmalı.', exact=True)).to_be_visible()
    assert sayfa.url == adres + KURULUM


def test_kurulum_token_yenileme_kayitlar_acik_kalir(sayfa, adres, anahtar_dosyasi, sahte_github, tmp_path):
    """Token yenilenirken tuz ve tekrar korunur: aynı parola, kayıtlar yeni kutuyla da açılır."""
    eski_kutu = anahtar_dosyasi.metin
    sifreli = depoya_koy(sahte_github, eski_kutu)
    dosya = tmp_path / 'anahtar.json'
    dosya.write_text(eski_kutu, encoding='utf-8')
    sayfa.goto(adres + KURULUM)
    sayfa.locator('input[type=file]').set_input_files(str(dosya))
    kurulumu_doldur(sayfa, token='github_pat_yeni_token_9876543210', parola=ESKI)
    with sayfa.expect_download(timeout=60000) as indirme:
        olustur(sayfa)
    yeni_metin = Path(indirme.value.path()).read_text(encoding='utf-8')
    yeni, eski = json.loads(yeni_metin), json.loads(eski_kutu)
    assert yeni['tuz'] == eski['tuz'] and yeni['tekrar'] == eski['tekrar']  # aynı anahtar
    assert yeni['veri'] != eski['veri'] and yeni['iv'] != eski['iv']  # yeni token, yeni iv
    assert veri_islem('coz', ESKI, yeni_metin, sifreli) == VERI  # kayıtlar hâlâ açılıyor
    expect(sayfa.get_by_text('aynı parola, yeni token', exact=False)).to_be_visible()


def test_kurulum_token_yenileme_yanlis_parola_dosya_vermez(sayfa, adres, anahtar_dosyasi, tmp_path):
    dosya = tmp_path / 'anahtar.json'
    dosya.write_text(anahtar_dosyasi.metin, encoding='utf-8')
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + KURULUM)
    sayfa.locator('input[type=file]').set_input_files(str(dosya))
    kurulumu_doldur(sayfa, parola='baska-bir-parola-12')  # kayıtların parolası değil
    olustur(sayfa)
    expect(sayfa.get_by_text('Parola bu anahtar.json dosyasına uymuyor.', exact=True)).to_be_visible()
    sayfa.wait_for_timeout(300)
    assert indirmeler == []  # sessizce yeni tuz üretilip kayıtlar erişilmez kılınmaz


def test_kurulum_gecersiz_mevcut_dosya_yeni_tuz_uretmez(sayfa, adres, tmp_path):
    dosya = tmp_path / 'anahtar.json'
    dosya.write_text('bu bir anahtar değil', encoding='utf-8')
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + KURULUM)
    sayfa.locator('input[type=file]').set_input_files(str(dosya))
    expect(sayfa.get_by_text('Seçilen dosya geçerli bir anahtar.json değil.', exact=True)).to_be_visible()
    kurulumu_doldur(sayfa)
    olustur(sayfa)
    sayfa.wait_for_timeout(300)
    assert indirmeler == []
    expect(sayfa.get_by_text('Seçilen dosya geçerli bir anahtar.json değil.', exact=True)).to_be_visible()


# --- parola-degistir.html ----------------------------------------------------

def degistir_doldur(sayfa, eski=ESKI, yeni=YENI, tekrar=None):
    sayfa.get_by_label('Eski parola', exact=True).fill(eski)
    sayfa.get_by_label('Yeni parola', exact=True).fill(yeni)
    sayfa.get_by_label('Yeni parola (tekrar)', exact=True).fill(yeni if tekrar is None else tekrar)


def degistir(sayfa):
    sayfa.get_by_role('button', name='Parolayı değiştir', exact=True).click()


def test_parola_degistir(sayfa, ac, adres, anahtar_dosyasi, sahte_github):
    eski_kutu = anahtar_dosyasi.metin
    once = depoya_koy(sahte_github, eski_kutu)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa)
    with sayfa.expect_download(timeout=60000) as indirme:
        degistir(sayfa)
    assert indirme.value.suggested_filename == 'anahtar.json'
    yeni_kutu = Path(indirme.value.path()).read_text(encoding='utf-8')
    expect(sayfa.get_by_text('4 dosya yeni parolayla şifrelendi.', exact=False)).to_be_visible()

    yeni, eski = json.loads(yeni_kutu), json.loads(eski_kutu)
    assert yeni['tekrar'] == 600000 and yeni['tuz'] != eski['tuz']
    sonra = depodaki(sahte_github)
    assert set(sonra) == set(once)
    assert all(sonra[yol] != once[yol] for yol in once)  # hepsi yeniden şifrelendi (yeni tuz, yeni iv)
    # Yeni parola açar, satırlar aynı; eski parola artık açmaz
    assert veri_islem('coz', YENI, yeni_kutu, sonra) == VERI
    with pytest.raises(subprocess.CalledProcessError):
        veri_islem('coz', ESKI, yeni_kutu, sonra)
    assert len(yazislar(sahte_github)) == 4

    # Uygulamanın kendisi de: eski parola "Parola yanlış.", yeni parola içeri alır
    anahtar_dosyasi.metin = yeni_kutu
    ac()
    sayfa.get_by_label('Parola', exact=True).fill(ESKI)
    sayfa.get_by_role('button', name='Giriş yap').click()
    expect(sayfa.get_by_text('Parola yanlış.', exact=True)).to_be_visible()
    sayfa.get_by_label('Parola', exact=True).fill(YENI)
    sayfa.get_by_role('button', name='Giriş yap').click()
    expect(sayfa.locator('nav.sekmeler')).to_be_visible()


def test_parola_degistir_ilerleme_ve_ozet(sayfa, adres, anahtar_dosyasi, sahte_github):
    depoya_koy(sahte_github, anahtar_dosyasi.metin)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa)
    with sayfa.expect_download(timeout=60000):
        degistir(sayfa)
    ilerleme = sayfa.locator('#ilerleme')
    for yol in VERI:
        expect(ilerleme).to_contain_text(yol)
    expect(sayfa.get_by_text('anahtar.json indirildi.', exact=False)).to_be_visible()
    expect(sayfa.get_by_role('button', name='anahtar.json dosyasını yeniden indir')).to_be_visible()


def test_parola_degistir_bozuk_dosya_hicbir_sey_yazmaz(sayfa, adres, anahtar_dosyasi, sahte_github):
    depoya_koy(sahte_github, anahtar_dosyasi.metin)
    sahte_github.dosyalar['mesai/2026-10.json']['icerik'] = '{"surum":1,"iv":"AAAAAAAAAAAAAAAA","veri":"AAAA"}'
    oncesi = depodaki(sahte_github)
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa)
    degistir(sayfa)
    expect(sayfa.get_by_text('mesai/2026-10.json', exact=False).last).to_be_visible()
    expect(sayfa.get_by_text('Hiçbir dosya değiştirilmedi.', exact=False)).to_be_visible()
    sayfa.wait_for_timeout(300)
    assert yazislar(sahte_github) == []
    assert depodaki(sahte_github) == oncesi
    assert indirmeler == []


def test_parola_degistir_yanlis_eski_parola(sayfa, adres, anahtar_dosyasi, sahte_github):
    depoya_koy(sahte_github, anahtar_dosyasi.metin)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa, eski='yanlis-parola-12')
    degistir(sayfa)
    expect(sayfa.get_by_text('Eski parola yanlış.', exact=True)).to_be_visible()
    assert sahte_github.istekler == []  # token çözülemedi, GitHub'a hiç gidilmedi


@pytest.mark.parametrize('eski,yeni,tekrar,mesaj', [
    (ESKI, 'kisa-12345', None, 'Yeni parola en az 12 karakter olmalı.'),
    (ESKI, YENI, YENI + 'x', 'Parolalar aynı değil.'),
    (ESKI, ESKI, None, 'Yeni parola eskisiyle aynı olamaz.'),
])
def test_parola_degistir_dogrulama(sayfa, adres, sahte_github, eski, yeni, tekrar, mesaj):
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa, eski=eski, yeni=yeni, tekrar=tekrar)
    degistir(sayfa)
    expect(sayfa.get_by_text(mesaj, exact=True)).to_be_visible()
    sayfa.wait_for_timeout(200)
    assert sahte_github.istekler == [] and indirmeler == []


def yazma_kesici(sayfa, sahte_github, basarisiz_yazislar):
    """n'inci PUT'lar (1'den) 500 döner; diğer her şey sahte GitHub'a gider."""
    sayac = {'put': 0}

    def isle(route):
        if route.request.method == 'PUT':
            sayac['put'] += 1
            if sayac['put'] in basarisiz_yazislar:
                route.fulfill(status=500, content_type='application/json', body='{"message":"Sahte hata"}')
                return
        sahte_github(route)

    sayfa.route('https://api.github.com/**', isle)


def test_parola_degistir_yazma_yarida_kalirsa_geri_alir(sayfa, adres, anahtar_dosyasi, sahte_github):
    once = depoya_koy(sahte_github, anahtar_dosyasi.metin)
    yazma_kesici(sayfa, sahte_github, {3})  # üçüncü dosya yazılamaz
    indirmeler = indirmeleri_say(sayfa)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa)
    degistir(sayfa)
    expect(sayfa.get_by_text('Eski hâline döndürüldü.', exact=False)).to_be_visible(timeout=60000)
    assert depodaki(sahte_github) == once  # her dosya baştaki içeriğe döndü
    assert indirmeler == []  # yeni anahtar.json verilmez; eskisi geçerli kalır


def test_parola_degistir_geri_alma_da_olmazsa_yonlendirir(sayfa, adres, anahtar_dosyasi, sahte_github):
    depoya_koy(sahte_github, anahtar_dosyasi.metin)
    yazma_kesici(sayfa, sahte_github, {2, 3, 4, 5, 6})  # ikinci yazıştan sonra hepsi hata
    sayfa.goto(adres + PAROLA_DEGISTIR)
    degistir_doldur(sayfa)
    degistir(sayfa)
    expect(sayfa.get_by_text('geri-getir', exact=False).first).to_be_visible(timeout=60000)
    expect(sayfa.get_by_text('Eski hâline döndürüldü.', exact=False)).to_have_count(0)


def test_parola_degistir_anahtar_okunamazsa_dosya_secilir(sayfa, adres, anahtar_dosyasi, sahte_github, tmp_path):
    eski_kutu = anahtar_dosyasi.metin
    depoya_koy(sahte_github, eski_kutu)
    anahtar_dosyasi.metin = None  # veri/anahtar.json 404
    sayfa.goto(adres + PAROLA_DEGISTIR)
    expect(sayfa.get_by_text('veri/anahtar.json okunamadı', exact=False)).to_be_visible()
    dosya = tmp_path / 'anahtar.json'
    dosya.write_text(eski_kutu, encoding='utf-8')
    sayfa.locator('input[type=file]').set_input_files(str(dosya))
    degistir_doldur(sayfa)
    with sayfa.expect_download(timeout=60000):
        degistir(sayfa)
    expect(sayfa.get_by_text('4 dosya yeni parolayla şifrelendi.', exact=False)).to_be_visible()


def test_parola_degistir_bos_depo_yine_de_yeni_anahtar_verir(sayfa, adres, anahtar_dosyasi, sahte_github):
    sayfa.goto(adres + PAROLA_DEGISTIR)  # veri deposunda hiç dosya yok
    degistir_doldur(sayfa)
    with sayfa.expect_download(timeout=60000) as indirme:
        degistir(sayfa)
    expect(sayfa.get_by_text('0 dosya yeni parolayla şifrelendi.', exact=False)).to_be_visible()
    yeni_kutu = Path(indirme.value.path()).read_text(encoding='utf-8')
    assert yazislar(sahte_github) == []
    assert json.loads(yeni_kutu)['tekrar'] == 600000


def test_parola_degistir_sayfa_uyarisi_ve_dis_istek_yok(sayfa, adres, anahtar_dosyasi, sahte_github):
    istekler = []
    sayfa.on('request', lambda r: istekler.append(r.url))
    depoya_koy(sahte_github, anahtar_dosyasi.metin)
    sayfa.goto(adres + PAROLA_DEGISTIR)
    expect(sayfa.get_by_text('çift tıklayarak açılmaz', exact=False).first).to_be_visible()
    degistir_doldur(sayfa)
    with sayfa.expect_download(timeout=60000):
        degistir(sayfa)
    dis = [u for u in istekler if not u.startswith(adres) and not u.startswith('https://api.github.com/repos/NigdeSuKanalizasyon/fazla-mesai-veri')]
    assert dis == []
