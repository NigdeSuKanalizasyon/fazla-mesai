import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OLCULER, SATIR_SAYISI } from '../uygulama/cikti.js';
import {
  pdfUret,
  pdfDosyaAdi,
  pdfPaylas,
  kutuphaneYukle,
  baytlarBase64,
} from '../uygulama/pdf.js';

// kutuphane/package.json ({"type":"commonjs"}) jsPDF'in UMD dosyasının Node'da CommonJS olarak yüklenmesini sağlar
// (kök package.json "module" olduğundan, o olmadan .js dosyası ES modülü sayılır ve jsPDF içe gelmez).
const { jsPDF } = createRequire(import.meta.url)('../kutuphane/jspdf.umd.min.js');
const b64 = (yol) => readFileSync(new URL(yol, import.meta.url)).toString('base64');
const yaziTipleri = {
  normal: b64('../kutuphane/figtree-400.ttf'),
  kalin: b64('../kutuphane/figtree-600.ttf'),
};

const calisanlar = [
  { id: 'c1', ad: 'Ali Veli', aktif: true },
  { id: 'c2', ad: 'Çağrı Işık', aktif: true },
  { id: 'c3', ad: 'Şule Öztürk', aktif: true },
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
  baslama: '18:00',
  bitis: '20:00',
  ...ek,
});
const satirlar = (n) => Array.from({ length: n }, (_, i) => satir(i));

const gecici = mkdtempSync(join(tmpdir(), 'fm-pdf-'));
after(() => rmSync(gecici, { recursive: true, force: true }));

let sayac = 0;
function uret(girdi = {}) {
  const bayt = pdfUret({
    jsPDF,
    yaziTipleri,
    satirlar: satirlar(1),
    calisanlar,
    ayarlar,
    tanzim: '2026-10-14',
    ...girdi,
  });
  const yol = join(gecici, `dosya-${sayac += 1}.pdf`);
  writeFileSync(yol, bayt);
  return { bayt, yol };
}
const metin = (yol) => execFileSync('pdftotext', ['-layout', yol, '-'], { encoding: 'utf8' });
const bilgi = (yol) => execFileSync('pdfinfo', [yol], { encoding: 'utf8' });
const say = (icinde, parca) => icinde.split(parca).length - 1;
const bosluksuz = (s) => s.replace(/\s+/g, ' ');

// pdftotext -bbox: sayfadaki her kelimenin kutusu (pt, sayfanın sol-üstünden).
function kelimeler(yol) {
  const html = execFileSync('pdftotext', ['-bbox', yol, '-'], { encoding: 'utf8' });
  return [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], s: m[5] }));
}
const pt = (mm) => (mm * 72) / 25.4;

test('pdf_sayfa_sayisi', () => {
  const { bayt, yol } = uret({ satirlar: satirlar(21) });
  assert.ok(bayt instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(bayt.slice(0, 5)), '%PDF-');
  const b = bilgi(yol);
  assert.match(b, /^Pages:\s+2$/m);
  assert.match(b, /^Page size:\s+841\.89 x 595\.28 pts/m);
});

test('pdf_sayfa_sayisi_sinirlar', () => {
  assert.match(bilgi(uret({ satirlar: [] }).yol), /^Pages:\s+1$/m); // boş form yine de çıkar
  assert.match(bilgi(uret({ satirlar: satirlar(20) }).yol), /^Pages:\s+1$/m);
  assert.match(bilgi(uret({ satirlar: satirlar(40) }).yol), /^Pages:\s+2$/m);
  assert.match(bilgi(uret({ satirlar: satirlar(41) }).yol), /^Pages:\s+3$/m);
});

test('pdf_turkce_harfler', () => {
  const { yol } = uret({
    calisanlar: [{ id: 'c1', ad: 'Çağrı Işık', aktif: true }],
    satirlar: [satir(1, { neden: 'Şebeke arızası İğdır' })],
  });
  const t = metin(yol);
  assert.ok(t.includes('Çağrı Işık'), 'ad');
  assert.ok(t.includes('Şebeke arızası İğdır'), 'neden');
});

