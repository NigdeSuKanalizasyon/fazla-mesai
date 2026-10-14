import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istanbulSimdi, haftaGunu, ayAnahtari, ayKaydir, ayAdi, tarihYaz } from '../uygulama/tarih.js';

test('istanbulSimdi_gece_yarisi', () => {
  assert.deepEqual(istanbulSimdi(new Date('2026-10-14T21:30:00Z')), { tarih: '2026-10-15', saat: '00:30' });
});

test('haftaGunu', () => {
  assert.equal(haftaGunu('2026-10-12'), 1);
  assert.equal(haftaGunu('2026-10-17'), 6);
  assert.equal(haftaGunu('2026-10-18'), 7);
});

test('ayAnahtari', () => assert.equal(ayAnahtari('2026-10-14'), '2026-10'));

test('ayKaydir_yil_gecisi', () => {
  assert.equal(ayKaydir('2026-12', 1), '2027-01');
  assert.equal(ayKaydir('2026-01', -1), '2025-12');
});

test('ayAdi', () => assert.equal(ayAdi('2026-10'), 'Ekim 2026'));

test('tarihYaz', () => assert.equal(tarihYaz('2026-10-05'), '05.10.2026'));
