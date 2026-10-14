import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fazlaMesaiDakika, sureYaz, toplamYaz } from '../uygulama/sure.js';

test('hafta_ici_18_sonrasi', () => assert.equal(fazlaMesaiDakika('2026-10-14', '17:00', '19:40'), 100));
test('hafta_ici_18_once_biter', () => assert.equal(fazlaMesaiDakika('2026-10-14', '16:00', '17:30'), 0));
test('hafta_ici_18_den_baslar', () => assert.equal(fazlaMesaiDakika('2026-10-14', '18:30', '20:00'), 90));
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
