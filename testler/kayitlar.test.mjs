import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anahtarUret, sifrele, coz } from '../uygulama/sifre.js';
import { GitHubDepo, GitHubHatasi } from '../uygulama/github.js';
import {
  Kayitlar,
  BozukDosyaHatasi,
  KismiTasimaHatasi,
  VARSAYILAN_AYARLAR,
  yeniKimlik,
} from '../uygulama/kayitlar.js';
import { sahteGitHub } from './sahte-github.mjs';

const TUZ = new Uint8Array(16).fill(7);
const anahtar = await anahtarUret('deneme-parolasi-12', TUZ, 1000);
const baskaAnahtar = await anahtarUret('baska-parola-34567', TUZ, 1000);

const EKIM = 'mesai/2026-10.json';
const KASIM = 'mesai/2026-11.json';

const ALI = 'c_aaaaaaaa'; // "Ali Veli"
const CAGRI = 'c_bbbbbbbb'; // "Çağrı Işık"

function satir(ek = {}) {
  return { tarih: '2026-10-14', calisanId: ALI, neden: 'Arıza', baslama: '18:00', bitis: '19:40', ...ek };
}

// Sahte GitHub'a bağlı bir Kayitlar. `araci`, fetch'in önüne girmek isteyen testler içindir:
// (adres, secenek, sahteFetch) => Promise<Response>.
// `istekler`: sahteye giden her PUT için { yol, mesaj }.
function kur({ araci } = {}) {
  const sahte = sahteGitHub();
  const yazislar = [];
  const fetch = async (adres, secenek = {}) => {
    if (secenek.method === 'PUT') {
      yazislar.push({
        yol: decodeURIComponent(new URL(adres).pathname.split('/contents/')[1]),
        mesaj: JSON.parse(secenek.body).message,
      });
    }
    if (araci) return araci(adres, secenek, sahte.fetch);
    return sahte.fetch(adres, secenek);
  };
  const depo = new GitHubDepo({ sahip: 'sahip', depo: 'depo', token: 't', fetch });
  const kayitlar = new Kayitlar({ depo, anahtar });
  return { sahte, kayitlar, yazislar };
}

const yaziSayisi = (sahte, yol) => sahte.istekler.filter((i) => i.yontem === 'PUT' && (yol === undefined || i.yol === yol)).length;

// Sahte depodaki şifreli dosyayı çözer.
async function dosyaCoz(sahte, yol, k = anahtar) {
  return coz(k, JSON.parse(sahte.dosyalar.get(yol).icerik));
}

// Başka bir yazıcının (aynı anahtarla) bıraktığı dosya içeriği.
async function sifreliIcerik(veri, k = anahtar) {
  return JSON.stringify(await sifrele(k, veri));
}

function hataBekle(vaat, tur) {
  return assert.rejects(vaat, (hata) => {
    assert.ok(hata instanceof GitHubHatasi, `GitHubHatasi bekleniyordu: ${hata}`);
    assert.equal(hata.tur, tur);
    return true;
  });
}

// ---- Brief'teki testler ----

test('ilk_kayit_dosya_olusur', async () => {
  const { sahte, kayitlar } = kur();
  const [eklenen] = await kayitlar.satirlarEkle([satir()]);

  assert.ok(sahte.dosyalar.has(EKIM));
  const icerik = sahte.dosyalar.get(EKIM).icerik;
  assert.ok(!icerik.includes('Arıza'), 'düz metin görünmemeli');
  assert.ok(!icerik.includes('Ariza'));
  assert.ok(!icerik.includes(ALI));

  const zarf = JSON.parse(icerik);
  assert.deepEqual(Object.keys(zarf).sort(), ['iv', 'surum', 'veri']);
  assert.equal(zarf.surum, 1);
  assert.deepEqual(await dosyaCoz(sahte, EKIM), { satirlar: [eklenen] });
  assert.deepEqual(eklenen, { id: eklenen.id, ...satir() });
  assert.match(eklenen.id, /^s_[0-9a-z]{8}$/);
});

