"""Toplamlar, Çalışanlar ve Ayarlar ekranları (Görev 10).

Saat her testte sabitlenir (page.clock.set_fixed_time): içinde bulunulan ay testin çalıştığı günden
bağımsızdır. Zamanlayıcılar gerçek zamanla işler.
"""
import pytest
from playwright.sync_api import expect

from conftest import CIKTI, GORUNUM

SIMDI = '2026-10-16T21:00:00+03:00'  # cuma, İstanbul 21:00

CALISANLAR = {'calisanlar': [
    {'id': 'c_ali', 'ad': 'Ali Veli', 'aktif': True},
    {'id': 'c_cagri', 'ad': 'Çağrı Işık', 'aktif': True},
    {'id': 'c_sule', 'ad': 'Şule Öztürk', 'aktif': False},
]}

BOS_AY = 'Bu ay için kayıt yok.'
AYNI_AD = 'Bu adda bir çalışan zaten var.'
YETKI = "GitHub anahtarının süresi dolmuş. Anıl'a haber verin."
ERISIM = "GitHub'a şu an ulaşılamıyor. Birkaç dakika sonra tekrar deneyin."


def satir(kimlik, tarih, calisan='c_ali', neden='Pompa arızası', baslama='17:00', bitis='19:40'):
    return {'id': kimlik, 'tarih': tarih, 'calisanId': calisan, 'neden': neden,
            'baslama': baslama, 'bitis': bitis}


# 14.10.2026 çarşamba, 03.10.2026 cumartesi, 11.10.2026 pazar
EKIM = [
    satir('s_1', '2026-10-14'),  # 17:00-19:40 çarşamba: 18:00'den sonrası = 1 saat 40 dakika
    satir('s_2', '2026-10-11', neden='Vardiya desteği', baslama=None, bitis=None),  # pazar
    satir('s_3', '2026-10-03', calisan='c_cagri', neden='Vana değişimi', baslama='08:00', bitis='11:30'),
]


@pytest.fixture
def hazirla(sayfa, kayit_yaz, giris_yap):
    """Saati sabitler, çalışanları ve verilen ayların satırlarını yazar, girer."""
    def hazirla(aylar=None, calisanlar=CALISANLAR, ayarlar=None):
        sayfa.clock.set_fixed_time(SIMDI)
        dosyalar = {'calisanlar.json': calisanlar}
        if ayarlar is not None:
            dosyalar['ayarlar.json'] = ayarlar
        for ay, satirlar in (aylar or {}).items():
            dosyalar[f'mesai/{ay}.json'] = {'satirlar': satirlar}
        kayit_yaz(dosyalar)
        giris_yap()
        return sayfa
    return hazirla


def sekme(sayfa, kimlik):
    return sayfa.locator(f'nav.sekmeler [data-sekme="{kimlik}"]')


def sekmeye_git(sayfa, kimlik):
    sekme(sayfa, kimlik).click()
    expect(sekme(sayfa, kimlik)).to_have_attribute('aria-current', 'page')
    ekran = sayfa.locator(f'.ekran-icerik[data-ekran="{kimlik}"]')
    expect(ekran).to_have_count(1)
    return ekran


def yazislar(sahte_github):
    return [i for i in sahte_github.istekler if i['yontem'] == 'PUT']


def bildirim(sayfa):
    return sayfa.locator('.bildirim')


def adlar(sayfa):
    return sayfa.locator('.calisan-satir .calisan-ad')


def satir_kutusu(sayfa, kimlik):
    return sayfa.locator(f'.calisan-satir[data-calisan="{kimlik}"]')


def calisan_ekle_ac(sayfa):
    sayfa.get_by_role('button', name='Çalışan ekle', exact=True).click()
    pencere = sayfa.get_by_role('dialog', name='Çalışan ekle')
    expect(pencere).to_be_visible()
    return pencere


def ayarlar_yuklendi(sayfa):
    expect(sayfa.get_by_label('Bölümü sütunu', exact=True)).to_be_enabled()


# --- Toplamlar -----------------------------------------------------------------

