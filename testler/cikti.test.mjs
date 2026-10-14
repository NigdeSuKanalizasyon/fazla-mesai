import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SATIR_SAYISI,
  OLCULER,
  ciktiSatirlari,
  sayfalaraBol,
  ciktiHtml,
  olcuDegiskenleri,
} from '../uygulama/cikti.js';

const calisanlar = [
  { id: 'c1', ad: 'Ali Veli', aktif: true },
  { id: 'c2', ad: 'Çağrı Işık', aktif: true },
];
const ayarlar = {
  bolumYazisi: 'Su ve Kanalizasyon',
  imza: { bolumAmiri: 'Şule Öztürk', puantor: 'Çağrı Işık', bolumMuduru: 'Ali Veli' },
};
const satir = (i, ek = {}) => ({
  id: `s${i}`,
  tarih: '2026-10-14', // çarşamba
  calisanId: 'c1',
  neden: 'Şebeke arızası',
  baslama: '17:00',
  bitis: '19:40',
  ...ek,
});
const satirlar = (n) => Array.from({ length: n }, (_, i) => satir(i));
const say = (metin, parca) => metin.split(parca).length - 1;

test('SATIR_SAYISI_yirmi', () => assert.equal(SATIR_SAYISI, 20));

test('sayfalaraBol', () => {
  const bos = sayfalaraBol([]);
  assert.equal(bos.length, 1);
  assert.equal(bos[0].length, 20);
  assert.ok(bos[0].every((x) => x === null));

  assert.equal(sayfalaraBol(Array(20).fill(1)).length, 1);

  const yirmibir = sayfalaraBol(Array.from({ length: 21 }, (_, i) => i));
  assert.equal(yirmibir.length, 2);
  assert.equal(yirmibir[0].length, 20);
  assert.equal(yirmibir[1].length, 20);
  assert.equal(yirmibir[1].filter((x) => x !== null).length, 1);
  assert.equal(yirmibir[1].filter((x) => x === null).length, 19);
  assert.equal(yirmibir[1][0], 20);

  assert.equal(sayfalaraBol(Array(45).fill(1)).length, 3);
});

test('sayfalaraBol_ozel_n', () => {
  assert.deepEqual(sayfalaraBol([1, 2, 3], 2), [[1, 2], [3, null]]);
});

test('ciktiSatirlari_hafta_ici', () => {
  const [s] = ciktiSatirlari([satir(1)], calisanlar, ayarlar);
  assert.deepEqual(s, {
    tarih: '14.10.2026',
    ad: 'Ali Veli',
    bolum: 'Su ve Kanalizasyon',
    neden: 'Şebeke arızası',
    baslama: '17:00',
    bitis: '19:40',
    fm: '1 saat 40 dakika',
  });
});

test('ciktiSatirlari_pazar', () => {
  const pazar = satir(1, { tarih: '2026-10-18', baslama: null, bitis: null });
  const [s] = ciktiSatirlari([pazar], calisanlar, ayarlar);
  assert.equal(s.fm, 'PAZAR');
  assert.equal(s.baslama, '');
  assert.equal(s.bitis, '');
  assert.equal(s.tarih, '18.10.2026');
});

test('ciktiSatirlari_girdi_sirasini_korur', () => {
  const girdi = [
    satir(1, { tarih: '2026-10-20', calisanId: 'c2' }),
    satir(2, { tarih: '2026-10-14' }),
  ];
  const cikti = ciktiSatirlari(girdi, calisanlar, ayarlar);
  assert.deepEqual(cikti.map((s) => s.tarih), ['20.10.2026', '14.10.2026']);
  assert.deepEqual(cikti.map((s) => s.ad), ['Çağrı Işık', 'Ali Veli']);
});

test('ciktiSatirlari_bilinmeyen_calisan_bos_ad', () => {
  const [s] = ciktiSatirlari([satir(1, { calisanId: 'yok' })], calisanlar, ayarlar);
  assert.equal(s.ad, '');
});

test('OLCULER_sayfa_ve_sutunlar', () => {
  assert.equal(OLCULER.sayfa.genislik, 297);
  assert.equal(OLCULER.sayfa.yukseklik, 210);
  assert.deepEqual(
    OLCULER.sutunlar.map((s) => s.baslik),
    ['TARİH', 'ADI SOYADI', 'BÖLÜMÜ', 'MESAİ NEDENİ', 'BAŞLAMA SAATİ', 'BİTİŞ SAATİ', 'F. MESAİ SAATİ', 'İMZA'],
  );
  const toplam = OLCULER.sutunlar.reduce((t, s) => t + s.genislik, 0);
  assert.ok(Math.abs(toplam - (OLCULER.sayfa.genislik - OLCULER.kenar.sol - OLCULER.kenar.sag)) < 1e-9);
  assert.ok(Math.abs(toplam - OLCULER.tabloGenislik) < 1e-9);
});

test('OLCULER_sayfaya_sigar', () => {
  const o = OLCULER;
  const imza = o.imza.ustBosluk + o.imza.baslikYuksekligi + o.imza.isimYuksekligi;
  const toplam = o.kenar.ust + o.baslik.yukseklik + o.sutunBasligi.yukseklik
    + SATIR_SAYISI * o.satir.yukseklik + imza + o.kenar.alt;
  assert.ok(toplam <= o.sayfa.yukseklik + 1e-9, `${toplam} > ${o.sayfa.yukseklik}`);
  const imzaGenislik = o.imza.solBosluk + o.imza.kutular.reduce((t, k) => t + k.genislik, 0);
  assert.ok(imzaGenislik <= o.tabloGenislik + 1e-9);
});