test('pdf_turkce_harfler_hepsi', () => {
  const { yol } = uret({
    ayarlar: { ...ayarlar, bolumYazisi: 'ğşıİçöüĞŞÇÖÜ' },
  });
  assert.ok(metin(yol).includes('ğşıİçöüĞŞÇÖÜ'));
});

test('pdf_imza_her_sayfada', () => {
  const t = metin(uret({ satirlar: satirlar(21) }).yol);
  assert.equal(say(t, 'PUANTÖR'), 2);
  assert.equal(say(t, 'BÖLÜM AMİRİ'), 2);
  assert.equal(say(t, 'BÖLÜM MÜDÜRÜ'), 2);
});

test('pdf_imza_isimleri', () => {
  const t = metin(uret({ satirlar: satirlar(21) }).yol);
  // Üç ismin her biri imza kutusunda sayfa başına bir kez (satırlarda Ali Veli de geçer).
  assert.equal(say(t, 'Şule Öztürk'), 2);
  const sadeceImza = uret({ satirlar: [] });
  const ti = metin(sadeceImza.yol);
  assert.equal(say(ti, 'Şule Öztürk'), 1);
  assert.equal(say(ti, 'Çağrı Işık'), 1);
  assert.equal(say(ti, 'Ali Veli'), 1);
});

test('pdf_baslik_ve_tanzim_her_sayfada', () => {
  const t = bosluksuz(metin(uret({ satirlar: satirlar(21) }).yol));
  assert.equal(say(t, 'FAZLA MESAİ ÇİZELGESİ'), 2);
  assert.equal(say(t, 'TANZİM TARİHİ: 14.10.2026'), 2);
});

test('pdf_sutun_basliklari', () => {
  const t = bosluksuz(metin(uret().yol));
  for (const b of ['TARİH', 'ADI SOYADI', 'BÖLÜMÜ', 'MESAİ NEDENİ', 'İMZA']) {
    assert.ok(t.includes(b), b);
  }
  // Dar sütun başlıkları iki satırda (BAŞLAMA / SAATİ, BİTİŞ / SAATİ, F. MESAİ / SAATİ),
  // geniş sütunlarınki tek satırda.
  const k = kelimeler(uret().yol);
  const baslikUst = pt(OLCULER.kenar.ust + OLCULER.baslik.yukseklik);
  const govdeUst = baslikUst + pt(OLCULER.sutunBasligi.yukseklik);
  const baslikKelimeleri = k.filter((w) => w.y1 > baslikUst && w.y2 < govdeUst);
  let x = OLCULER.kenar.sol;
  OLCULER.sutunlar.forEach((s, i) => {
    const sol = pt(x);
    const sag = pt(x + s.genislik);
    x += s.genislik;
    const icinde = baslikKelimeleri.filter((w) => (w.x1 + w.x2) / 2 > sol && (w.x1 + w.x2) / 2 < sag);
    const satirSayisi = new Set(icinde.map((w) => Math.round(w.y1))).size;
    assert.equal(satirSayisi, i >= 4 && i <= 6 ? 2 : 1, `${s.baslik} başlığının satır sayısı`);
    for (const w of icinde) assert.ok(w.x1 >= sol && w.x2 <= sag, `${w.s} sütunun içinde`);
  });
});

test('pdf_satir_icerigi', () => {
  const { yol } = uret({
    satirlar: [
      satir(1, { calisanId: 'c2', neden: 'Pompa arızası' }),
      satir(2, { tarih: '2026-10-18', neden: 'Vardiya desteği', baslama: '', bitis: '' }), // pazar
    ],
  });
  const t = bosluksuz(metin(yol));
  assert.ok(t.includes('14.10.2026 Çağrı Işık Su ve Kanalizasyon Pompa arızası 18:00 20:00 2 saat'));
  assert.ok(t.includes('18.10.2026 Ali Veli Su ve Kanalizasyon Vardiya desteği PAZAR'));
  assert.equal(say(t, '18:00'), 1); // pazar satırında saat yok
});