def test_toplamlar(hazirla, sayfa):
    hazirla({'2026-10': EKIM})
    sekmeye_git(sayfa, 'toplamlar')
    satirlar = sayfa.locator('.toplam-satir')
    expect(satirlar).to_have_count(2)  # kaydı olmayan Şule Öztürk listede yok
    expect(satirlar.nth(0)).to_have_text('Ali Veli — 1 saat 40 dakika + 1 pazar')
    expect(satirlar.nth(1)).to_have_text('Çağrı Işık — 3 saat 30 dakika')  # cumartesi: tamamı, pazar yok
    expect(sayfa.get_by_text('Şule Öztürk')).to_have_count(0)
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_have_count(0)
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()


def test_toplamlar_bos_ay_ve_ay_degisimi(hazirla, sayfa):
    hazirla({'2026-10': EKIM})
    sekmeye_git(sayfa, 'toplamlar')
    expect(sayfa.locator('.toplam-satir')).to_have_count(2)
    ileri = sayfa.get_by_role('button', name='Sonraki ay')
    expect(ileri).to_be_disabled()  # içinde bulunulan aydan ileri yok
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('heading', name='Eylül 2026', exact=True)).to_be_visible()
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()
    expect(sayfa.locator('.toplam-satir')).to_have_count(0)
    ileri.click()
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(sayfa.locator('.toplam-satir')).to_have_count(2)
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_have_count(0)


def test_toplamlar_pasif_calisanin_kaydi_gorunur(hazirla, sayfa):
    hazirla({'2026-10': [satir('s_1', '2026-10-14', calisan='c_sule', baslama='18:00', bitis='20:00')]})
    sekmeye_git(sayfa, 'toplamlar')
    expect(sayfa.locator('.toplam-satir')).to_have_text(['Şule Öztürk — 2 saat'])


def test_toplamlar_bozuk_ay(hazirla, sayfa, kayit_yaz):
    hazirla()
    kayit_yaz({'mesai/2026-09.json': '{"surum": 1, "iv": "AAAA", "veri": "AAAA"}'})
    sekmeye_git(sayfa, 'toplamlar')
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('alert').filter(has_text='Bu ayın kaydı açılamadı.')).to_be_visible()
    sayfa.get_by_role('button', name='Sonraki ay').click()  # ay çubuğu çalışmaya devam eder
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()


def test_ayni_ay_sekmeler_arasi(hazirla, sayfa):
    hazirla({'2026-10': EKIM})
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('heading', name='Eylül 2026', exact=True)).to_be_visible()
    sekmeye_git(sayfa, 'toplamlar')
    expect(sayfa.get_by_role('heading', name='Eylül 2026', exact=True)).to_be_visible()
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()
    sayfa.get_by_role('button', name='Sonraki ay').click()  # Toplamlar'da ileri gidince çizelge de ileri gider
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    sekmeye_git(sayfa, 'calisanlar')
    sekmeye_git(sayfa, 'cizelge')
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(sayfa.locator('[data-satir]')).to_have_count(3)


# --- Çalışanlar ----------------------------------------------------------------

def test_calisanlar_liste_sirasi(hazirla, sayfa):
    hazirla(calisanlar={'calisanlar': [
        {'id': 'c_1', 'ad': 'Şule Öztürk', 'aktif': False},
        {'id': 'c_2', 'ad': 'Çağrı Işık', 'aktif': True},
        {'id': 'c_3', 'ad': 'Ali Veli', 'aktif': True},
        {'id': 'c_4', 'ad': 'Zeynep Çelik', 'aktif': False},
    ]})
    sekmeye_git(sayfa, 'calisanlar')
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Işık', 'Şule Öztürk', 'Zeynep Çelik'])  # aktifler üstte
    expect(sayfa.locator('.calisan-satir .etiket-pasif')).to_have_text(['Pasif', 'Pasif'])
    expect(satir_kutusu(sayfa, 'c_1').get_by_text('Pasif', exact=True)).to_be_visible()
    expect(satir_kutusu(sayfa, 'c_3').get_by_text('Pasif', exact=True)).to_have_count(0)
    expect(satir_kutusu(sayfa, 'c_3').get_by_role('button', name='Pasife al', exact=True)).to_be_visible()
    expect(satir_kutusu(sayfa, 'c_3').get_by_role('button', name='Adını düzelt', exact=True)).to_be_visible()
    expect(satir_kutusu(sayfa, 'c_1').get_by_role('button', name='Aktif yap', exact=True)).to_be_visible()
    expect(satir_kutusu(sayfa, 'c_1').get_by_role('button', name='Pasife al')).to_have_count(0)
    assert satir_kutusu(sayfa, 'c_1').evaluate("(e) => e.classList.contains('calisan-pasif')")
    assert not satir_kutusu(sayfa, 'c_3').evaluate("(e) => e.classList.contains('calisan-pasif')")