test('iki_ay_iki_dosya', async () => {
  const { sahte, kayitlar } = kur();
  const sonuc = await kayitlar.satirlarEkle([
    satir({ tarih: '2026-10-31' }),
    satir({ tarih: '2026-11-01', calisanId: CAGRI }),
    satir({ tarih: '2026-10-30', calisanId: CAGRI }),
  ]);

  assert.deepEqual([...sahte.dosyalar.keys()].sort(), [EKIM, KASIM]);
  assert.equal(yaziSayisi(sahte), 2, 'ay başına tek yazış');
  assert.equal(yaziSayisi(sahte, EKIM), 1);
  assert.equal(yaziSayisi(sahte, KASIM), 1);
  assert.equal(sonuc.length, 3);
  assert.deepEqual(sonuc.map((s) => s.tarih), ['2026-10-31', '2026-11-01', '2026-10-30'], 'girdi sırası korunur');
  assert.equal(new Set(sonuc.map((s) => s.id)).size, 3);
  assert.equal((await dosyaCoz(sahte, EKIM)).satirlar.length, 2);
  assert.equal((await dosyaCoz(sahte, KASIM)).satirlar.length, 1);
});

test('cakisma_yeniden_dener', async () => {
  // Gerçek araya girme: kayıtlar oku -> (başka yazıcı yazar) -> yaz. Sahte, eski sha için gerçek 409 verir.
  const baslangic = { id: 's_eski0001', ...satir({ tarih: '2026-10-01', neden: 'İlk' }) };
  const ara = { id: 's_ara00001', ...satir({ tarih: '2026-10-02', neden: 'Araya giren' }) };
  let arayaGirildi = false;
  const yazisDurumlari = [];
  const { sahte, kayitlar } = kur({
    araci: async (adres, secenek, sahteFetch) => {
      if (secenek.method !== 'PUT') return sahteFetch(adres, secenek);
      if (!arayaGirildi) {
        arayaGirildi = true;
        sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [baslangic, ara] }), sha: 'b'.repeat(40) });
      }
      const yanit = await sahteFetch(adres, secenek);
      yazisDurumlari.push(yanit.status);
      return yanit;
    },
  });
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [baslangic] }), sha: 'a'.repeat(40) });

  const [yeni] = await kayitlar.satirlarEkle([satir({ neden: 'Yeni' })]);

  assert.ok(arayaGirildi);
  assert.deepEqual(yazisDurumlari, [409, 200], 'ilk yazış gerçek eski-sha çakışması, ikincisi geçer');
  assert.equal(yaziSayisi(sahte, EKIM), 2, 'ilk yazış 409, ikincisi geçer');
  const { satirlar } = await dosyaCoz(sahte, EKIM);
  assert.deepEqual(satirlar.map((s) => s.id), [baslangic.id, ara.id, yeni.id], 'üç satırın hepsi var, kayıp yok');
});

test('cakisma_3_kez', async () => {
  const { sahte, kayitlar } = kur();
  sahte.sonrakiYanit(409, 3);
  await hataBekle(kayitlar.satirlarEkle([satir()]), 'cakisma');
  assert.equal(sahte.istekler.length, 3, 'toplam 3 deneme');
  assert.equal(yaziSayisi(sahte), 0);
  assert.ok(!sahte.dosyalar.has(EKIM));
});

test('bozuk_dosyaya_yazmaz', async () => {
  const { sahte, kayitlar } = kur();
  const bozuk = '{"surum":1,"iv":"AAAA","veri":"BBBB"}';
  sahte.dosyalar.set(EKIM, { icerik: bozuk });

  await assert.rejects(kayitlar.satirlarEkle([satir()]), (hata) => {
    assert.ok(hata instanceof BozukDosyaHatasi);
    assert.equal(hata.yol, EKIM);
    return true;
  });
  assert.equal(yaziSayisi(sahte), 0, 'yazış isteği hiç gitmemeli');
  assert.equal(sahte.dosyalar.get(EKIM).icerik, bozuk, 'dosya olduğu gibi kalır');
});

test('satirGuncelle_ay_tasima', async () => {
  const { kayitlar } = kur();
  const [kalan, tasinan] = await kayitlar.satirlarEkle([
    satir({ tarih: '2026-10-30', calisanId: CAGRI }),
    satir({ tarih: '2026-10-31' }),
  ]);

  await kayitlar.satirGuncelle(tasinan, { ...tasinan, tarih: '2026-11-01', bitis: '20:00' });

  const ekim = await kayitlar.ay('2026-10');
  const kasim = await kayitlar.ay('2026-11');
  assert.deepEqual(ekim, [kalan]);
  assert.deepEqual(kasim, [{ ...tasinan, tarih: '2026-11-01', bitis: '20:00' }]);
  assert.equal(kasim[0].id, tasinan.id, 'id değişmez');
});

