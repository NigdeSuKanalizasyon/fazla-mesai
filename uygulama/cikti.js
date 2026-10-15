// Çıktı: "FAZLA MESAİ ÇİZELGESİ" kâğıt formunun aynısı (yatay A4, sayfada 20 satır).
// DOM yok; Node'da test edilir. Yazdırma CSS'i (stil.css) ve PDF (pdf.js) aynı
// OLCULER nesnesinden beslenir, geometri başka hiçbir yerde tekrarlanmaz.
import { fazlaMesaiDakika, sureYaz } from './sure.js';
import { haftaGunu, tarihYaz } from './tarih.js';

export const SATIR_SAYISI = 20;

// BÖLÜMÜ sütununa her satırda yazılan sabit yazı. Ayarlardan değiştirilmez; eski sürümün
// ayarlar.json'a yazdığı bolumYazisi alanı kullanılmaz.
export const BOLUM_YAZISI = 'Su ve Kanalizasyon';

// Ortak ölçüler. Uzunluklar mm, yazı boyları pt. Orijinal kâğıt formun fotoğrafından
// ölçülüp yaklaşık olarak alınmıştır; sütun oranları: TARİH %9, ADI SOYADI %22,
// BÖLÜMÜ %21, MESAİ NEDENİ %22, BAŞLAMA/BİTİŞ/F. MESAİ %5,5, İMZA %9,5.
//
// Yerleşim, sayfanın sol-üst köşesinden aşağı doğru (hepsi kenar boşluklarının içinde):
//   baslik        başlık bandı: [boş: TARİH sütunu] [FAZLA MESAİ ÇİZELGESİ: sütun 2-6]
//                 [TANZİM TARİHİ: sütun 7-8]
//   sutunBasligi  sekiz sütun başlığı satırı (dar sütunlarda başlık iki satıra sarar)
//   satir         SATIR_SAYISI adet gövde satırı, her biri bu yükseklikte
//   imza          tablonun altında, sol kenarından solBosluk içeride; kutular
//                 (üstte başlık, altta isim) soldan sağa dizilir. Kâğıtta dördüncü
//                 kutu başlıksız ve boştur; ona da yer verilir (genişliği ile).
export const OLCULER = Object.freeze({
  // Kâğıt (A4 yatay). pay: bölümün yüksekliğinden düşülen küçük fark; tarayıcı/yazıcı
  // yuvarlamasının fazladan boş sayfa üretmesini önler.
  sayfa: Object.freeze({ genislik: 297, yukseklik: 210, pay: 0.3 }),
  // Kenar boşlukları (tablo bu boşlukların içinde başlar).
  kenar: Object.freeze({ ust: 12, sag: 14.5, alt: 10, sol: 14.5 }),
  // Tablonun genişliği = sayfa − sol − sağ = sütun genişliklerinin toplamı.
  tabloGenislik: 268,
  baslik: Object.freeze({ yukseklik: 14 }),
  sutunBasligi: Object.freeze({ yukseklik: 8 }),
  satir: Object.freeze({ yukseklik: 7 }),
  // Soldan sağa sekiz sütun. baslik: ekranda/PDF'te yazılacak başlık metni.
  sutunlar: Object.freeze([
    Object.freeze({ ad: 'tarih', baslik: 'TARİH', genislik: 24 }),
    Object.freeze({ ad: 'ad', baslik: 'ADI SOYADI', genislik: 59 }),
    Object.freeze({ ad: 'bolum', baslik: 'BÖLÜMÜ', genislik: 56 }),
    Object.freeze({ ad: 'neden', baslik: 'MESAİ NEDENİ', genislik: 59 }),
    Object.freeze({ ad: 'baslama', baslik: 'BAŞLAMA SAATİ', genislik: 15 }),
    Object.freeze({ ad: 'bitis', baslik: 'BİTİŞ SAATİ', genislik: 15 }),
    Object.freeze({ ad: 'fm', baslik: 'F. MESAİ SAATİ', genislik: 15 }),
    Object.freeze({ ad: 'imza', baslik: 'İMZA', genislik: 25 }),
  ]),
  // İmza kutuları. ayar: ayarlar.imza içindeki anahtar (null: boş kutu).
  imza: Object.freeze({
    solBosluk: 52,
    ustBosluk: 5,
    baslikYuksekligi: 6,
    isimYuksekligi: 11,
    kutular: Object.freeze([
      Object.freeze({ baslik: 'BÖLÜM AMİRİ', ayar: 'bolumAmiri', genislik: 43 }),
      Object.freeze({ baslik: 'PUANTÖR', ayar: 'puantor', genislik: 57 }),
      Object.freeze({ baslik: 'BÖLÜM MÜDÜRÜ', ayar: 'bolumMuduru', genislik: 57 }),
      Object.freeze({ baslik: '', ayar: null, genislik: 43 }),
    ]),
  }),
  // Çizgi kalınlığı (mm) ve hücre içi yatay boşluk (mm).
  cizgi: 0.35,
  hucreBosluk: 0.8,
  // Yazı boyları (pt) ve satır aralığı (çarpan). Başlıklar kalın, gövde normal.
  yazi: Object.freeze({
    baslik: 34, // FAZLA MESAİ ÇİZELGESİ
    tanzim: 7, // TANZİM TARİHİ: ...
    sutunBasligi: 7.5,
    govde: 8, // tarih, ad, bölüm, neden, saatler
    sure: 7, // F. MESAİ SAATİ (dar sütun, iki satıra sarabilir)
    imza: 8, // imza kutusu başlık ve isimleri
    satirAraligi: 1.1,
  }),
});