test('ciktiHtml_sayfa_ve_imza', () => {
  const html = ciktiHtml({ satirlar: satirlar(21), calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.equal(say(html, 'cikti-sayfa'), 2);
  assert.equal(say(html, 'PUANTÖR'), 2);
  assert.equal(say(html, 'BÖLÜM AMİRİ'), 2);
  assert.equal(say(html, 'BÖLÜM MÜDÜRÜ'), 2);
  assert.equal(say(html, 'FAZLA MESAİ ÇİZELGESİ'), 2);
  assert.equal(say(html, 'TANZİM TARİHİ: 14.10.2026'), 2);
});

test('ciktiHtml_basliklar_ve_imza_isimleri', () => {
  const html = ciktiHtml({ satirlar: satirlar(1), calisanlar, ayarlar, tanzim: '2026-10-14' });
  for (const b of ['TARİH', 'ADI SOYADI', 'BÖLÜMÜ', 'MESAİ NEDENİ', 'BAŞLAMA SAATİ', 'BİTİŞ SAATİ', 'F. MESAİ SAATİ', 'İMZA']) {
    assert.ok(html.includes(b), b);
  }
  assert.ok(html.includes('Şule Öztürk'));
  assert.ok(html.includes('Ali Veli'));
});

test('ciktiHtml_bos_liste_bir_bos_sayfa', () => {
  const html = ciktiHtml({ satirlar: [], calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.equal(say(html, 'cikti-sayfa'), 1);
  assert.equal(say(html, 'PUANTÖR'), 1);
  assert.equal(say(html, 'class="cikti-satir cikti-govde"'), 20);
});

test('ciktiHtml_her_sayfada_yirmi_satir', () => {
  const html = ciktiHtml({ satirlar: satirlar(21), calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.equal(say(html, 'class="cikti-satir cikti-govde"'), 40);
});

test('ciktiHtml_bolum_ve_sure_satira_yazilir', () => {
  const html = ciktiHtml({ satirlar: satirlar(1), calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.ok(html.includes('Su ve Kanalizasyon'));
  assert.ok(html.includes('1 saat 40 dakika'));
  assert.ok(html.includes('14.10.2026'));
});

test('ciktiHtml_pazar_satiri', () => {
  const pazar = satir(1, { tarih: '2026-10-18', baslama: null, bitis: null });
  const html = ciktiHtml({ satirlar: [pazar], calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.ok(html.includes('PAZAR'));
  assert.ok(!html.includes('null'));
});

test('ciktiHtml_kacis', () => {
  const html = ciktiHtml({
    satirlar: [satir(1, { neden: '<b>x</b>' })],
    calisanlar,
    ayarlar,
    tanzim: '2026-10-14',
  });
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(!html.includes('<b>x</b>'));
});

test('ciktiHtml_kacis_tum_alanlar', () => {
  const kotu = '<i>&"x"</i>';
  const html = ciktiHtml({
    satirlar: [satir(1, { neden: kotu })],
    calisanlar: [{ id: 'c1', ad: kotu, aktif: true }],
    ayarlar: { bolumYazisi: kotu, imza: { bolumAmiri: kotu, puantor: kotu, bolumMuduru: kotu } },
    tanzim: '2026-10-14',
  });
  assert.ok(!html.includes('<i>'));
  assert.ok(!html.includes('"x"'));
  assert.ok(html.includes('&lt;i&gt;&amp;&quot;x&quot;&lt;/i&gt;'));
});

test('ciktiHtml_olculer_css_degiskeni_olarak', () => {
  const html = ciktiHtml({ satirlar: satirlar(1), calisanlar, ayarlar, tanzim: '2026-10-14' });
  assert.match(html, /<section class="cikti-sayfa"[^>]* style="[^"]*--sayfa-genislik:297mm/);
  assert.match(html, /--satir-yukseklik:/);
  assert.match(html, /--sutun-8:/);
});

test('ciktiHtml_eksik_ayar_cokmez', () => {
  const html = ciktiHtml({ satirlar: satirlar(1), calisanlar, ayarlar: {}, tanzim: '2026-10-14' });
  assert.equal(say(html, 'PUANTÖR'), 1);
  assert.ok(!html.includes('undefined'));
});

test('stil_css_yazdirma_kurallari', () => {
  const css = readFileSync(new URL('../stil.css', import.meta.url), 'utf8');
  assert.ok(css.includes('@page { size: A4 landscape; margin: 0 }'));
  assert.ok(css.includes('@media print'));
  assert.match(css, /\.cikti-sayfa\s*\{[^}]*page-break-after:\s*always/);
  assert.match(css, /\.cikti-sayfa:last-of-type\s*\{[^}]*page-break-after:\s*auto/);
});

test('stil_css_degiskenleri_OLCULER_den_gelir', () => {
  const css = readFileSync(new URL('../stil.css', import.meta.url), 'utf8');
  const tanimli = new Set(olcuDegiskenleri().split(';').map((d) => d.split(':')[0]));
  const kullanilan = [...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
  assert.ok(kullanilan.length > 20);
  const eksik = kullanilan.filter((d) => !tanimli.has(d));
  assert.deepEqual(eksik, []);
});