test('satirGuncelle_tasima_yarim_kalirsa_uyarir', async () => {
  const { sahte, kayitlar } = kur({
    // Ekim'e yazış 500 verir; Kasım'a yazış normal geçer.
    araci: (adres, secenek, sahteFetch) => {
      if (secenek.method === 'PUT' && adres.includes('mesai/2026-10.json')) {
        return Promise.resolve(new Response('{"message":"hata"}', { status: 500 }));
      }
      return sahteFetch(adres, secenek);
    },
  });
  const tasinan = { id: 's_tasi0001', ...satir({ tarih: '2026-10-31' }) };
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [tasinan] }) });

  await assert.rejects(
    kayitlar.satirGuncelle(tasinan, { ...tasinan, tarih: '2026-11-01' }),
    (hata) => {
      assert.ok(hata instanceof KismiTasimaHatasi);
      assert.equal(hata.message, 'Satır yeni aya eklendi ama eski aydan silinemedi. Eski aydaki kopyayı silin.');
      assert.ok(hata.cause instanceof GitHubHatasi);
      assert.equal(hata.cause.tur, 'erisim');
      return true;
    },
  );

  const kasim = await dosyaCoz(sahte, KASIM);
  assert.deepEqual(kasim.satirlar.map((s) => s.id), [tasinan.id], 'Kasım\'da var');
  const ekim = await dosyaCoz(sahte, EKIM);
  assert.deepEqual(ekim.satirlar.map((s) => s.id), [tasinan.id], 'Ekim\'de de duruyor, kaybolmadı');
});

test('calisan_pasife', async () => {
  const { kayitlar } = kur();
  const ali = await kayitlar.calisanEkle('Ali Veli');
  const cagri = await kayitlar.calisanEkle('Çağrı Işık');

  await kayitlar.calisanGuncelle(ali.id, { aktif: false });

  const liste = await kayitlar.calisanlar();
  assert.deepEqual(liste.find((c) => c.id === ali.id), { id: ali.id, ad: 'Ali Veli', aktif: false });
  assert.deepEqual(liste.find((c) => c.id === cagri.id), { id: cagri.id, ad: 'Çağrı Işık', aktif: true });
});

test('ayarlar_varsayilan', async () => {
  const { sahte, kayitlar } = kur();
  assert.deepEqual(await kayitlar.ayarlar(), VARSAYILAN_AYARLAR);
  assert.deepEqual(VARSAYILAN_AYARLAR, { bolumYazisi: '', imza: { bolumAmiri: '', puantor: '', bolumMuduru: '' } });
  assert.equal(sahte.dosyalar.size, 0, 'okumak dosya oluşturmaz');
});

test('yeniKimlik_bicim', () => {
  for (let i = 0; i < 200; i++) {
    assert.match(yeniKimlik('s'), /^s_[0-9a-z]{8}$/);
    assert.match(yeniKimlik('c'), /^c_[0-9a-z]{8}$/);
  }
  assert.notEqual(yeniKimlik('s'), yeniKimlik('s'));
  assert.throws(() => yeniKimlik('x'), TypeError);
});

// ---- Ek testler ----

test('ay_siralama_tarih_sonra_baslama_pazar_basta', async () => {
  const { sahte, kayitlar } = kur();
  const satirlar = [
    { id: 's_00000001', ...satir({ tarih: '2026-10-13', baslama: '18:00' }) },
    { id: 's_00000002', ...satir({ tarih: '2026-10-11', baslama: null, bitis: null }) }, // pazar
    { id: 's_00000003', ...satir({ tarih: '2026-10-10', baslama: '09:30' }) },
    { id: 's_00000004', ...satir({ tarih: '2026-10-10', baslama: '09:00' }) },
    { id: 's_00000005', ...satir({ tarih: '2026-10-10', baslama: null, bitis: null }) },
    { id: 's_00000006', ...satir({ tarih: '2026-10-13', baslama: '18:30' }) },
    { id: 's_00000007', ...satir({ tarih: '2026-10-13', baslama: '17:59' }) },
  ];
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar }) });

  const sirali = await kayitlar.ay('2026-10');
  assert.deepEqual(
    sirali.map((s) => s.id),
    ['s_00000005', 's_00000004', 's_00000003', 's_00000002', 's_00000007', 's_00000001', 's_00000006'],
  );
  assert.equal(yaziSayisi(sahte), 0);
});

