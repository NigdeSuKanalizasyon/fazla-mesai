import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../stil.css', import.meta.url), 'utf8');
const ciktiBasi = css.indexOf('Çıktı: FAZLA MESAİ ÇİZELGESİ');
const ekran = ciktiBasi > 0 ? css.slice(0, css.lastIndexOf('/*', ciktiBasi)) : '';

// Uygulamalar mağazasının renkleri: açık tema ve koyu tema.
const ACIK = {
  '--zemin': '#F3F6F4', '--yuzey': '#FFFFFF', '--murekkep': '#16302B', '--soluk': '#5A6E68',
  '--boru': '#1F6B4F', '--dugum': '#C49A2C', '--cizgi': '#D5DED9', '--vurgu-zemin': '#E6F0EB',
  '--odak': '#2B7A9E',
};
const KOYU = {
  '--zemin': '#0F1C19', '--yuzey': '#152622', '--murekkep': '#E6EEEA', '--soluk': '#9DB0A9',
  '--boru': '#3FA27A', '--dugum': '#D9B04A', '--cizgi': '#24392F', '--vurgu-zemin': '#1B3029',
};

function blok(metin, bas) {
  const i = metin.indexOf(bas);
  assert.ok(i >= 0, `${bas} yok`);
  return metin.slice(i, metin.indexOf('}', i));
}

test('stil_ekran_bolumu_cikti_bolumunden_once', () => {
  assert.ok(ciktiBasi > 0, 'çıktı bölümü yok');
  assert.ok(ekran.length > 0);
  assert.ok(ekran.includes(':root'));
});

test('stil_magaza_renkleri', () => {
  const acik = blok(ekran, ':root {');
  for (const [ad, deger] of Object.entries(ACIK)) assert.ok(acik.includes(`${ad}: ${deger};`), ad);
  const koyu = blok(ekran.slice(ekran.indexOf('prefers-color-scheme: dark')), ':root {');
  for (const [ad, deger] of Object.entries(KOYU)) assert.ok(koyu.includes(`${ad}: ${deger};`), ad);
});

test('stil_ekran_degiskenleri_tanimli', () => {
  const tanimli = new Set([...ekran.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const eksik = [...ekran.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((d) => !tanimli.has(d));
  assert.deepEqual(eksik, []);
});

test('stil_yazi_tipleri_depodan', () => {
  const kaynaklar = [...ekran.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1]);
  assert.deepEqual(kaynaklar.sort(), [
    'kutuphane/yazitipi/bricolage-grotesque-latin-700-normal.woff2',
    'kutuphane/yazitipi/bricolage-grotesque-latin-ext-700-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-400-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-500-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-600-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-ext-400-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-ext-500-normal.woff2',
    'kutuphane/yazitipi/figtree-latin-ext-600-normal.woff2',
  ]);
  assert.equal((ekran.match(/@font-face/g) ?? []).length, 8);
  assert.equal((ekran.match(/unicode-range/g) ?? []).length, 8);
  assert.ok(!/https?:\/\//.test(css), 'dış adres yok');
});

test('stil_hareket_azaltma_ve_odak', () => {
  assert.ok(ekran.includes('prefers-reduced-motion: reduce'));
  assert.ok(ekran.includes(':focus-visible'));
});