def test_calisan_ekle(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    expect(adlar(sayfa)).to_have_count(3)
    pencere = calisan_ekle_ac(sayfa)
    kutu = pencere.get_by_label('Ad soyad', exact=True)
    expect(kutu).to_be_focused()
    kutu.fill('  Mehmet Kaya  ')
    pencere.get_by_role('button', name='Ekle', exact=True).click()

    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Işık', 'Mehmet Kaya', 'Şule Öztürk'])
    [yeni] = [c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['ad'] == 'Mehmet Kaya']  # kırpıldı
    assert yeni['aktif'] is True and yeni['id'].startswith('c_')
    assert len(yazislar(sahte_github)) == 1
    # yeni çalışan Mesai ekle formunda seçilebilir
    sekmeye_git(sayfa, 'cizelge')
    sayfa.get_by_role('button', name='Mesai ekle').click()
    expect(sayfa.get_by_role('dialog', name='Mesai ekle').get_by_label('Mehmet Kaya')).to_be_visible()


def test_calisan_ekle_ayni_ad(hazirla, sayfa, sahte_github):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('ali veli')
    pencere.get_by_role('button', name='Ekle', exact=True).click()

    expect(pencere.get_by_text(AYNI_AD, exact=True)).to_be_visible()
    expect(pencere).to_be_visible()  # pencere açık kalır, ad durur
    expect(pencere.get_by_label('Ad soyad', exact=True)).to_have_value('ali veli')
    expect(pencere.get_by_label('Ad soyad', exact=True)).to_have_attribute('aria-invalid', 'true')
    expect(pencere.get_by_label('Ad soyad', exact=True)).to_be_focused()
    assert yazislar(sahte_github) == []
    expect(adlar(sayfa)).to_have_count(3)

    pencere.get_by_label('Ad soyad', exact=True).fill('Ali Veli Kaya')  # yazınca uyarı kalkar
    expect(pencere.get_by_text(AYNI_AD, exact=True)).to_have_count(0)
    expect(pencere.get_by_label('Ad soyad', exact=True)).not_to_have_attribute('aria-invalid', 'true')


@pytest.mark.parametrize('yazilan', ['  ALİ VELİ ', 'çağrı ışık', 'ÇAĞRI IŞIK', 'şule öztürk'])
def test_calisan_ekle_turkce_harf_ve_pasif(hazirla, sayfa, sahte_github, yazilan):
    """Karşılaştırma toLocaleLowerCase('tr') ile: I/ı ve İ/i Türkçe eşleşir; pasif çalışan da sayılır."""
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill(yazilan)
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere.get_by_text(AYNI_AD, exact=True)).to_be_visible()
    assert yazislar(sahte_github) == []


def test_calisan_ekle_bos_ad(hazirla, sayfa, sahte_github):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('   ')
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere.get_by_text('Ad soyadı yazın.', exact=True)).to_be_visible()
    assert yazislar(sahte_github) == []
    pencere.get_by_role('button', name='Vazgeç', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_count(3)


def test_calisan_ekle_kayit_401(hazirla, sayfa, sahte_github):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('Mehmet Kaya')
    sahte_github.yazma_durumu = 401
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere.get_by_text(YETKI, exact=True)).to_be_visible()
    expect(pencere.get_by_label('Ad soyad', exact=True)).to_have_value('Mehmet Kaya')
    expect(pencere.get_by_role('button', name='Ekle', exact=True)).to_be_enabled()
    expect(sayfa.get_by_label('Parola', exact=True)).to_have_count(0)  # giriş ekranına dönmedi

    sahte_github.yazma_durumu = None  # aynı düğmeyle tekrar
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_count(4)