test('ay_bos_ay_bos_liste_ve_bicim_denetimi', async () => {
  const { sahte, kayitlar } = kur();
  assert.deepEqual(await kayitlar.ay('2026-10'), []);
  assert.equal(sahte.dosyalar.size, 0);
  await assert.rejects(kayitlar.ay('../ayarlar'), TypeError);
  await assert.rejects(kayitlar.ay('2026-13'), TypeError);
  assert.equal(sahte.istekler.length, 1, 'geçersiz ay için istek gitmez');
});

test('satirlarEkle_var_olan_dosyaya_ekler_ve_bos_liste_istek_atmaz', async () => {
  const { sahte, kayitlar } = kur();
  assert.deepEqual(await kayitlar.satirlarEkle([]), []);
  assert.equal(sahte.istekler.length, 0);

  const [bir] = await kayitlar.satirlarEkle([satir({ neden: 'Bir' })]);
  const [iki] = await kayitlar.satirlarEkle([satir({ neden: 'İki', baslama: '19:00', bitis: '20:00' })]);
  assert.deepEqual((await kayitlar.ay('2026-10')).map((s) => s.id), [bir.id, iki.id]);
});

// Görev 9 düzeltmesi: çağıranın verdiği kimlik korunur (form yeniden denemede aynı kimliği gönderir).
test('satirlarEkle_verilen_kimligi_korur', async () => {
  const { sahte, kayitlar } = kur();
  const [verilen, uretilen] = await kayitlar.satirlarEkle([
    { id: 's_verilen0', ...satir() },
    satir({ calisanId: CAGRI }),
  ]);
  assert.equal(verilen.id, 's_verilen0');
  assert.match(uretilen.id, /^s_[0-9a-z]{8}$/);
  assert.notEqual(uretilen.id, 's_verilen0');
  assert.deepEqual((await dosyaCoz(sahte, EKIM)).satirlar.map((s) => s.id), ['s_verilen0', uretilen.id]);
});

test('satirlarEkle_dosyada_olan_kimligi_yeniden_eklemez', async () => {
  const { sahte, kayitlar } = kur();
  const onceki = { id: 's_onceki00', ...satir({ neden: 'Önce yazılan' }) };
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [onceki] }) });

  const donen = await kayitlar.satirlarEkle([
    { id: 's_onceki00', ...satir({ neden: 'Yeniden gönderilen' }) },
    { id: 's_yeni0000', ...satir({ calisanId: CAGRI }) },
    { id: 's_yeni0000', ...satir({ calisanId: CAGRI }) }, // aynı çağrıda iki kez
  ]);
  assert.deepEqual(donen.map((s) => s.id), ['s_onceki00', 's_yeni0000', 's_yeni0000']);
  const { satirlar } = await dosyaCoz(sahte, EKIM);
  assert.deepEqual(satirlar.map((s) => s.id), ['s_onceki00', 's_yeni0000']);
  assert.equal(satirlar[0].neden, 'Önce yazılan'); // var olan satıra dokunulmaz

  await kayitlar.satirlarEkle([{ id: 's_yeni0000', ...satir({ calisanId: CAGRI }) }]); // aynı çağrı tekrar
  assert.equal((await dosyaCoz(sahte, EKIM)).satirlar.length, 2);
});

