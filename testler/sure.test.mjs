import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fazlaMesaiDakika, sureYaz, toplamYaz } from '../uygulama/sure.js';

// Hafta içi fazla mesai 17:30'dan sonra sayılır (15 Ekim 2026'da 18:00'den 17:30'a alındı).
test('hafta_ici_1730_sonrasi', () => assert.equal(fazlaMesaiDakika('2026-10-14', '17:00', '19:40'), 130));
test('hafta_ici_1730_once_biter', () => assert.equal(fazlaMesaiDakika('2026-10-14', '16:00', '17:30'), 0));
test('hafta_ici_1730_den_sonra_baslar', () => assert.equal(fazlaMesaiDakika('2026-10-14', '18:30', '20:00'), 90));
test('hafta_ici_1730_sinir', () => {
  assert.equal(fazlaMesaiDakika('2026-10-14', '17:00', '18:00'), 30);
  assert.equal(fazlaMesaiDakika('2026-10-14', '17:30', '18:00'), 30);
  assert.equal(fazlaMesaiDakika('2026-10-14', '17:29', '17:31'), 1);
  assert.equal(fazlaMesaiDakika('2026-10-14', '17:45', '19:00'), 75);
});
test('cuma_da_hafta_ici_kurali', () => assert.equal(fazlaMesaiDakika('2026-10-16', '17:00', '18:00'), 30));
test('cumartesi_tamami', () => assert.equal(fazlaMesaiDakika('2026-10-17', '08:00', '12:15'), 255));
test('pazar_sifir', () => assert.equal(fazlaMesaiDakika('2026-10-18', null, null), 0));

test('sureYaz', () => {
  assert.equal(sureYaz(100), '1 saat 40 dakika');
  assert.equal(sureYaz(60), '1 saat');
  assert.equal(sureYaz(40), '40 dakika');
  assert.equal(sureYaz(0), '0 dakika');
});

test('toplamYaz', () => {
  assert.equal(toplamYaz(760, 2), '12 saat 40 dakika + 2 pazar');
  assert.equal(toplamYaz(760, 0), '12 saat 40 dakika');
  assert.equal(toplamYaz(0, 1), '1 pazar');
});