test('pdf_yazi_tipi_gomulu', () => {
  const f = execFileSync('pdffonts', [uret().yol], { encoding: 'utf8' });
  // emb (gömülü) ve uni (ToUnicode) sütunları "yes": yazı tipi PDF'in içinde, metin kopyalanabilir.
  assert.match(f, /^Figtree\s+CID TrueType\s+Identity-H\s+yes\s+\w+\s+yes/m);
  assert.match(f, /^Figtree-SemiBold\s+CID TrueType\s+Identity-H\s+yes\s+\w+\s+yes/m);
});

test('pdf_olcuye_uygun', () => {
  // Yazdırma çıktısıyla aynı OLCULER: sütun başlıklarının ve ilk satırın yatay ortaları sütun ortasında.
  const { yol } = uret();
  const k = kelimeler(yol);
  const sol = OLCULER.kenar.sol;
  const orta = (kolon) => {
    let x = sol;
    for (let i = 0; i < kolon; i++) x += OLCULER.sutunlar[i].genislik;
    return pt(x + OLCULER.sutunlar[kolon].genislik / 2);
  };
  const merkez = (w) => (w.x1 + w.x2) / 2;
  const tarihBasligi = k.find((w) => w.s === 'TARİH');
  const imzaBasligi = k.find((w) => w.s === 'İMZA');
  const tarihDegeri = k.find((w) => w.s === '14.10.2026');
  assert.ok(Math.abs(merkez(tarihBasligi) - orta(0)) < 1, 'TARİH başlığı');
  assert.ok(Math.abs(merkez(imzaBasligi) - orta(7)) < 1, 'İMZA başlığı');
  assert.ok(Math.abs(merkez(tarihDegeri) - orta(0)) < 1, 'tarih değeri');
  // Başlık satırı, ilk gövde satırının üstünde; gövde satırı kendi bandında.
  const bandAlti = OLCULER.kenar.ust + OLCULER.baslik.yukseklik + OLCULER.sutunBasligi.yukseklik;
  assert.ok(tarihDegeri.y1 > pt(bandAlti) && tarihDegeri.y2 < pt(bandAlti + OLCULER.satir.yukseklik));
  // Başlık, 2.–6. sütunların ortasında.
  const baslikAlti = pt(OLCULER.kenar.ust + OLCULER.baslik.yukseklik);
  const baslik = k.filter((w) => (w.y1 + w.y2) / 2 < baslikAlti && ['FAZLA', 'MESAİ', 'ÇİZELGESİ'].includes(w.s));
  assert.equal(baslik.length, 3, 'başlığın üç kelimesi bantta');
  const bx = (Math.min(...baslik.map((w) => w.x1)) + Math.max(...baslik.map((w) => w.x2))) / 2;
  const solB = sol + OLCULER.sutunlar[0].genislik;
  const genB = OLCULER.sutunlar.slice(1, 6).reduce((t, s) => t + s.genislik, 0);
  assert.ok(Math.abs(bx - pt(solB + genB / 2)) < 2, 'başlık ortada');
});

// Sayfayı 200 dpi gri tonlamalı PGM olarak çizer; (mm, mm) noktasının koyu olup olmadığını söyler.
function sayfaGorseli(yol) {
  const onEk = yol.replace(/\.pdf$/, '');
  execFileSync('pdftoppm', ['-r', '200', '-gray', '-singlefile', '-f', '1', '-l', '1', yol, onEk]);
  const dosya = readFileSync(`${onEk}.pgm`);
  const baslik = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(dosya.subarray(0, 40).toString('latin1'));
  const en = +baslik[1];
  const boy = +baslik[2];
  const veri = dosya.subarray(dosya.length - en * boy);
  const pxMm = 200 / 25.4;
  const koyu = (xMm, yMm) => {
    const x = Math.round(xMm * pxMm);
    const y = Math.round(yMm * pxMm);
    return Math.min(veri[y * en + x - 1], veri[y * en + x], veri[y * en + x + 1]) < 100;
  };
  const acik = (xMm, yMm) => veri[Math.round(yMm * pxMm) * en + Math.round(xMm * pxMm)] > 200;
  return { en, boy, koyu, acik };
}