// Yazış GitHub'a ulaştı ama yanıtı kayboldu (zaman aşımı/5xx): kullanıcı aynı satırları yeniden kaydedince kopya olmaz.
test('satirlarEkle_yaniti_kaybolan_yazis_tekrarlaninca_kopya_olmaz', async () => {
  let dusur = true;
  const { sahte, kayitlar } = kur({
    araci: async (adres, secenek, sahteFetch) => {
      const yanit = await sahteFetch(adres, secenek);
      if (secenek.method !== 'PUT' || !dusur) return yanit;
      dusur = false;
      return new Response('{"message":"x"}', { status: 502 }); // yazış uygulandı, yanıt kayboldu
    },
  });
  const satirlar = [{ id: 's_ali00000', ...satir() }, { id: 's_cagri000', ...satir({ calisanId: CAGRI }) }];
  await hataBekle(kayitlar.satirlarEkle(satirlar), 'erisim');
  assert.equal((await dosyaCoz(sahte, EKIM)).satirlar.length, 2); // ilk yazış aslında ulaşmıştı
  await kayitlar.satirlarEkle(satirlar);
  assert.deepEqual((await dosyaCoz(sahte, EKIM)).satirlar.map((s) => s.id), ['s_ali00000', 's_cagri000']);
});

test('satirlarEkle_bicimsiz_kimligi_reddeder', async () => {
  const { sahte, kayitlar } = kur();
  for (const id of ['', 'x', 'c_aaaaaaaa', 's_KUCUK000', 7]) {
    await assert.rejects(kayitlar.satirlarEkle([satir(), { id, ...satir() }]), TypeError, JSON.stringify(id));
  }
  assert.equal(sahte.istekler.length, 0); // hiçbir şey yazılmadan önce denetlenir
});

test('satirGuncelle_ayni_ay_tek_yazis', async () => {
  const { sahte, kayitlar } = kur();
  const [a, b] = await kayitlar.satirlarEkle([satir({ neden: 'A' }), satir({ neden: 'B', tarih: '2026-10-15' })]);
  const once = yaziSayisi(sahte);

  await kayitlar.satirGuncelle(a, { ...a, neden: 'A düzeltildi', bitis: '20:15' });

  assert.equal(yaziSayisi(sahte) - once, 1);
  assert.deepEqual(await kayitlar.ay('2026-10'), [{ ...a, neden: 'A düzeltildi', bitis: '20:15' }, b]);
});

test('satirGuncelle_ay_tasima_once_yeni_ay_sonra_eski_ay', async () => {
  const { sahte, kayitlar, yazislar } = kur();
  const [s] = await kayitlar.satirlarEkle([satir({ tarih: '2026-10-31' })]);
  yazislar.length = 0;

  await kayitlar.satirGuncelle(s, { ...s, tarih: '2026-11-01' });

  assert.deepEqual(yazislar.map((y) => y.yol), [KASIM, EKIM]);
  assert.deepEqual((await dosyaCoz(sahte, EKIM)).satirlar, []);
});

test('satirGuncelle_tasima_tekrarlanirsa_kopya_olusmaz', async () => {
  // Yarım kalan taşımayı kullanıcı aynı işlemle yeniden dener: Kasım'da ikinci kopya oluşmamalı.
  const { sahte, kayitlar } = kur();
  const [s] = await kayitlar.satirlarEkle([satir({ tarih: '2026-10-31' })]);
  sahte.dosyalar.set(KASIM, { icerik: await sifreliIcerik({ satirlar: [{ ...s, tarih: '2026-11-01' }] }) });

  await kayitlar.satirGuncelle(s, { ...s, tarih: '2026-11-01' });

  assert.deepEqual((await kayitlar.ay('2026-11')).map((x) => x.id), [s.id]);
  assert.deepEqual(await kayitlar.ay('2026-10'), []);
});

test('satirGuncelle_baska_cihazda_silinmis_satir_kaybolmaz', async () => {
  const { kayitlar } = kur();
  const [s] = await kayitlar.satirlarEkle([satir()]);
  await kayitlar.satirSil(s);

  await kayitlar.satirGuncelle(s, { ...s, neden: 'Düzeltme' });

  assert.deepEqual(await kayitlar.ay('2026-10'), [{ ...s, neden: 'Düzeltme' }], 'kullanıcının son hali saklanır');
});

test('satirGuncelle_id_eskinin_idsi_kalir', async () => {
  const { kayitlar } = kur();
  const [s] = await kayitlar.satirlarEkle([satir()]);
  await kayitlar.satirGuncelle(s, { ...s, id: 's_baskaid0', neden: 'X' });
  assert.deepEqual((await kayitlar.ay('2026-10')).map((x) => x.id), [s.id]);
});