// stil.css'in kullandığı CSS değişkenleri. Her sayfa elementine style="..." olarak yazılır.
export function olcuDegiskenleri(o = OLCULER) {
  const mm = (n) => `${n}mm`;
  const pt = (n) => `${n}pt`;
  const degiskenler = {
    'sayfa-genislik': mm(o.sayfa.genislik),
    'sayfa-yukseklik': mm(o.sayfa.yukseklik),
    'sayfa-pay': mm(o.sayfa.pay),
    'kenar-ust': mm(o.kenar.ust),
    'kenar-sag': mm(o.kenar.sag),
    'kenar-alt': mm(o.kenar.alt),
    'kenar-sol': mm(o.kenar.sol),
    'tablo-genislik': mm(o.tabloGenislik),
    'baslik-yukseklik': mm(o.baslik.yukseklik),
    'sutun-basligi-yukseklik': mm(o.sutunBasligi.yukseklik),
    'satir-yukseklik': mm(o.satir.yukseklik),
    'imza-sol-bosluk': mm(o.imza.solBosluk),
    'imza-ust-bosluk': mm(o.imza.ustBosluk),
    'imza-baslik-yukseklik': mm(o.imza.baslikYuksekligi),
    'imza-isim-yukseklik': mm(o.imza.isimYuksekligi),
    cizgi: mm(o.cizgi),
    'hucre-bosluk': mm(o.hucreBosluk),
    'yazi-baslik': pt(o.yazi.baslik),
    'yazi-tanzim': pt(o.yazi.tanzim),
    'yazi-sutun-basligi': pt(o.yazi.sutunBasligi),
    'yazi-govde': pt(o.yazi.govde),
    'yazi-sure': pt(o.yazi.sure),
    'yazi-imza': pt(o.yazi.imza),
    'yazi-satir-araligi': String(o.yazi.satirAraligi),
  };
  o.sutunlar.forEach((s, i) => { degiskenler[`sutun-${i + 1}`] = mm(s.genislik); });
  o.imza.kutular.forEach((k, i) => { degiskenler[`imza-${i + 1}`] = mm(k.genislik); });
  return Object.entries(degiskenler).map(([ad, deger]) => `--${ad}:${deger}`).join(';');
}

// Çıktı satırları: ekranda/PDF'te yazılacak hazır metinler.
//   tarih  'GG.AA.YYYY'   fm  sureYaz(...) ya da 'PAZAR' (pazarda baslama/bitis '')
// Girdi sırası korunur (Kayitlar.ay zaten sıralı verir). Listede olmayan çalışanın adı boş gelir.
// BÖLÜMÜ her satırda BOLUM_YAZISI'dır; ayarlar yalnızca imza isimleri için kullanılır (ciktiHtml, pdf.js).
export function ciktiSatirlari(satirlar, calisanlar) {
  const adlar = new Map(calisanlar.map((c) => [c.id, c.ad]));
  return satirlar.map((s) => {
    const pazar = haftaGunu(s.tarih) === 7;
    return {
      tarih: tarihYaz(s.tarih),
      ad: adlar.get(s.calisanId) ?? '',
      bolum: BOLUM_YAZISI,
      neden: s.neden ?? '',
      baslama: pazar ? '' : (s.baslama ?? ''),
      bitis: pazar ? '' : (s.bitis ?? ''),
      fm: pazar ? 'PAZAR' : sureYaz(fazlaMesaiDakika(s.tarih, s.baslama, s.bitis)),
    };
  });
}

