import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satirDenetle, satirTemizle, NEDEN_SINIRI } from '../uygulama/kurallar.js';

// 2026-10-14T16:00:00Z = İstanbul 19:00 (çarşamba).
const baglam = {
  simdi: new Date('2026-10-14T16:00:00Z'),
  calisanlar: [
    { id: 'c1', ad: 'Ali Veli', aktif: true },
    { id: 'c2', ad: 'Şule Öztürk', aktif: false },
  ],
};

const satir = (ek = {}) => ({
  tarih: '2026-10-13',
  calisanId: 'c1',
  neden: 'Arıza',
  baslama: '17:00',
  bitis: '19:40',
  ...ek,
});

const denetle = (ek) => satirDenetle(satir(ek), baglam);

test('NEDEN_SINIRI', () => assert.equal(NEDEN_SINIRI, 60));

test('gecerli_hafta_ici', () => {
  const sonuc = denetle();
  assert.equal(sonuc.gecerli, true);
  assert.deepEqual(sonuc.hatalar, {});
});

test('ileri_tarih', () => {
  const sonuc = denetle({ tarih: '2026-10-15' });
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.tarih, 'İleri bir tarihe kayıt girilemez.');
});

test('bos_tarih', () => {
  const sonuc = denetle({ tarih: '' });
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.tarih, 'Tarih seçin.');
  assert.equal(denetle({ tarih: null }).hatalar.tarih, 'Tarih seçin.');
});

test('bozuk_tarih', () => {
  assert.equal(denetle({ tarih: 'dün' }).hatalar.tarih, 'Tarih seçin.');
  assert.equal(denetle({ tarih: '2026-02-30' }).hatalar.tarih, 'Tarih seçin.');
});

test('bugun_gecerli_tarih', () => {
  assert.equal(denetle({ tarih: '2026-10-14', baslama: '18:00', bitis: '19:00' }).hatalar.tarih, undefined);
});

test('bugun_gelmemis_saat', () => {
  const gelmemis = denetle({ tarih: '2026-10-14', baslama: '18:00', bitis: '19:30' });
  assert.equal(gelmemis.gecerli, false);
  assert.equal(gelmemis.hatalar.saat, 'Bitiş saati henüz gelmedi.');

  const tamSimdi = denetle({ tarih: '2026-10-14', baslama: '18:00', bitis: '19:00' });
  assert.equal(tamSimdi.gecerli, true);
  assert.deepEqual(tamSimdi.hatalar, {});
});

test('dun_icin_ileri_saat_sorun_degil', () => {
  assert.equal(denetle({ tarih: '2026-10-13', baslama: '18:00', bitis: '23:30' }).gecerli, true);
});

test('calisan_bos_ya_da_listede_yok', () => {
  assert.equal(denetle({ calisanId: '' }).hatalar.calisan, 'Çalışan seçin.');
  assert.equal(denetle({ calisanId: null }).hatalar.calisan, 'Çalışan seçin.');
  assert.equal(denetle({ calisanId: 'c99' }).hatalar.calisan, 'Çalışan seçin.');
});

test('pasif_calisan', () => {
  const sonuc = denetle({ calisanId: 'c2' });
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.calisan, 'Pasif çalışan seçilemez.');
});

test('neden_bos', () => {
  assert.equal(denetle({ neden: '' }).hatalar.neden, 'Mesai nedenini yazın.');
  assert.equal(denetle({ neden: '   ' }).hatalar.neden, 'Mesai nedenini yazın.');
  assert.equal(denetle({ neden: null }).hatalar.neden, 'Mesai nedenini yazın.');
});

test('neden_61', () => {
  const uzun = denetle({ neden: 'a'.repeat(61) });
  assert.equal(uzun.gecerli, false);
  assert.equal(uzun.hatalar.neden, 'Mesai nedeni en fazla 60 karakter olabilir.');

  const sinir = denetle({ neden: 'a'.repeat(60) });
  assert.equal(sinir.gecerli, true);
  assert.deepEqual(sinir.hatalar, {});
});

test('neden_kirpilmis_uzunlukla_sayilir', () => {
  assert.equal(denetle({ neden: `  ${'a'.repeat(60)}  ` }).gecerli, true);
});

test('bitis_once', () => {
  const sonuc = denetle({ baslama: '21:00', bitis: '20:00' });
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.saat, 'Bitiş, başlamadan sonra olmalı.');
  assert.equal(denetle({ baslama: '20:00', bitis: '20:00' }).hatalar.saat, 'Bitiş, başlamadan sonra olmalı.');
});

test('hafta_ici_sifir', () => {
  const sonuc = denetle({ tarih: '2026-10-13', baslama: '16:00', bitis: '17:30' });
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.saat, "Bu saatlerde fazla mesai yok (hafta içi 17:30'dan sonrası sayılır).");
});

