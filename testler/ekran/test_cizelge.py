"""Çizelge ve mesai formu (Görev 9).

Saat her testte sabitlenir (page.clock.set_fixed_time): "bugün", ileri tarih sınırı ve içinde
bulunulan ay testin çalıştığı günden bağımsızdır. Zamanlayıcılar gerçek zamanla işler.
"""
import re

import pytest
from playwright.sync_api import expect

from conftest import CIKTI, GORUNUM

SIMDI = '2026-10-16T21:00:00+03:00'  # cuma, İstanbul 21:00
SIMDI_KASIM = '2026-11-20T12:00:00+03:00'

CALISANLAR = {'calisanlar': [
    {'id': 'c_ali', 'ad': 'Ali Veli', 'aktif': True},
    {'id': 'c_cagri', 'ad': 'Çağrı Işık', 'aktif': True},
    {'id': 'c_sule', 'ad': 'Şule Öztürk', 'aktif': False},
]}

BOS_AY = 'Bu ay için kayıt yok.'
KURAL = "Bu saatlerde fazla mesai yok (hafta içi 18:00'den sonrası sayılır)."
YETKI = "GitHub anahtarının süresi dolmuş. Anıl'a haber verin."
KISMI = 'Satır yeni aya eklendi ama eski aydan silinemedi. Eski aydaki kopyayı silin.'


def satir(kimlik, tarih, calisan='c_ali', neden='Pompa arızası', baslama='17:00', bitis='19:40'):
    return {'id': kimlik, 'tarih': tarih, 'calisanId': calisan, 'neden': neden,
            'baslama': baslama, 'bitis': bitis}


@pytest.fixture
def hazirla(sayfa, kayit_yaz, giris_yap):
    """Saati sabitler, çalışanları ve verilen ayların satırlarını yazar, girer, listenin yüklenmesini bekler."""
    def hazirla(aylar=None, simdi=SIMDI):
        sayfa.clock.set_fixed_time(simdi)
        dosyalar = {'calisanlar.json': CALISANLAR}
        for ay, satirlar in (aylar or {}).items():
            dosyalar[f'mesai/{ay}.json'] = {'satirlar': satirlar}
        kayit_yaz(dosyalar)
        giris_yap()
        liste_yuklendi(sayfa)
        return sayfa
    return hazirla


def liste_yuklendi(sayfa):
    expect(sayfa.locator('.cizelge-liste')).not_to_have_attribute('aria-busy', 'true')


def satirlar(sayfa):
    return sayfa.locator('[data-satir]')


def mesai_ekle(sayfa):
    sayfa.get_by_role('button', name='Mesai ekle').click()
    form = sayfa.get_by_role('dialog', name='Mesai ekle')
    expect(form).to_be_visible()
    return form


def doldur(form, calisanlar=('Ali Veli',), neden='Ana hat arızası', baslama='17:00', bitis='19:40', tarih=None):
    if tarih is not None:
        form.get_by_label('Tarih', exact=True).fill(tarih)
    for ad in calisanlar:
        form.get_by_label(ad).check()
    form.get_by_label('Mesai nedeni').fill(neden)
    if baslama is not None:
        form.get_by_label('Başlama', exact=True).fill(baslama)
    if bitis is not None:
        form.get_by_label('Bitiş', exact=True).fill(bitis)


def yazislar(sahte_github):
    return [i for i in sahte_github.istekler if i['yontem'] == 'PUT']


def bildirim(sayfa):
    return sayfa.locator('.bildirim')


# --- Brief'in testleri -------------------------------------------------------