// Listeyi n'lik sayfalara böler; son sayfa null ile n'ye tamamlanır.
// Boş liste: bir sayfa, n adet null (boş form yine de basılabilsin).
export function sayfalaraBol(liste, n = SATIR_SAYISI) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n pozitif tam sayı olmalı');
  const sayfalar = [];
  for (let i = 0; i < liste.length; i += n) {
    const sayfa = liste.slice(i, i + n);
    while (sayfa.length < n) sayfa.push(null);
    sayfalar.push(sayfa);
  }
  if (sayfalar.length === 0) sayfalar.push(Array(n).fill(null));
  return sayfalar;
}

const KACIS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function kac(metin) {
  return String(metin ?? '').replace(/[&<>"']/g, (c) => KACIS[c]);
}

const BOS_HUCRE = '<div class="cikti-hucre"></div>';

// Metin hücresi. Uzun metin hücre içinde sarar, en fazla iki satır görünür (cikti-metin).
function hucre(metin, sinif = '') {
  const sinifi = sinif ? `cikti-hucre ${sinif}` : 'cikti-hucre';
  if (metin === '' || metin == null) return `<div class="${sinifi}"></div>`;
  return `<div class="${sinifi}"><span class="cikti-metin">${kac(metin)}</span></div>`;
}

function bantSatiri(tanzimYazi) {
  return '<div class="cikti-satir cikti-bant">'
    + BOS_HUCRE
    + '<div class="cikti-hucre cikti-baslik"><span>FAZLA MESAİ ÇİZELGESİ</span></div>'
    + `<div class="cikti-hucre cikti-tanzim"><span>TANZİM TARİHİ: ${kac(tanzimYazi)}</span></div>`
    + '</div>';
}

function sutunBasligiSatiri() {
  const hucreler = OLCULER.sutunlar
    .map((s) => `<div class="cikti-hucre cikti-orta"><span>${kac(s.baslik)}</span></div>`)
    .join('');
  return `<div class="cikti-satir cikti-sutunlar">${hucreler}</div>`;
}

function govdeSatiri(s) {
  const hucreler = s
    ? hucre(s.tarih, 'cikti-orta')
      + hucre(s.ad)
      + hucre(s.bolum)
      + hucre(s.neden)
      + hucre(s.baslama, 'cikti-orta')
      + hucre(s.bitis, 'cikti-orta')
      + hucre(s.fm, 'cikti-orta cikti-sure')
      + BOS_HUCRE
    : BOS_HUCRE.repeat(OLCULER.sutunlar.length);
  return `<div class="cikti-satir cikti-govde">${hucreler}</div>`;
}

function imzaTablosu(ayarlar) {
  const imza = ayarlar?.imza ?? {};
  const kutular = OLCULER.imza.kutular;
  const basliklar = kutular
    .map((k) => `<div class="cikti-hucre cikti-orta cikti-imza-baslik">${k.baslik ? `<span>${kac(k.baslik)}</span>` : ''}</div>`)
    .join('');
  const isimler = kutular
    .map((k) => {
      const isim = k.ayar ? (imza[k.ayar] ?? '') : '';
      return `<div class="cikti-hucre cikti-orta cikti-imza-isim">${isim ? `<span class="cikti-metin">${kac(isim)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="cikti-imza">${basliklar}${isimler}</div>`;
}

// Yazdırılacak HTML: sayfa başına bir <section class="cikti-sayfa">.
// Her sayfada başlık, tanzim tarihi, sütun başlıkları, SATIR_SAYISI satır (boşlar dahil)
// ve imza tablosu bulunur. Bütün metinler kaçışlıdır.
export function ciktiHtml({ satirlar, calisanlar, ayarlar, tanzim }) {
  const sayfalar = sayfalaraBol(ciktiSatirlari(satirlar, calisanlar));
  const stil = olcuDegiskenleri();
  const tanzimYazi = tarihYaz(tanzim);
  const ust = bantSatiri(tanzimYazi) + sutunBasligiSatiri();
  const alt = imzaTablosu(ayarlar);
  return sayfalar
    .map((sayfa) => `<section class="cikti-sayfa" lang="tr" style="${stil}">`
      + `<div class="cikti-tablo">${ust}${sayfa.map(govdeSatiri).join('')}</div>${alt}</section>`)
    .join('');
}