test('pdf_cizgiler_olcude', () => {
  // Boş form: yalnız çizgiler var. Her çizgi OLCULER'deki yerinde, hücre içleri beyaz.
  const g = sayfaGorseli(uret({ satirlar: [] }).yol);
  const o = OLCULER;
  const c = o.cizgi;
  const x0 = o.kenar.sol;
  const bantUst = o.kenar.ust;
  const baslikUst = bantUst + o.baslik.yukseklik;
  const govdeUst = baslikUst + o.sutunBasligi.yukseklik;
  const govdeAlt = govdeUst + SATIR_SAYISI * o.satir.yukseklik;
  const ortaSatir = govdeUst + o.satir.yukseklik * 4.5; // 5. gövde satırının ortası

  // Dikey çizgiler: sol kenar ve 8 sütunun sağ kenarı (gövdede).
  let x = x0;
  assert.ok(g.koyu(x0 + c / 2, ortaSatir), 'sol kenar');
  for (const s of o.sutunlar) {
    x += s.genislik;
    assert.ok(g.koyu(x - c / 2, ortaSatir), `${s.baslik} sağ çizgisi`);
    assert.ok(g.acik(x - s.genislik / 2, ortaSatir), `${s.baslik} hücre içi boş`);
  }
  // Başlık bandında yalnız 1., 6. ve 8. sütunun sağında çizgi var (2.–6. ve 7.–8. birleşik).
  const bandOrta = bantUst + o.baslik.yukseklik / 2;
  const sagKenar = (i) => x0 + o.sutunlar.slice(0, i + 1).reduce((t, s) => t + s.genislik, 0);
  for (const i of [0, 5, 7]) assert.ok(g.koyu(sagKenar(i) - c / 2, bandOrta), `bant ${i + 1}. sütun sağı`);
  for (const i of [1, 2, 3, 4, 6]) assert.ok(g.acik(sagKenar(i) - c / 2, bandOrta), `bantta ${i + 1}. sütun sağında çizgi yok`);

  // Yatay çizgiler: tablonun üstü, bandın altı, başlıkların altı, her gövde satırının altı.
  const yatay = [bantUst + c / 2, baslikUst - c / 2, govdeUst - c / 2];
  for (let i = 1; i <= SATIR_SAYISI; i++) yatay.push(govdeUst + i * o.satir.yukseklik - c / 2);
  assert.equal(yatay.length, 3 + SATIR_SAYISI);
  const yatayX = x0 + o.sutunlar[1].genislik / 2 + o.sutunlar[0].genislik;
  for (const y of yatay) assert.ok(g.koyu(yatayX, y), `yatay çizgi y=${y.toFixed(2)}`);
  assert.ok(g.acik(yatayX, govdeAlt + 0.8), 'tablonun altı boş'); // imza kutusu 5 mm aşağıda başlar

  // İmza tablosu: dört kutu (sonuncusu boş), her biri çizgili.
  const ix = x0 + o.imza.solBosluk;
  const iy = govdeAlt + o.imza.ustBosluk;
  const yuk = o.imza.baslikYuksekligi + o.imza.isimYuksekligi;
  const isimOrta = iy + o.imza.baslikYuksekligi + o.imza.isimYuksekligi / 2;
  assert.ok(g.koyu(ix + c / 2, isimOrta), 'imza sol kenar');
  let kx = ix;
  for (const k of o.imza.kutular) {
    kx += k.genislik;
    assert.ok(g.koyu(kx - c / 2, isimOrta), `imza kutusu sağ çizgisi x=${kx}`);
    assert.ok(g.koyu(kx - k.genislik / 2, iy + c / 2), 'imza üst çizgi');
    assert.ok(g.koyu(kx - k.genislik / 2, iy + o.imza.baslikYuksekligi - c / 2), 'imza başlık altı çizgi');
    assert.ok(g.koyu(kx - k.genislik / 2, iy + yuk - c / 2), 'imza alt çizgi');
  }
  assert.ok(g.acik(kx + 2, isimOrta), 'imza kutularının sağı boş');
});