def test_mesai_ekle_coklu(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()
    form = mesai_ekle(sayfa)
    tarih = form.get_by_label('Tarih', exact=True)
    expect(tarih).to_have_value('2026-10-16')  # bugün gelir
    expect(tarih).to_have_attribute('max', '2026-10-16')  # İstanbul bugünü
    expect(form.get_by_label('Şule Öztürk')).to_have_count(0)  # pasif çalışan listede yok
    expect(form.get_by_text('60/60', exact=True)).to_be_visible()
    expect(form.get_by_label('Mesai nedeni')).to_have_attribute('maxlength', '60')
    doldur(form, calisanlar=('Ali Veli', 'Çağrı Işık'))
    expect(form.get_by_text('45/60', exact=True)).to_be_visible()  # 'Ana hat arızası' 15 karakter
    expect(form.get_by_text('Fazla mesai: 1 saat 40 dakika', exact=True)).to_be_visible()
    form.get_by_role('button', name='Kaydet').click()

    expect(form).to_have_count(0)
    expect(bildirim(sayfa)).to_have_text('Kaydedildi')
    expect(satirlar(sayfa)).to_have_count(2)
    for i in range(2):
        expect(satirlar(sayfa).nth(i)).to_contain_text('1 saat 40 dakika')
    expect(satirlar(sayfa).nth(0)).to_contain_text('Ali Veli')
    expect(satirlar(sayfa).nth(1)).to_contain_text('Çağrı Işık')
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_have_count(0)

    kayit = kayit_oku('mesai/2026-10.json')
    assert sorted(s['calisanId'] for s in kayit['satirlar']) == ['c_ali', 'c_cagri']
    for s in kayit['satirlar']:
        assert (s['tarih'], s['neden'], s['baslama'], s['bitis']) == ('2026-10-16', 'Ana hat arızası', '17:00', '19:40')
        assert s['id'].startswith('s_')
    assert len(yazislar(sahte_github)) == 1  # iki satır tek yazışta


def test_pazar_saat_alani_yok(hazirla, sayfa, kayit_oku):
    hazirla()
    form = mesai_ekle(sayfa)
    form.get_by_label('Başlama', exact=True).fill('10:00')
    form.get_by_label('Tarih', exact=True).fill('2026-10-11')  # pazar
    expect(form.get_by_label('Başlama', exact=True)).to_be_hidden()
    expect(form.get_by_label('Bitiş', exact=True)).to_be_hidden()
    expect(form.get_by_text('PAZAR — saat girilmez', exact=True)).to_be_visible()
    expect(form.get_by_text('Fazla mesai:')).to_have_count(0)
    doldur(form, neden='Vardiya desteği', baslama=None, bitis=None)
    form.get_by_role('button', name='Kaydet').click()

    expect(form).to_have_count(0)
    expect(satirlar(sayfa)).to_have_count(1)
    expect(satirlar(sayfa).first).to_contain_text('PAZAR')
    expect(satirlar(sayfa).first).to_contain_text('11.10.2026')
    [s] = kayit_oku('mesai/2026-10.json')['satirlar']
    assert (s['baslama'], s['bitis']) == (None, None)  # girilmiş saat pazarda atılır


def test_kural_hatasi_gosterilir(hazirla, sayfa, sahte_github):
    hazirla()
    form = mesai_ekle(sayfa)
    doldur(form, baslama='16:00', bitis='17:30')
    istek_sayisi = len(sahte_github.istekler)
    form.get_by_role('button', name='Kaydet').click()
    expect(form.get_by_text(KURAL, exact=True)).to_be_visible()
    expect(form).to_be_visible()
    expect(form.get_by_label('Bitiş', exact=True)).to_have_attribute('aria-invalid', 'true')
    assert yazislar(sahte_github) == []
    assert len(sahte_github.istekler) == istek_sayisi  # kayıt isteği hiç gitmedi
    expect(satirlar(sayfa)).to_have_count(0)


def test_kaydet_cift_tiklama_tek_satir(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla()
    form = mesai_ekle(sayfa)
    doldur(form)
    sahte_github.tut()  # GitHub istekleri bekletilir (yavaş ağ)
    form.get_by_role('button', name='Kaydet').dblclick()
    bekleyen = form.get_by_role('button', name='Kaydediliyor…')
    expect(bekleyen).to_be_disabled()
    form.locator('form').evaluate('(f) => f.requestSubmit()')  # klavye ya da üçüncü basış: yine tek kayıt
    sayfa.wait_for_timeout(1000)  # yazışlar 1 sn gecikir
    expect(bekleyen).to_be_disabled()
    sahte_github.birak()

    expect(form).to_have_count(0)
    expect(satirlar(sayfa)).to_have_count(1)
    assert len(kayit_oku('mesai/2026-10.json')['satirlar']) == 1
    assert len(yazislar(sahte_github)) == 1


def test_kayit_401_form_korunur(hazirla, sayfa, sahte_github):
    hazirla()
    form = mesai_ekle(sayfa)
    doldur(form, calisanlar=('Ali Veli', 'Çağrı Işık'))
    sahte_github.yazma_durumu = 401
    form.get_by_role('button', name='Kaydet').click()

    expect(form.get_by_text(YETKI, exact=True)).to_be_visible()
    expect(form.get_by_label('Mesai nedeni')).to_have_value('Ana hat arızası')
    expect(form.get_by_label('Ali Veli')).to_be_checked()
    expect(form.get_by_label('Çağrı Işık')).to_be_checked()
    expect(form.get_by_label('Başlama', exact=True)).to_have_value('17:00')
    expect(form.get_by_label('Bitiş', exact=True)).to_have_value('19:40')
    expect(form.get_by_role('button', name='Kaydet')).to_be_enabled()
    expect(sayfa.locator('nav.sekmeler')).to_have_count(1)  # giriş ekranına dönmedi
    expect(sayfa.get_by_label('Parola', exact=True)).to_have_count(0)
    expect(sayfa.get_by_text('GitHub anahtarı kabul edilmedi')).to_have_count(0)  # github.js'in iç metni değil

    sahte_github.yazma_durumu = None  # anahtar yenilendi: aynı düğmeyle tekrar
    form.get_by_role('button', name='Kaydet').click()
    expect(form).to_have_count(0)
    expect(satirlar(sayfa)).to_have_count(2)


def test_duzenle_ay_degistir(hazirla, sayfa, kayit_oku):
    hazirla({'2026-10': [satir('s_ekim31', '2026-10-31', neden='Pompa değişimi', baslama='09:00', bitis='12:00')]},
            simdi=SIMDI_KASIM)
    expect(sayfa.get_by_role('heading', name='Kasım 2026', exact=True)).to_be_visible()
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    eski = sayfa.locator('[data-satir="s_ekim31"]')
    expect(eski).to_contain_text('31.10.2026')
    expect(eski).to_contain_text('3 saat')  # cumartesi: tamamı
    eski.click()

    form = sayfa.get_by_role('dialog', name='Düzenle')
    expect(form).to_be_visible()
    expect(form.get_by_label('Tarih', exact=True)).to_have_value('2026-10-31')
    expect(form.get_by_label('Mesai nedeni')).to_have_value('Pompa değişimi')
    expect(form.get_by_label('Ali Veli')).to_be_checked()
    expect(form.get_by_role('checkbox')).to_have_count(0)  # düzenlemede tek seçim
    form.get_by_label('Tarih', exact=True).fill('2026-11-01')  # pazar
    expect(form.get_by_text('PAZAR — saat girilmez', exact=True)).to_be_visible()
    form.get_by_role('button', name='Kaydet').click()

    expect(form).to_have_count(0)
    expect(bildirim(sayfa)).to_have_text('Kaydedildi')
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(eski).to_have_count(0)
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()
    sayfa.get_by_role('button', name='Sonraki ay').click()
    expect(sayfa.get_by_role('heading', name='Kasım 2026', exact=True)).to_be_visible()
    yeni = sayfa.locator('[data-satir="s_ekim31"]')
    expect(yeni).to_contain_text('01.11.2026')
    expect(yeni).to_contain_text('PAZAR')
    assert kayit_oku('mesai/2026-10.json')['satirlar'] == []
    [s] = kayit_oku('mesai/2026-11.json')['satirlar']
    assert s == {'id': 's_ekim31', 'tarih': '2026-11-01', 'calisanId': 'c_ali', 'neden': 'Pompa değişimi',
                 'baslama': None, 'bitis': None}


def test_sil(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla({'2026-10': [satir('s_sil', '2026-10-14'), satir('s_kal', '2026-10-15', calisan='c_cagri')]})
    expect(satirlar(sayfa)).to_have_count(2)
    sayfa.locator('[data-satir="s_sil"]').click()
    form = sayfa.get_by_role('dialog', name='Düzenle')
    onay = sayfa.get_by_role('alertdialog', name='Bu satır silinsin mi?')

    form.get_by_role('button', name='Sil').click()
    expect(onay).to_be_visible()
    onay.get_by_role('button', name='Vazgeç').click()  # vazgeçince bir şey silinmez
    expect(onay).to_have_count(0)
    expect(form).to_be_visible()
    assert yazislar(sahte_github) == []

    form.get_by_role('button', name='Sil').click()
    onay.get_by_role('button', name='Sil').click()
    expect(onay).to_have_count(0)
    expect(form).to_have_count(0)
    expect(sayfa.locator('[data-satir="s_sil"]')).to_have_count(0)
    expect(sayfa.locator('[data-satir="s_kal"]')).to_have_count(1)
    assert [s['id'] for s in kayit_oku('mesai/2026-10.json')['satirlar']] == ['s_kal']


def test_ileri_ay_yok(hazirla, sayfa):
    hazirla()
    ileri = sayfa.get_by_role('button', name='Sonraki ay')
    geri = sayfa.get_by_role('button', name='Önceki ay')
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(ileri).to_be_disabled()
    geri.click()
    expect(sayfa.get_by_role('heading', name='Eylül 2026', exact=True)).to_be_visible()
    expect(ileri).to_be_enabled()
    ileri.click()
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(ileri).to_be_disabled()


def test_yazdir_cagirir(hazirla, sayfa):
    sayfa.add_init_script('window.print = () => { window.__yazdir = (window.__yazdir || 0) + 1; };')
    ekim = [satir(f's_{i}', f'2026-10-{1 + i % 14:02d}', calisan=('c_ali', 'c_cagri')[i % 2]) for i in range(21)]
    hazirla({'2026-10': ekim})
    yazdir = sayfa.get_by_role('button', name='Yazdır')
    yazdir.focus()
    sayfa.keyboard.press('Enter')
    sayfa.wait_for_function('window.__yazdir === 1')
    expect(yazdir).to_be_focused()  # iş sürerken düğme odağı kaybetmedi
    expect(yazdir).not_to_have_attribute('aria-busy', 'true')
    alan = sayfa.locator('#yazdirma')
    expect(alan).to_contain_text('FAZLA MESAİ ÇİZELGESİ')
    expect(alan).to_contain_text('TANZİM TARİHİ: 16.10.2026')
    expect(alan).to_contain_text('Ali Veli')
    expect(alan.locator('section.cikti-sayfa')).to_have_count(2)  # 21 satır: iki sayfa
    assert alan.locator('section').count() == 2  # .cikti-sayfa:last-of-type yalnız çıktı sayfalarını sayar
    expect(alan).to_be_hidden()  # ekranda görünmez
    sayfa.emulate_media(media='print')
    expect(alan).to_be_visible()  # yazdırırken yalnız çıktı görünür
    expect(sayfa.locator('#uygulama')).to_be_hidden()
    expect(bildirim(sayfa)).to_be_hidden()
    pdf = sayfa.pdf(prefer_css_page_size=True)
    assert len(re.findall(rb'/Type\s*/Page(?![a-z])', pdf)) == 2  # ne uygulama ekranı ne boş sayfa basıldı


def test_pdf_indir(hazirla, sayfa):
    sayfa.add_init_script('delete Navigator.prototype.canShare; delete Navigator.prototype.share;')
    hazirla({'2026-10': [satir('s_1', '2026-10-14')]})
    with sayfa.expect_download() as bilgi:
        sayfa.get_by_role('button', name='PDF / Gönder').click()
    indirme = bilgi.value
    assert indirme.suggested_filename == 'Fazla_Mesai_2026-10.pdf'
    with open(indirme.path(), 'rb') as dosya:
        assert dosya.read(5) == b'%PDF-'
    expect(bildirim(sayfa)).to_have_text('PDF indirildi')


# --- Ek testler --------------------------------------------------------------

def test_tasima_yarim_kalirsa_uyari(hazirla, sayfa, sahte_github, kayit_oku):
    hazirla({'2026-10': [satir('s_tasi', '2026-10-30')]}, simdi=SIMDI_KASIM)
    sayfa.get_by_role('button', name='Önceki ay').click()
    sayfa.locator('[data-satir="s_tasi"]').click()
    form = sayfa.get_by_role('dialog', name='Düzenle')
    form.get_by_label('Tarih', exact=True).fill('2026-11-02')
    sahte_github.yazma_durumlari['mesai/2026-10.json'] = 500  # eski aydan silme düşer
    form.get_by_role('button', name='Kaydet').click()

    expect(form.get_by_text(KISMI, exact=True)).to_be_visible()  # formun üstünde
    expect(form.get_by_label('Tarih', exact=True)).to_have_value('2026-11-02')
    assert [s['id'] for s in kayit_oku('mesai/2026-11.json')['satirlar']] == ['s_tasi']
    assert [s['id'] for s in kayit_oku('mesai/2026-10.json')['satirlar']] == ['s_tasi']
    expect(sayfa.locator('[data-satir="s_tasi"]')).to_contain_text('30.10.2026')  # liste tazelendi

    sahte_github.yazma_durumlari.clear()  # tekrar kaydedince kopya oluşmaz, eskisi silinir
    form.get_by_role('button', name='Kaydet').click()
    expect(form).to_have_count(0)
    expect(sayfa.locator('[data-satir="s_tasi"]')).to_have_count(0)
    assert kayit_oku('mesai/2026-10.json')['satirlar'] == []
    assert [s['id'] for s in kayit_oku('mesai/2026-11.json')['satirlar']] == ['s_tasi']


def test_alan_hatalari_ve_ileri_tarih(hazirla, sayfa, sahte_github):
    hazirla()
    form = mesai_ekle(sayfa)
    form.get_by_label('Tarih', exact=True).fill('2026-10-17')  # yarın
    form.get_by_role('button', name='Kaydet').click()
    expect(form.get_by_text('İleri bir tarihe kayıt girilemez.', exact=True)).to_be_visible()
    expect(form.get_by_text('Çalışan seçin.', exact=True)).to_be_visible()
    expect(form.get_by_text('Mesai nedenini yazın.', exact=True)).to_be_visible()
    expect(form.get_by_label('Tarih', exact=True)).to_be_focused()  # ilk hatalı kutu
    form.get_by_label('Tarih', exact=True).fill('2026-10-16')
    form.get_by_label('Başlama', exact=True).fill('20:00')
    form.get_by_label('Bitiş', exact=True).fill('21:30')  # bugün, saat 21:00: henüz gelmedi
    form.get_by_role('button', name='Kaydet').click()
    expect(form.get_by_text('Bitiş saati henüz gelmedi.', exact=True)).to_be_visible()
    expect(form.get_by_text('İleri bir tarihe kayıt girilemez.', exact=True)).to_have_count(0)
    assert yazislar(sahte_github) == []


def test_ay_degisince_yeni_satir_gorunur(hazirla, sayfa):
    hazirla()
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('heading', name='Eylül 2026', exact=True)).to_be_visible()
    form = mesai_ekle(sayfa)
    doldur(form)  # tarih bugün: Ekim
    form.get_by_role('button', name='Kaydet').click()
    expect(form).to_have_count(0)
    expect(sayfa.get_by_role('heading', name='Ekim 2026', exact=True)).to_be_visible()
    expect(satirlar(sayfa)).to_have_count(1)


def test_bozuk_ay_dosyasi(hazirla, sayfa, kayit_yaz):
    sayfa.clock.set_fixed_time(SIMDI)
    kayit_yaz({'mesai/2026-09.json': '{"surum": 1, "iv": "AAAA", "veri": "AAAA"}'})
    hazirla()
    sayfa.get_by_role('button', name='Önceki ay').click()
    expect(sayfa.get_by_role('alert').filter(has_text='Bu ayın kaydı açılamadı.')).to_be_visible()
    sayfa.get_by_role('button', name='Sonraki ay').click()  # ay çubuğu çalışmaya devam eder
    expect(sayfa.get_by_text(BOS_AY, exact=True)).to_be_visible()


def test_klavye_ile_form(hazirla, sayfa):
    hazirla()
    ekle = sayfa.get_by_role('button', name='Mesai ekle')
    ekle.focus()
    sayfa.keyboard.press('Enter')
    form = sayfa.get_by_role('dialog', name='Mesai ekle')
    expect(form).to_be_visible()
    assert form.evaluate('(d) => d.contains(document.activeElement)')
    sayfa.keyboard.press('Escape')
    expect(form).to_have_count(0)
    expect(ekle).to_be_focused()


def test_ekran_goruntuleri_tasma_yok(hazirla, sayfa):
    """390 ve 1280 genişlikte liste, form ve pazar formu; yatay kaydırma yok. Görüntüler cikti/ altına."""
    CIKTI.mkdir(exist_ok=True)
    uzun_neden = 'Şebeke arızası nedeniyle İğdır hattında acil vana değişimi ve kontrol'[:60]
    hazirla({'2026-10': [
        satir('s_1', '2026-10-01', neden='Ana hat arızası'),
        satir('s_2', '2026-10-03', calisan='c_cagri', neden=uzun_neden, baslama='08:00', bitis='16:30'),
        satir('s_3', '2026-10-04', neden='Vardiya desteği', baslama=None, bitis=None),
        satir('s_4', '2026-10-14', calisan='c_sule', neden='Ş' * 60, baslama='18:00', bitis='23:59'),
    ]})
    genislik = 'document.documentElement.scrollWidth'
    for en, boy in ((GORUNUM['width'], GORUNUM['height']), (1280, 800)):
        sayfa.set_viewport_size({'width': en, 'height': boy})
        for tema in ('light', 'dark'):
            sayfa.emulate_media(color_scheme=tema)
            ek = '' if tema == 'light' else '-koyu'
            expect(satirlar(sayfa)).to_have_count(4)
            assert sayfa.evaluate(genislik) <= en
            sayfa.mouse.move(1, 1)  # fare bir satırın üstünde kalmasın (hover)
            sayfa.screenshot(path=CIKTI / f'cizelge-{en}{ek}.png', full_page=True, animations='disabled')
            form = mesai_ekle(sayfa)
            doldur(form, calisanlar=('Ali Veli',))
            assert sayfa.evaluate(genislik) <= en
            sayfa.screenshot(path=CIKTI / f'form-{en}{ek}.png', animations='disabled')
            form.get_by_label('Tarih', exact=True).fill('2026-10-11')
            expect(form.get_by_text('PAZAR — saat girilmez', exact=True)).to_be_visible()
            sayfa.screenshot(path=CIKTI / f'form-pazar-{en}{ek}.png', animations='disabled')
            form.get_by_role('button', name='Vazgeç').click()
            expect(form).to_have_count(0)
        sayfa.emulate_media(color_scheme='light')
    sayfa.locator('[data-satir="s_2"]').click()
    form = sayfa.get_by_role('dialog', name='Düzenle')
    form.get_by_role('button', name='Sil').click()
    expect(sayfa.get_by_role('alertdialog', name='Bu satır silinsin mi?')).to_be_visible()
    sayfa.screenshot(path=CIKTI / 'sil-onay-1280.png', animations='disabled')
    sayfa.set_viewport_size(GORUNUM)
    sayfa.screenshot(path=CIKTI / 'sil-onay-390.png', animations='disabled')
