import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ayToplamlari } from '../uygulama/toplamlar.js';

const calisanlar = [
  { id: 'c1', ad: 'Şule Öztürk', aktif: true },
  { id: 'c2', ad: 'Çağrı Işık', aktif: true },
  { id: 'c3', ad: 'Ali Veli', aktif: true },
  { id: 'c4', ad: 'Kaydı Olmayan', aktif: true },
];

// 2026-10-14 çarşamba, 2026-10-17 cumartesi, 2026-10-18 pazar
const satir = (id, calisanId, tarih, baslama, bitis) =>
  ({ id, tarih, calisanId, neden: 'Arıza', baslama, bitis });

test('ayToplamlari_turkce_siralama', () => {
  const satirlar = [
    satir('a', 'c1', '2026-10-14', '18:00', '19:00'),
    satir('b', 'c2', '2026-10-14', '18:00', '19:00'),
    satir('c', 'c3', '2026-10-14', '18:00', '19:00'),
  ];
  const sonuc = ayToplamlari(satirlar, calisanlar);
  assert.deepEqual(sonuc.map((s) => s.ad), ['Ali Veli', 'Çağrı Işık', 'Şule Öztürk']);
});

test('ayToplamlari_pazar_ayri', () => {
  const satirlar = [
    satir('a', 'c3', '2026-10-14', '17:00', '19:40'), // 130 dk (17:30 sonrası)
    satir('b', 'c3', '2026-10-18', null, null), // pazar
  ];
  const [kisi] = ayToplamlari(satirlar, calisanlar);
  assert.equal(kisi.calisanId, 'c3');
  assert.equal(kisi.dakika, 130);
  assert.equal(kisi.pazar, 1);
  assert.equal(kisi.yazi, '2 saat 10 dakika + 1 pazar');
});

test('ayToplamlari_kaydi_olmayan_calisan_yok', () => {
  const sonuc = ayToplamlari([satir('a', 'c3', '2026-10-17', '08:00', '12:15')], calisanlar);
  assert.equal(sonuc.length, 1);
  assert.equal(sonuc[0].calisanId, 'c3');
  assert.equal(sonuc[0].dakika, 255);
  assert.equal(sonuc[0].pazar, 0);
  assert.equal(sonuc[0].yazi, '4 saat 15 dakika');
});

test('ayToplamlari_ayni_kisinin_satirlari_toplanir', () => {
  const satirlar = [
    satir('a', 'c1', '2026-10-14', '18:00', '19:30'), // 90
    satir('b', 'c1', '2026-10-17', '09:00', '10:00'), // 60
    satir('c', 'c1', '2026-10-18', null, null),
    satir('d', 'c1', '2026-10-25', null, null),
  ];
  const [kisi] = ayToplamlari(satirlar, calisanlar);
  assert.equal(kisi.dakika, 150);
  assert.equal(kisi.pazar, 2);
  assert.equal(kisi.yazi, '2 saat 30 dakika + 2 pazar');
});

test('ayToplamlari_sadece_pazar', () => {
  const [kisi] = ayToplamlari([satir('a', 'c1', '2026-10-18', null, null)], calisanlar);
  assert.equal(kisi.dakika, 0);
  assert.equal(kisi.yazi, '1 pazar');
});

test('ayToplamlari_bos', () => {
  assert.deepEqual(ayToplamlari([], calisanlar), []);
});

test('ayToplamlari_listede_olmayan_calisan_cokmez', () => {
  const sonuc = ayToplamlari([satir('a', 'yok', '2026-10-14', '18:00', '19:00')], calisanlar);
  assert.equal(sonuc.length, 1);
  assert.equal(sonuc[0].ad, '');
  assert.equal(sonuc[0].dakika, 60);
});