test('pdf_uzun_metin_hucreyi_asmaz', () => {
  const uzunAd = 'Şule Öztürk Çağlayan Işıklı Gündoğdu Karaoğlanoğlu';
  const { yol } = uret({
    calisanlar: [{ id: 'c1', ad: uzunAd, aktif: true }],
    satirlar: [satir(1, { neden: 'Ş'.repeat(60) }), satir(2, { neden: 'Şebeke arızası nedeniyle İğdır hattında acil vana değişimi' })],
  });
  const k = kelimeler(yol);
  let x = OLCULER.kenar.sol;
  const sinir = OLCULER.sutunlar.map((s) => { const a = x; x += s.genislik; return [pt(a), pt(x)]; });
  const [adSol, adSag] = sinir[1];
  const [nedenSol, nedenSag] = sinir[3];
  const gövdeBasi = pt(OLCULER.kenar.ust + OLCULER.baslik.yukseklik + OLCULER.sutunBasligi.yukseklik);
  const gövde = k.filter((w) => w.y1 > gövdeBasi && w.y1 < gövdeBasi + pt(OLCULER.satir.yukseklik * 2));
  const ad = gövde.filter((w) => w.x1 >= adSol && w.x2 <= adSag + 0.01 && uzunAd.includes(w.s));
  assert.ok(ad.length >= 3, 'ad hücrede');
  for (const w of gövde.filter((w2) => w2.x1 > nedenSol - 0.5 && w2.x1 < nedenSag && w2.s.includes('Ş'))) {
    assert.ok(w.x2 <= nedenSag, `neden hücreden taşmaz: ${w.s}`);
  }
  // Satır yüksekliğine sığar: hiçbir kelime kendi satırının dışına çıkmaz.
  for (const w of k.filter((w2) => w2.y1 > gövdeBasi && w2.y1 < gövdeBasi + pt(OLCULER.satir.yukseklik * 2))) {
    const idx = Math.floor((w.y1 - gövdeBasi) / pt(OLCULER.satir.yukseklik));
    const ust = gövdeBasi + idx * pt(OLCULER.satir.yukseklik);
    assert.ok(w.y2 <= ust + pt(OLCULER.satir.yukseklik) + 0.5, `satıra sığar: ${w.s}`);
  }
});

test('pdf_en_fazla_iki_satir', () => {
  const cokUzun = 'Pompa istasyonu '.repeat(12).trim(); // 60 karakterin çok üstünde: 3+ satıra sarardı
  const { yol } = uret({ satirlar: [satir(1, { neden: cokUzun })] });
  const t = metin(yol);
  const nedenSatirlari = t.split('\n').filter((s) => s.includes('Pompa istasyonu'));
  assert.ok(nedenSatirlari.length >= 1 && nedenSatirlari.length <= 2, `satır sayısı ${nedenSatirlari.length}`);
  assert.ok(t.includes('…'), 'kesilince üç nokta');
});

test('pdf_satir_sonu_bosluk_sayilir', () => {
  const { yol } = uret({ satirlar: [satir(1, { neden: 'Pompa\n  arızası' })] });
  const t = metin(yol);
  assert.ok(t.split('\n').some((s) => s.includes('Pompa arızası')), 'tek satırda, tek boşlukla');
});

test('pdf_sure_dar_sutunda_iki_satir', () => {
  // "1 saat 40 dakika" dar sütunda iki satıra sarar ("1 saat 40" / "dakika"), satırdan taşmaz.
  const { yol } = uret({ satirlar: [satir(1, { baslama: '17:00', bitis: '19:40' })] });
  const t = bosluksuz(metin(yol));
  assert.ok(t.includes('1 saat 40'));
  assert.ok(t.includes('dakika'));
});