test('satirSil_yalniz_o_satiri_siler', async () => {
  const { sahte, kayitlar } = kur();
  const [a, b] = await kayitlar.satirlarEkle([satir({ neden: 'A' }), satir({ neden: 'B' })]);
  await kayitlar.satirSil(a);
  assert.deepEqual(await kayitlar.ay('2026-10'), [b]);
  // Zaten silinmiş satırı silmek hata değildir.
  await kayitlar.satirSil(a);
  assert.deepEqual(await kayitlar.ay('2026-10'), [b]);
  assert.ok(sahte.dosyalar.has(EKIM));
});

test('calisanEkle_kimlik_ve_sifreli_saklama', async () => {
  const { sahte, kayitlar } = kur();
  const c = await kayitlar.calisanEkle('Şule Öztürk');
  assert.match(c.id, /^c_[0-9a-z]{8}$/);
  assert.deepEqual(c, { id: c.id, ad: 'Şule Öztürk', aktif: true });
  assert.ok(!sahte.dosyalar.get('calisanlar.json').icerik.includes('Şule'));
  assert.deepEqual(await dosyaCoz(sahte, 'calisanlar.json'), { calisanlar: [c] });
});

test('calisanGuncelle_ad_duzeltir_ve_olmayani_reddeder', async () => {
  const { sahte, kayitlar } = kur();
  const c = await kayitlar.calisanEkle('Ali Vely');
  await kayitlar.calisanGuncelle(c.id, { ad: 'Ali Veli' });
  assert.deepEqual(await kayitlar.calisanlar(), [{ id: c.id, ad: 'Ali Veli', aktif: true }]);

  const once = yaziSayisi(sahte);
  await assert.rejects(kayitlar.calisanGuncelle('c_yokyokyo', { aktif: false }), Error);
  assert.equal(yaziSayisi(sahte), once, 'bulunamayınca yazış yok');
});

test('ayarlariKaydet_ve_ayarlar_geri_okunur', async () => {
  const { sahte, kayitlar } = kur();
  const ayarlar = { bolumYazisi: 'Su İşleri', imza: { bolumAmiri: 'Ali Veli', puantor: 'Çağrı Işık', bolumMuduru: 'Şule Öztürk' } };
  await kayitlar.ayarlariKaydet(ayarlar);
  assert.deepEqual(await kayitlar.ayarlar(), ayarlar);
  assert.ok(!sahte.dosyalar.get('ayarlar.json').icerik.includes('Su İşleri'));
});

test('ayarlar_donen_nesne_degistirilse_de_varsayilan_bozulmaz', async () => {
  const { kayitlar } = kur();
  const a = await kayitlar.ayarlar();
  a.imza.puantor = 'Değişti';
  a.bolumYazisi = 'Değişti';
  assert.deepEqual(await kayitlar.ayarlar(), { bolumYazisi: '', imza: { bolumAmiri: '', puantor: '', bolumMuduru: '' } });
  assert.equal(VARSAYILAN_AYARLAR.imza.puantor, '');
});

test('commit_mesajlari_kisi_adi_icermez', async () => {
  const { kayitlar, yazislar } = kur();
  const c = await kayitlar.calisanEkle('Ali Veli');
  await kayitlar.calisanGuncelle(c.id, { ad: 'Ali Veli Yeni', aktif: false });
  const [s] = await kayitlar.satirlarEkle([satir({ calisanId: c.id }), satir({ tarih: '2026-11-02', calisanId: c.id })]);
  await kayitlar.satirGuncelle(s, { ...s, neden: 'Düzeltme' });
  await kayitlar.satirSil(s);
  await kayitlar.ayarlariKaydet({ ...VARSAYILAN_AYARLAR, bolumYazisi: 'Su İşleri' });

  const beklenen = new Map([
    ['calisanlar.json', 'Çalışanlar'],
    [EKIM, 'Mesai: 2026-10'],
    [KASIM, 'Mesai: 2026-11'],
    ['ayarlar.json', 'Ayarlar'],
  ]);
  assert.ok(yazislar.length >= 7);
  for (const { yol, mesaj } of yazislar) assert.equal(mesaj, beklenen.get(yol), yol);
});