def test_calisan_ekle_belirsiz_hata_sonrasi_kapaninca_liste_tazelenir(hazirla, sayfa, sahte_github, kayit_oku):
    """F1: yazış ulaştı ama yanıtı 500 döndü; Vazgeç'e basınca liste tazelenir, yeni çalışan görünür."""
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('Şule Işık')
    sahte_github.yazip_yanitla(500)
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere.get_by_text(ERISIM, exact=True)).to_be_visible()
    expect(adlar(sayfa)).to_have_count(3)  # liste henüz eski
    pencere.get_by_role('button', name='Vazgeç', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Işık', 'Şule Işık', 'Şule Öztürk'])
    assert len(kayit_oku('calisanlar.json')['calisanlar']) == 4


def bekleyenleri_bekle(sayfa, sahte_github, adet):
    """Bekletilen GitHub isteklerinin sayısı `adet`e ulaşana kadar bekler (en çok 5 sn)."""
    for _ in range(100):
        if sahte_github.bekleyen_sayisi >= adet:
            return
        sayfa.wait_for_timeout(50)
    raise AssertionError(f'{adet} istek bekleniyordu, {sahte_github.bekleyen_sayisi} geldi')


def test_calisan_eklerken_iki_kez_esc_ad_kaybolmaz(hazirla, sayfa, sahte_github, kayit_oku):
    """F4: kayıt sürerken iki Esc (Chrome'da ikincisi engellenemez) pencereyi sayfadan atmaz; yazış düşerse
    pencere yazılan adla yeniden açılır, hata pencerede yazar; aynı pencereden yeniden eklenir."""
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('Mehmet Kaya')
    sahte_github.tut()
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    bekleyenleri_bekle(sayfa, sahte_github, 1)  # taze çalışan listesi okunuyor
    sayfa.keyboard.press('Escape')
    sayfa.keyboard.press('Escape')
    sahte_github.yazma_durumu = 500
    sahte_github.birak()

    expect(pencere).to_be_visible()
    expect(pencere.get_by_text(ERISIM, exact=True)).to_be_visible()
    expect(pencere.get_by_label('Ad soyad', exact=True)).to_have_value('Mehmet Kaya')
    assert sayfa.locator('dialog').count() == 1  # tek pencere

    sahte_github.yazma_durumu = None
    pencere.get_by_role('button', name='Ekle', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_count(4)
    assert len([c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['ad'] == 'Mehmet Kaya']) == 1


def test_calisan_ekle_cift_tiklama_tek_kayit(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    pencere = calisan_ekle_ac(sayfa)
    pencere.get_by_label('Ad soyad', exact=True).fill('Mehmet Kaya')
    sahte_github.tut()
    pencere.get_by_role('button', name='Ekle', exact=True).dblclick()
    expect(pencere.get_by_role('button', name='Ekleniyor…', exact=True)).to_be_disabled()
    pencere.locator('form').evaluate('(f) => f.requestSubmit()')
    sayfa.wait_for_timeout(500)
    sahte_github.birak()
    expect(pencere).to_have_count(0)
    assert len([c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['ad'] == 'Mehmet Kaya']) == 1
    assert len(yazislar(sahte_github)) == 1


def test_calisan_ad_duzelt(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    satir_kutusu(sayfa, 'c_cagri').get_by_role('button', name='Adını düzelt', exact=True).click()
    pencere = sayfa.get_by_role('dialog', name='Adını düzelt')
    expect(pencere).to_be_visible()
    kutu = pencere.get_by_label('Ad soyad', exact=True)
    expect(kutu).to_have_value('Çağrı Işık')
    kutu.fill('Ali Veli')  # başkasının adı
    pencere.get_by_role('button', name='Kaydet', exact=True).click()
    expect(pencere.get_by_text(AYNI_AD, exact=True)).to_be_visible()
    assert yazislar(sahte_github) == []

    kutu.fill('Çağrı Yıldız')
    pencere.get_by_role('button', name='Kaydet', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Yıldız', 'Şule Öztürk'])
    kayit = {c['id']: c for c in kayit_oku('calisanlar.json')['calisanlar']}
    assert kayit['c_cagri'] == {'id': 'c_cagri', 'ad': 'Çağrı Yıldız', 'aktif': True}
    assert kayit['c_ali']['ad'] == 'Ali Veli' and kayit['c_sule']['aktif'] is False
    assert len(yazislar(sahte_github)) == 1


def test_calisan_ad_duzelt_kendi_adi_harf_degisimi(hazirla, sayfa, kayit_oku):
    """Çalışan kendi adıyla çakışmaz: yalnızca büyük/küçük harf düzeltilebilir."""
    hazirla(calisanlar={'calisanlar': [{'id': 'c_1', 'ad': 'ali veli', 'aktif': True}]})
    sekmeye_git(sayfa, 'calisanlar')
    satir_kutusu(sayfa, 'c_1').get_by_role('button', name='Adını düzelt', exact=True).click()
    pencere = sayfa.get_by_role('dialog', name='Adını düzelt')
    pencere.get_by_label('Ad soyad', exact=True).fill('Ali Veli')
    pencere.get_by_role('button', name='Kaydet', exact=True).click()
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_text(['Ali Veli'])
    assert kayit_oku('calisanlar.json')['calisanlar'][0]['ad'] == 'Ali Veli'


def test_pasif_formda_secilemez(hazirla, sayfa, kayit_oku):
    hazirla({'2026-10': [satir('s_1', '2026-10-14')]})
    sekmeye_git(sayfa, 'calisanlar')
    satir_kutusu(sayfa, 'c_ali').get_by_role('button', name='Pasife al', exact=True).click()
    # Ali Veli pasif olur ve altta soluk görünür
    expect(adlar(sayfa)).to_have_text(['Çağrı Işık', 'Ali Veli', 'Şule Öztürk'])
    expect(satir_kutusu(sayfa, 'c_ali').get_by_text('Pasif', exact=True)).to_be_visible()
    expect(satir_kutusu(sayfa, 'c_ali').get_by_role('button', name='Aktif yap', exact=True)).to_be_visible()
    assert next(c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['id'] == 'c_ali')['aktif'] is False

    sekmeye_git(sayfa, 'cizelge')
    expect(sayfa.locator('[data-satir="s_1"]')).to_contain_text('Ali Veli')  # eski satırda adı duruyor
    sayfa.get_by_role('button', name='Mesai ekle').click()
    form = sayfa.get_by_role('dialog', name='Mesai ekle')
    expect(form.get_by_label('Çağrı Işık')).to_be_visible()
    expect(form.get_by_label('Ali Veli')).to_have_count(0)  # pasif çalışan seçilemez
    expect(form.get_by_label('Şule Öztürk')).to_have_count(0)


def test_aktif_yap(hazirla, sayfa, kayit_oku):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    satir_kutusu(sayfa, 'c_sule').get_by_role('button', name='Aktif yap', exact=True).click()
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Işık', 'Şule Öztürk'])
    expect(sayfa.locator('.calisan-satir .etiket-pasif')).to_have_count(0)
    expect(satir_kutusu(sayfa, 'c_sule').get_by_role('button', name='Pasife al', exact=True)).to_be_visible()
    assert next(c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['id'] == 'c_sule')['aktif'] is True
    sekmeye_git(sayfa, 'cizelge')
    sayfa.get_by_role('button', name='Mesai ekle').click()
    expect(sayfa.get_by_role('dialog', name='Mesai ekle').get_by_label('Şule Öztürk')).to_be_visible()


def test_pasife_al_hata_listeyi_bozmaz(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    sahte_github.yazma_durumu = 401
    satir_kutusu(sayfa, 'c_ali').get_by_role('button', name='Pasife al', exact=True).click()
    expect(bildirim(sayfa)).to_have_text(YETKI)
    expect(adlar(sayfa)).to_have_text(['Ali Veli', 'Çağrı Işık', 'Şule Öztürk'])
    expect(satir_kutusu(sayfa, 'c_ali').get_by_role('button', name='Pasife al', exact=True)).to_be_enabled()
    assert next(c for c in kayit_oku('calisanlar.json')['calisanlar'] if c['id'] == 'c_ali')['aktif'] is True


def test_hata_bildirimi_daha_uzun_kalir(hazirla, sayfa, sahte_github):
    """M2: hata bildirimi okunacak kadar kalır (6 sn); bilgi bildirimi 2,8 sn."""
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    sahte_github.yazma_durumu = 401
    satir_kutusu(sayfa, 'c_ali').get_by_role('button', name='Pasife al', exact=True).click()
    expect(bildirim(sayfa)).to_have_text(YETKI)
    expect(bildirim(sayfa)).to_be_visible()
    sayfa.wait_for_timeout(4000)
    expect(bildirim(sayfa)).to_be_visible()  # 2,8 sn geçti: hata metni hâlâ okunuyor
    expect(bildirim(sayfa)).to_be_hidden(timeout=4000)  # 6 sn sonra kalkar


def test_calisanlar_bos(hazirla, sayfa):
    hazirla(calisanlar={'calisanlar': []})
    sekmeye_git(sayfa, 'calisanlar')
    expect(sayfa.get_by_text('Henüz çalışan yok.', exact=True)).to_be_visible()
    expect(sayfa.get_by_role('button', name='Çalışan ekle', exact=True)).to_be_visible()


def test_calisan_penceresi_klavye(hazirla, sayfa):
    hazirla()
    sekmeye_git(sayfa, 'calisanlar')
    ekle = sayfa.get_by_role('button', name='Çalışan ekle', exact=True)
    expect(ekle).to_be_visible()
    ekle.focus()
    sayfa.keyboard.press('Enter')
    pencere = sayfa.get_by_role('dialog', name='Çalışan ekle')
    expect(pencere).to_be_visible()
    assert pencere.evaluate('(d) => d.contains(document.activeElement)')
    sayfa.keyboard.type('Mehmet Kaya')
    sayfa.keyboard.press('Enter')  # Enter kaydeder
    expect(pencere).to_have_count(0)
    expect(adlar(sayfa)).to_have_count(4)
    sayfa.get_by_role('button', name='Çalışan ekle', exact=True).click()
    pencere = sayfa.get_by_role('dialog', name='Çalışan ekle')
    sayfa.keyboard.press('Escape')
    expect(pencere).to_have_count(0)
    expect(sayfa.get_by_role('button', name='Çalışan ekle', exact=True)).to_be_focused()


# --- Ayarlar -------------------------------------------------------------------

def test_ayarlar_alanlari_ve_surum(hazirla, sayfa):
    hazirla(ayarlar={'bolumYazisi': 'Su İşleri',
                     'imza': {'bolumAmiri': 'Ali Veli', 'puantor': '', 'bolumMuduru': 'Çağrı Işık'}})
    ekran = sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    expect(sayfa.get_by_label('Bölümü sütunu', exact=True)).to_have_value('Su İşleri')
    expect(sayfa.get_by_label('Bölüm Amiri', exact=True)).to_have_value('Ali Veli')
    expect(sayfa.get_by_label('Puantör', exact=True)).to_have_value('')
    expect(sayfa.get_by_label('Bölüm Müdürü', exact=True)).to_have_value('Çağrı Işık')
    expect(sayfa.get_by_role('button', name='Kaydet', exact=True)).to_be_visible()
    expect(sayfa.get_by_role('button', name='Çıkış', exact=True)).to_be_visible()
    surum = ekran.get_by_text('s1.0', exact=True)
    expect(surum).to_be_visible()
    # sıra: Kaydet, Çıkış, en altta sürüm
    yer = ekran.evaluate("""(e) => {
      const y = (s) => e.querySelector(s).getBoundingClientRect().top;
      return [y('.ayar-formu button[type=submit]'), y('.cikis-dugmesi'), y('.surum')];
    }""")
    assert yer == sorted(yer) and len(set(yer)) == 3


def test_ayarlar_varsayilan_bos(hazirla, sayfa):
    hazirla()  # ayarlar.json hiç yazılmamış
    sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    for ad in ('Bölümü sütunu', 'Bölüm Amiri', 'Puantör', 'Bölüm Müdürü'):
        expect(sayfa.get_by_label(ad, exact=True)).to_have_value('')


def test_ayarlar_kaydet(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla(ayarlar={'bolumYazisi': 'Eski', 'imza': {'bolumAmiri': 'Ali Veli', 'puantor': '', 'bolumMuduru': ''},
                     'baskaAlan': 7})
    sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    sayfa.get_by_label('Bölümü sütunu', exact=True).fill('  Su ve Kanalizasyon ')
    sayfa.get_by_label('Puantör', exact=True).fill('Şule Öztürk')
    sayfa.get_by_label('Bölüm Müdürü', exact=True).fill('Çağrı Işık')
    sayfa.get_by_role('button', name='Kaydet', exact=True).click()

    expect(bildirim(sayfa)).to_have_text('Ayarlar kaydedildi')
    assert kayit_oku('ayarlar.json') == {
        'bolumYazisi': 'Su ve Kanalizasyon',  # kırpıldı
        'imza': {'bolumAmiri': 'Ali Veli', 'puantor': 'Şule Öztürk', 'bolumMuduru': 'Çağrı Işık'},
        'baskaAlan': 7,  # bilinmeyen alan korunur
    }
    assert len(yazislar(sahte_github)) == 1
    expect(sayfa.get_by_label('Bölümü sütunu', exact=True)).to_have_value('Su ve Kanalizasyon')
    expect(sayfa.get_by_role('button', name='Kaydet', exact=True)).to_be_enabled()
    # başka sekmeye gidip dönünce kaydedilen değerler gelir
    sekmeye_git(sayfa, 'toplamlar')
    sekmeye_git(sayfa, 'ayarlar')
    expect(sayfa.get_by_label('Puantör', exact=True)).to_have_value('Şule Öztürk')


def test_ayarlar_kayit_401(hazirla, sayfa, sahte_github):
    hazirla()
    sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    sayfa.get_by_label('Puantör', exact=True).fill('Şule Öztürk')
    sahte_github.yazma_durumu = 401
    sayfa.get_by_role('button', name='Kaydet', exact=True).click()
    expect(sayfa.get_by_role('alert').filter(has_text=YETKI)).to_be_visible()
    expect(sayfa.get_by_label('Puantör', exact=True)).to_have_value('Şule Öztürk')
    expect(sayfa.get_by_role('button', name='Kaydet', exact=True)).to_be_enabled()
    expect(bildirim(sayfa)).not_to_have_text('Ayarlar kaydedildi')
    expect(sayfa.get_by_label('Parola', exact=True)).to_have_count(0)

    sahte_github.yazma_durumu = None
    sayfa.get_by_role('button', name='Kaydet', exact=True).click()
    expect(bildirim(sayfa)).to_have_text('Ayarlar kaydedildi')
    expect(sayfa.get_by_role('alert').filter(has_text=YETKI)).to_have_count(0)  # eski hata temizlenir


def test_ayarlar_kaydet_cift_tiklama_tek_yazis(hazirla, sayfa, sahte_github):
    hazirla()
    sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    sayfa.get_by_label('Puantör', exact=True).fill('Şule Öztürk')
    sahte_github.tut()
    sayfa.get_by_role('button', name='Kaydet', exact=True).dblclick()
    expect(sayfa.get_by_role('button', name='Kaydediliyor…', exact=True)).to_be_disabled()
    sayfa.wait_for_timeout(500)
    sahte_github.birak()
    expect(bildirim(sayfa)).to_have_text('Ayarlar kaydedildi')
    assert len(yazislar(sahte_github)) == 1


def test_ayarlar_okunamazsa_cikis_yine_var(hazirla, sayfa, kayit_yaz):
    """ayarlar.json açılamazsa Kaydet yoktur (üzerine yazılmaz) ama Çıkış ve sürüm yerindedir."""
    hazirla()
    kayit_yaz({'ayarlar.json': '{"surum": 1, "iv": "AAAA", "veri": "AAAA"}'})
    sekmeye_git(sayfa, 'ayarlar')
    expect(sayfa.get_by_role('alert').filter(has_text='Bu ayın kaydı açılamadı.')).to_be_visible()
    expect(sayfa.get_by_role('button', name='Kaydet', exact=True)).to_have_count(0)
    expect(sayfa.get_by_role('button', name='Çıkış', exact=True)).to_be_enabled()
    expect(sayfa.get_by_text('s1.0', exact=True)).to_be_visible()


def test_ayarlar_ciktiya_gecer(hazirla, sayfa):
    sayfa.add_init_script('window.print = () => { window.__yazdir = (window.__yazdir || 0) + 1; };')
    hazirla({'2026-10': EKIM[:2]})
    sekmeye_git(sayfa, 'ayarlar')
    ayarlar_yuklendi(sayfa)
    sayfa.get_by_label('Bölümü sütunu', exact=True).fill('Su ve Kanalizasyon')
    sayfa.get_by_label('Puantör', exact=True).fill('Şule Öztürk')
    sayfa.get_by_role('button', name='Kaydet', exact=True).click()
    expect(bildirim(sayfa)).to_have_text('Ayarlar kaydedildi')

    sekmeye_git(sayfa, 'cizelge')
    expect(sayfa.locator('[data-satir]')).to_have_count(2)
    sayfa.get_by_role('button', name='Yazdır').click()
    sayfa.wait_for_function('window.__yazdir === 1')
    govdeler = sayfa.locator('#yazdirma .cikti-govde')
    dolu = govdeler.filter(has=sayfa.locator('.cikti-metin'))
    expect(dolu).to_have_count(2)
    for i in range(2):  # her dolu satırın BÖLÜMÜ (3. sütun) hücresinde
        expect(dolu.nth(i).locator('.cikti-hucre').nth(2)).to_have_text('Su ve Kanalizasyon')
    imzalar = sayfa.locator('#yazdirma .cikti-imza-isim')
    expect(imzalar.nth(1)).to_have_text('Şule Öztürk')  # PUANTÖR kutusunun altı
    expect(imzalar.nth(0)).to_have_text('')
    expect(imzalar.nth(2)).to_have_text('')


def test_cikis_ayarlardan(hazirla, sayfa):
    hazirla()
    sekmeye_git(sayfa, 'ayarlar')
    sayfa.get_by_role('button', name='Çıkış', exact=True).click()
    expect(sayfa.get_by_label('Parola', exact=True)).to_be_visible()
    expect(sayfa.locator('nav.sekmeler')).to_have_count(0)


# --- Görünüm -------------------------------------------------------------------

def test_ekran_goruntuleri_tasma_yok(hazirla, sayfa):
    """390 ve 1280 genişlikte üç ekran (ve iki pencere); yatay kaydırma yok. Görüntüler cikti/ altına."""
    CIKTI.mkdir(exist_ok=True)
    hazirla({'2026-10': [
        *EKIM,
        satir('s_4', '2026-10-05', calisan='c_sule', neden='Şebeke arızası', baslama='19:00', bitis='22:15'),
    ]}, calisanlar={'calisanlar': [
        *CALISANLAR['calisanlar'],
        {'id': 'c_uzun', 'ad': 'Muhammed Abdülkadir Şükrüoğlu Karaçelebi-Yıldırımoğlu', 'aktif': True},
    ]}, ayarlar={'bolumYazisi': 'Su ve Kanalizasyon Müdürlüğü',
                 'imza': {'bolumAmiri': 'Ali Veli', 'puantor': 'Şule Öztürk', 'bolumMuduru': 'Çağrı Işık'}})
    genislik = 'document.documentElement.scrollWidth'
    for en, boy in ((GORUNUM['width'], GORUNUM['height']), (1280, 800)):
        sayfa.set_viewport_size({'width': en, 'height': boy})
        for tema in ('light', 'dark'):
            sayfa.emulate_media(color_scheme=tema)
            ek = '' if tema == 'light' else '-koyu'

            sekmeye_git(sayfa, 'toplamlar')
            expect(sayfa.locator('.toplam-satir')).to_have_count(3)
            assert sayfa.evaluate(genislik) <= en
            sayfa.screenshot(path=CIKTI / f'toplamlar-{en}{ek}.png', full_page=True, animations='disabled')

            sekmeye_git(sayfa, 'calisanlar')
            expect(adlar(sayfa)).to_have_count(4)
            assert sayfa.evaluate(genislik) <= en
            sayfa.screenshot(path=CIKTI / f'calisanlar-{en}{ek}.png', full_page=True, animations='disabled')
            pencere = calisan_ekle_ac(sayfa)
            pencere.get_by_label('Ad soyad', exact=True).fill('ali veli')
            pencere.get_by_role('button', name='Ekle', exact=True).click()
            expect(pencere.get_by_text(AYNI_AD, exact=True)).to_be_visible()
            assert sayfa.evaluate(genislik) <= en
            sayfa.screenshot(path=CIKTI / f'calisan-ekle-{en}{ek}.png', animations='disabled')
            pencere.get_by_role('button', name='Vazgeç', exact=True).click()
            expect(pencere).to_have_count(0)

            sekmeye_git(sayfa, 'ayarlar')
            ayarlar_yuklendi(sayfa)
            expect(sayfa.get_by_label('Puantör', exact=True)).to_have_value('Şule Öztürk')
            assert sayfa.evaluate(genislik) <= en
            sayfa.screenshot(path=CIKTI / f'ayarlar-{en}{ek}.png', full_page=True, animations='disabled')
            sayfa.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
            alt = sayfa.evaluate("""() => ({
              surum: document.querySelector('.surum').getBoundingClientRect().bottom,
              sekmeler: document.querySelector('nav.sekmeler').getBoundingClientRect().top,
            })""")
            assert alt['surum'] <= alt['sekmeler']  # en alttaki sürüm, sekme çubuğunun altında kalmaz
            sayfa.screenshot(path=CIKTI / f'ayarlar-alt-{en}{ek}.png', animations='disabled')
        sayfa.emulate_media(color_scheme='light')