test('pdfDosyaAdi', () => {
  assert.equal(pdfDosyaAdi('2026-10'), 'Fazla_Mesai_2026-10.pdf');
  assert.equal(pdfDosyaAdi('2027-01'), 'Fazla_Mesai_2027-01.pdf');
});

test('baytlarBase64', () => {
  const bayt = new Uint8Array(100000).map((_, i) => (i * 31) % 256); // parçalı dönüştürme sınırını aşar
  assert.equal(baytlarBase64(bayt.buffer), Buffer.from(bayt).toString('base64'));
  assert.equal(baytlarBase64(new Uint8Array(0).buffer), '');
});

test('tarayici_islevleri_node_da_ice_aktarilir', () => {
  assert.equal(typeof pdfPaylas, 'function');
  assert.equal(typeof kutuphaneYukle, 'function');
});

// --- pdfPaylas: tarayıcı API'leri sahtelerle ---------------------------------
// dokunmatik: matchMedia('(pointer: coarse)') sonucu (telefon/tablet true, bilgisayar false); null: matchMedia yok.
function sahteTarayici({ canShare, share, dokunmatik = true }) {
  const eskiNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const eskiDoc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const eskiMedya = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const olaylar = [];
  Object.defineProperty(globalThis, 'navigator', { value: { canShare, share }, configurable: true, writable: true });
  if (dokunmatik !== null) {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (sorgu) => ({ media: sorgu, matches: sorgu === '(pointer: coarse)' ? dokunmatik : !dokunmatik }),
    });
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      createElement: () => ({
        click() { olaylar.push(['tikla', this.download, this.href]); },
        remove() { olaylar.push(['kaldir']); },
        set hidden(v) {},
      }),
      body: { append() {} },
    },
  });
  return {
    olaylar,
    geri() {
      if (eskiNav) Object.defineProperty(globalThis, 'navigator', eskiNav); else delete globalThis.navigator;
      if (eskiDoc) Object.defineProperty(globalThis, 'document', eskiDoc); else delete globalThis.document;
      if (eskiMedya) Object.defineProperty(globalThis, 'matchMedia', eskiMedya); else delete globalThis.matchMedia;
    },
  };
}
const bayt = new Uint8Array([37, 80, 68, 70]);

test('pdfPaylas_paylasir', async () => {
  const paylasilanlar = [];
  const t = sahteTarayici({
    canShare: () => true,
    share: async (v) => { paylasilanlar.push(v); },
  });
  try {
    assert.equal(await pdfPaylas(bayt, 'Fazla_Mesai_2026-10.pdf'), 'paylasildi');
    assert.equal(paylasilanlar.length, 1);
    assert.equal(paylasilanlar[0].files[0].name, 'Fazla_Mesai_2026-10.pdf');
    assert.equal(paylasilanlar[0].files[0].type, 'application/pdf');
    assert.equal(t.olaylar.length, 0, 'indirme tetiklenmez');
  } finally { t.geri(); }
});

test('pdfPaylas_vazgecildi', async () => {
  const t = sahteTarayici({
    canShare: () => true,
    share: async () => { throw Object.assign(new Error('iptal'), { name: 'AbortError' }); },
  });
  try {
    assert.equal(await pdfPaylas(bayt, 'a.pdf'), 'vazgecildi');
    assert.equal(t.olaylar.length, 0);
  } finally { t.geri(); }
});

test('pdfPaylas_indirir_paylasim_yoksa', async () => {
  const t = sahteTarayici({ canShare: undefined, share: undefined });
  try {
    assert.equal(await pdfPaylas(bayt, 'Fazla_Mesai_2026-10.pdf'), 'indirildi');
    assert.equal(t.olaylar[0][0], 'tikla');
    assert.equal(t.olaylar[0][1], 'Fazla_Mesai_2026-10.pdf');
    assert.match(t.olaylar[0][2], /^blob:/);
  } finally { t.geri(); }
});