test('degistir_bilinmeyen_yol_reddedilir', async () => {
  const { sahte, kayitlar } = kur();
  await assert.rejects(kayitlar.degistir('baska/dosya.json', (v) => v, {}), TypeError);
  await assert.rejects(kayitlar.degistir('mesai/2026-1.json', (v) => v, {}), TypeError);
  assert.equal(sahte.istekler.length, 0);
});

test('degistir_islem_cakismada_taze_veriyle_yeniden_uygulanir', async () => {
  const ara = { id: 's_ara00001', ...satir({ neden: 'Araya giren' }) };
  let arayaGirildi = false;
  const { sahte, kayitlar } = kur({
    araci: async (adres, secenek, sahteFetch) => {
      if (secenek.method === 'PUT' && !arayaGirildi) {
        arayaGirildi = true;
        sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [ara] }), sha: 'c'.repeat(40) });
      }
      return sahteFetch(adres, secenek);
    },
  });
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [] }), sha: 'a'.repeat(40) });

  const gorulenler = [];
  const sonuc = await kayitlar.degistir(
    EKIM,
    (veri) => {
      gorulenler.push(veri.satirlar.length);
      return { satirlar: [...veri.satirlar, { id: 's_yeni0001', ...satir() }] };
    },
    { satirlar: [] },
  );

  assert.deepEqual(gorulenler, [0, 1], 'ikinci denemede taze veri görülür');
  assert.deepEqual(sonuc.satirlar.map((s) => s.id), [ara.id, 's_yeni0001']);
  assert.deepEqual((await dosyaCoz(sahte, EKIM)).satirlar.map((s) => s.id), [ara.id, 's_yeni0001']);
});

test('degistir_varsayilan_islemde_degistirilse_de_bozulmaz', async () => {
  const { kayitlar } = kur();
  const varsayilan = { satirlar: [] };
  await kayitlar.degistir(EKIM, (veri) => {
    veri.satirlar.push({ id: 's_yeni0001', ...satir() });
    return veri;
  }, varsayilan);
  assert.deepEqual(varsayilan, { satirlar: [] });
});

test('degistir_islem_undefined_donerse_yazmaz', async () => {
  const { sahte, kayitlar } = kur();
  await assert.rejects(kayitlar.degistir(EKIM, () => undefined, { satirlar: [] }), TypeError);
  assert.equal(yaziSayisi(sahte), 0);
});

test('cakisma_her_yazista_3_denemede_biter_veri_kaybolmaz', async () => {
  const rows = [];
  let n = 0;
  const { sahte, kayitlar } = kur({
    araci: async (adres, secenek, sahteFetch) => {
      if (secenek.method === 'PUT') {
        n += 1;
        rows.push({ id: `s_ara0000${n}`, ...satir({ neden: `Ara ${n}` }) });
        sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [...rows] }), sha: String(n).repeat(40).slice(0, 40) });
      }
      return sahteFetch(adres, secenek);
    },
  });
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [] }), sha: 'a'.repeat(40) });

  await hataBekle(kayitlar.satirlarEkle([satir({ neden: 'Yeni' })]), 'cakisma');

  assert.equal(yaziSayisi(sahte), 3);
  assert.deepEqual((await dosyaCoz(sahte, EKIM)).satirlar.map((s) => s.id), rows.map((r) => r.id), 'başkasının satırları duruyor');
});

test('erisim_internet_yetki_hatalarinda_yeniden_denenmez', async () => {
  for (const durum of [500, 401]) {
    // Okuma aşamasında
    const a = kur();
    a.sahte.sonrakiYanit(durum, 1);
    await assert.rejects(a.kayitlar.satirlarEkle([satir()]), (h) => h instanceof GitHubHatasi && h.tur !== 'cakisma');
    assert.equal(a.sahte.istekler.length, 1, `GET sonrası ${durum}: tek istek`);

    // Yazış aşamasında: zaman aşımı gibi yazışın belirsiz kaldığı durum, tekrar gönderilmez.
    const b = kur({
      araci: (adres, secenek, sahteFetch) =>
        secenek.method === 'PUT'
          ? Promise.resolve(new Response('{"message":"x"}', { status: durum }))
          : sahteFetch(adres, secenek),
    });
    await assert.rejects(b.kayitlar.satirlarEkle([satir()]), (h) => h instanceof GitHubHatasi && h.tur !== 'cakisma');
    assert.equal(b.yazislar.length, 1, `PUT ${durum}: tek yazış`);
  }

  // Ağ hatası (internet)
  const c = kur({
    araci: (adres, secenek, sahteFetch) =>
      secenek.method === 'PUT' ? Promise.reject(new TypeError('Failed to fetch')) : sahteFetch(adres, secenek),
  });
  await hataBekle(c.kayitlar.satirlarEkle([satir()]), 'internet');
  assert.equal(c.yazislar.length, 1);
});