test('hafta_ici_1730_sonrasi_gecerli', () => {
  // 17:30'u bir dakika bile geçen satır kaydedilebilir; tam 17:30'da biten kaydedilmez.
  assert.deepEqual(denetle({ tarih: '2026-10-13', baslama: '16:00', bitis: '17:31' }).hatalar, {});
  assert.equal(denetle({ tarih: '2026-10-13', baslama: '17:00', bitis: '17:30' }).gecerli, false);
});

test('cumartesi_tamami_gecerli', () => {
  assert.deepEqual(denetle({ tarih: '2026-10-10', baslama: '08:00', bitis: '09:00' }).hatalar, {});
});

test('saat_eksik_hafta_ici', () => {
  const metin = 'Başlama ve bitiş saatini girin.';
  assert.equal(denetle({ baslama: null }).hatalar.saat, metin);
  assert.equal(denetle({ bitis: null }).hatalar.saat, metin);
  assert.equal(denetle({ baslama: null, bitis: null }).hatalar.saat, metin);
  assert.equal(denetle({ tarih: '2026-10-10', baslama: null, bitis: null }).hatalar.saat, metin);
});

test('saat_bos_metin_null_gibi', () => {
  const metin = 'Başlama ve bitiş saatini girin.';
  assert.equal(denetle({ baslama: '', bitis: '' }).hatalar.saat, metin);
  assert.equal(denetle({ baslama: '', bitis: '19:40' }).hatalar.saat, metin);
  assert.equal(denetle({ baslama: '17:00', bitis: '' }).hatalar.saat, metin);
  assert.equal(denetle({ tarih: '2026-10-10', baslama: '', bitis: '' }).hatalar.saat, metin);
  // Pazar: boş metin de hata değil.
  assert.equal(denetle({ tarih: '2026-10-11', baslama: '', bitis: '' }).gecerli, true);
});

test('bozuk_saat_bos_sayilir', () => {
  assert.equal(denetle({ baslama: 'abc', bitis: '19:40' }).hatalar.saat, 'Başlama ve bitiş saatini girin.');
  assert.equal(denetle({ baslama: '17:00', bitis: '25:00' }).hatalar.saat, 'Başlama ve bitiş saatini girin.');
});

test('pazar_saatsiz_gecerli', () => {
  const sonuc = denetle({ tarih: '2026-10-11', baslama: null, bitis: null });
  assert.equal(sonuc.gecerli, true);
  assert.deepEqual(sonuc.hatalar, {});
});

test('pazar_saatli_hata_degil', () => {
  assert.deepEqual(denetle({ tarih: '2026-10-11', baslama: '10:00', bitis: '12:00' }).hatalar, {});
  // Pazar günü saat kuralları (ters saat gibi) hiç işletilmez.
  assert.deepEqual(denetle({ tarih: '2026-10-11', baslama: '12:00', bitis: '10:00' }).hatalar, {});
});

test('her_alan_icin_tek_hata_ilki', () => {
  // Bugün, bitiş (22:00) başlamadan önce ve şimdiden (19:00) sonra: iki saat kuralı birden
  // bozuluyor, ama alan başına yalnızca ilki (tablodaki sıraya göre) yazılır.
  const sonuc = denetle({ tarih: '2026-10-14', baslama: '23:00', bitis: '22:00' });
  assert.equal(sonuc.hatalar.saat, 'Bitiş, başlamadan sonra olmalı.');
});

test('birden_fazla_alan_hatasi_birlikte', () => {
  const sonuc = satirDenetle({ tarih: '', calisanId: '', neden: '', baslama: null, bitis: null }, baglam);
  assert.equal(sonuc.gecerli, false);
  assert.equal(sonuc.hatalar.tarih, 'Tarih seçin.');
  assert.equal(sonuc.hatalar.calisan, 'Çalışan seçin.');
  assert.equal(sonuc.hatalar.neden, 'Mesai nedenini yazın.');
});

test('satirTemizle_pazar', () => {
  const temiz = satirTemizle({
    tarih: '2026-10-11', calisanId: 'c1', neden: '  X ', baslama: '10:00', bitis: '12:00',
  });
  assert.equal(temiz.baslama, null);
  assert.equal(temiz.bitis, null);
  assert.equal(temiz.neden, 'X');
  assert.equal(temiz.tarih, '2026-10-11');
  assert.equal(temiz.calisanId, 'c1');
});

test('satirTemizle_hafta_ici_saatleri_korur', () => {
  const temiz = satirTemizle(satir({ neden: ' Arıza  ' }));
  assert.equal(temiz.neden, 'Arıza');
  assert.equal(temiz.baslama, '17:00');
  assert.equal(temiz.bitis, '19:40');
});

test('satirTemizle_bos_metin_null_olur', () => {
  const temiz = satirTemizle(satir({ baslama: '', bitis: '' }));
  assert.equal(temiz.baslama, null);
  assert.equal(temiz.bitis, null);
});

test('satirTemizle_girdiyi_degistirmez', () => {
  const girdi = satir({ tarih: '2026-10-11', neden: '  X ' });
  satirTemizle(girdi);
  assert.equal(girdi.neden, '  X ');
  assert.equal(girdi.baslama, '17:00');
  assert.equal(girdi.bitis, '19:40');
});