test('pdfPaylas_dosya_paylasimi_desteklenmiyorsa_indirir', async () => {
  const t = sahteTarayici({ canShare: () => false, share: async () => { throw new Error('çağrılmamalı'); } });
  try {
    assert.equal(await pdfPaylas(bayt, 'a.pdf'), 'indirildi');
  } finally { t.geri(); }
});

test('pdfPaylas_beklenmeyen_hatada_indirmeye_duser', async () => {
  const t = sahteTarayici({
    canShare: () => true,
    share: async () => { throw Object.assign(new Error('desteklenmiyor'), { name: 'DataError' }); },
  });
  try {
    assert.equal(await pdfPaylas(bayt, 'a.pdf'), 'indirildi');
    assert.equal(t.olaylar[0][0], 'tikla');
  } finally { t.geri(); }
});

// F7: bilgisayarda (fare, pointer: fine) paylaşım olsa da PDF iner; işletim sisteminin paylaş penceresi açılmaz.
test('pdfPaylas_bilgisayarda_paylasim_olsa_da_indirir', async () => {
  let paylasim = 0;
  const t = sahteTarayici({ dokunmatik: false, canShare: () => true, share: async () => { paylasim++; } });
  try {
    assert.equal(await pdfPaylas(bayt, 'Fazla_Mesai_2026-10.pdf'), 'indirildi');
    assert.equal(paylasim, 0, 'paylaş penceresi açılmaz');
    assert.deepEqual(t.olaylar.map((o) => o.slice(0, 2)), [['tikla', 'Fazla_Mesai_2026-10.pdf'], ['kaldir']]);
  } finally { t.geri(); }
});

test('pdfPaylas_matchMedia_yoksa_indirir', async () => {
  let paylasim = 0;
  const t = sahteTarayici({ dokunmatik: null, canShare: () => true, share: async () => { paylasim++; } });
  try {
    assert.equal(await pdfPaylas(bayt, 'a.pdf'), 'indirildi');
    assert.equal(paylasim, 0);
  } finally { t.geri(); }
});

// F6: paylaşma izni düştü (dokunuştan bu yana çok zaman geçti, yavaş bağlantı): PDF sessizce inmez, 'izin-yok'
// döner; çağıran "Gönder" düğmesi gösterir, yeni dokunuşla { yeniden: true } ile yeniden paylaşır.
test('pdfPaylas_izin_yoksa_indirmez_izin_yok_doner', async () => {
  const paylasilanlar = [];
  const t = sahteTarayici({
    canShare: () => true,
    share: async (v) => {
      paylasilanlar.push(v.files[0]);
      if (paylasilanlar.length === 1) throw Object.assign(new Error('izin yok'), { name: 'NotAllowedError' });
    },
  });
  try {
    assert.equal(await pdfPaylas(bayt, 'Fazla_Mesai_2026-10.pdf'), 'izin-yok');
    assert.equal(t.olaylar.length, 0, 'indirme tetiklenmez');
    assert.equal(await pdfPaylas(bayt, 'Fazla_Mesai_2026-10.pdf', { yeniden: true }), 'paylasildi');
    assert.equal(paylasilanlar.length, 2);
    assert.deepEqual(new Uint8Array(await paylasilanlar[1].arrayBuffer()), bayt);
    assert.equal(t.olaylar.length, 0);
  } finally { t.geri(); }
});

test('pdfPaylas_yeniden_denemede_izin_yine_yoksa_indirir', async () => {
  const t = sahteTarayici({
    canShare: () => true,
    share: async () => { throw Object.assign(new Error('izin yok'), { name: 'NotAllowedError' }); },
  });
  try {
    assert.equal(await pdfPaylas(bayt, 'a.pdf', { yeniden: true }), 'indirildi'); // ör. çerçeve izni yok
    assert.equal(t.olaylar[0][0], 'tikla');
  } finally { t.geri(); }
});