test('yanlis_anahtarla_sifrelenmis_dosyaya_yazmaz', async () => {
  const { sahte, kayitlar } = kur();
  const baskasininki = await sifreliIcerik({ satirlar: [] }, baskaAnahtar);
  sahte.dosyalar.set(EKIM, { icerik: baskasininki });
  await assert.rejects(kayitlar.satirlarEkle([satir()]), BozukDosyaHatasi);
  await assert.rejects(kayitlar.ay('2026-10'), BozukDosyaHatasi);
  assert.equal(yaziSayisi(sahte), 0);
  assert.equal(sahte.dosyalar.get(EKIM).icerik, baskasininki);
});

test('json_olmayan_ya_da_bos_dosyaya_yazmaz', async () => {
  for (const icerik of ['bu json değil', '', 'null', '[]', '{"surum":2,"iv":"AAAA","veri":"BBBB"}']) {
    const { sahte, kayitlar } = kur();
    sahte.dosyalar.set('calisanlar.json', { icerik });
    await assert.rejects(kayitlar.calisanEkle('Ali Veli'), (h) => h instanceof BozukDosyaHatasi && h.yol === 'calisanlar.json', JSON.stringify(icerik));
    await assert.rejects(kayitlar.calisanlar(), BozukDosyaHatasi);
    assert.equal(yaziSayisi(sahte), 0);
    assert.equal(sahte.dosyalar.get('calisanlar.json').icerik, icerik);
  }
});

test('cozulen_ama_beklenmedik_bicimli_dosyaya_yazmaz', async () => {
  const { sahte, kayitlar } = kur();
  const icerik = await sifreliIcerik({ baska: 1 });
  sahte.dosyalar.set(EKIM, { icerik });
  await assert.rejects(kayitlar.satirlarEkle([satir()]), (h) => h instanceof BozukDosyaHatasi && h.yol === EKIM);
  await assert.rejects(kayitlar.ay('2026-10'), BozukDosyaHatasi);
  await assert.rejects(kayitlar.satirSil({ id: 's_x', tarih: '2026-10-01' }), BozukDosyaHatasi);
  assert.equal(yaziSayisi(sahte), 0);
  assert.equal(sahte.dosyalar.get(EKIM).icerik, icerik);
});

test('tasimada_eski_ay_bozulmussa_kismi_tasima_ve_ustune_yazilmaz', async () => {
  // Kasım yazışı geçer geçmez Ekim dosyası bozulur (başka bir cihaz bozuk yazmış gibi).
  const tasinan = { id: 's_tasi0001', ...satir({ tarih: '2026-10-31' }) };
  const { sahte, kayitlar } = kur({
    araci: async (adres, secenek, sahteFetch) => {
      const yanit = await sahteFetch(adres, secenek);
      if (secenek.method === 'PUT' && adres.includes('mesai/2026-11.json')) {
        sahte.dosyalar.set(EKIM, { icerik: 'bozuldu', sha: 'd'.repeat(40) });
      }
      return yanit;
    },
  });
  sahte.dosyalar.set(EKIM, { icerik: await sifreliIcerik({ satirlar: [tasinan] }) });

  await assert.rejects(kayitlar.satirGuncelle(tasinan, { ...tasinan, tarih: '2026-11-01' }), (h) => {
    assert.ok(h instanceof KismiTasimaHatasi);
    assert.ok(h.cause instanceof BozukDosyaHatasi);
    return true;
  });
  assert.equal(sahte.dosyalar.get(EKIM).icerik, 'bozuldu', 'bozuk dosyanın üstüne yazılmadı');
  assert.equal(yaziSayisi(sahte, EKIM), 0);
  assert.deepEqual((await dosyaCoz(sahte, KASIM)).satirlar.map((x) => x.id), [tasinan.id]);
});
