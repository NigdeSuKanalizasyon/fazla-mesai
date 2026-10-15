// PDF: "FAZLA MESAİ ÇİZELGESİ" kâğıt formunun aynısı (yatay A4, sayfada 20 satır).
// pdfUret saftır (DOM yok): jsPDF sınıfı ve yazı tipleri dışarıdan gelir, Node'da test edilir.
// Bütün ölçüler cikti.js içindeki OLCULER'den gelir; yazdırma çıktısı (stil.css) aynı
// nesneyle çizildiği için PDF ile kâğıt çıktısı aynı ölçüdedir.
// kutuphaneYukle ve pdfPaylas yalnız tarayıcıda çalışır; modül içe aktarılırken DOM'a dokunulmaz.
import { OLCULER, ciktiSatirlari, sayfalaraBol } from './cikti.js';
import { tarihYaz } from './tarih.js';

// İki ağırlık ayrı yazı tipi adıyla kaydedilir; PDF'te iki gömülü yazı tipi birbirinden adıyla ayrılır.
const YAZI_NORMAL = 'Figtree';
const YAZI_KALIN = 'Figtree-SemiBold';
const MM_PT = 25.4 / 72; // 1 pt kaç mm
const SATIR_EN_FAZLA = 2;
const UC_NOKTA = '…';

// Figtree'nin yazı alanı (hhea): em'in 0,95'i taban çizgisinin üstünde, 0,25'i altında.
// CSS'in satır kutusunu yerleştirişiyle aynı sonucu vermek için kullanılır.
const YAZI_YUKARI = 0.95;
const YAZI_ASAGI = 0.25;

export function pdfDosyaAdi(ay) {
  return `Fazla_Mesai_${ay}.pdf`;
}

// ---------------------------------------------------------------------------
// Çizim yardımcıları. Uzunluklar mm; doc.rect/text mm birimiyle çalışır (unit: 'mm').
// ---------------------------------------------------------------------------

// Çizgiler, CSS'teki gibi hücrenin İÇİNDE (border-box) ve dolu dikdörtgen olarak çizilir:
// köşeler tam birleşir, sütun/satır ölçüleri çizgi kalınlığından etkilenmez.
function dikdortgen(doc, x, y, genislik, yukseklik) {
  doc.rect(x, y, genislik, yukseklik, 'F');
}

// Verilen metni hücre genişliğine göre sarar; en fazla SATIR_EN_FAZLA satır, fazlası "…" ile kesilir
// (yazdırmadaki line-clamp gibi). Yazı tipi ve boyu çağırmadan önce ayarlanmış olmalı.
function sar(doc, metin, genislik) {
  if (metin === '' || metin == null) return [];
  // Yazdırmadaki HTML gibi: satır sonu ve art arda boşluklar tek boşluk sayılır.
  let satirlar = doc.splitTextToSize(String(metin).replace(/\s+/g, ' ').trim(), genislik);
  if (satirlar.length > SATIR_EN_FAZLA) {
    satirlar = satirlar.slice(0, SATIR_EN_FAZLA);
    let son = satirlar[SATIR_EN_FAZLA - 1];
    while (son.length > 0 && doc.getTextWidth(son + UC_NOKTA) > genislik) son = son.slice(0, -1);
    satirlar[SATIR_EN_FAZLA - 1] = son.trimEnd() + UC_NOKTA;
  }
  return satirlar;
}

// Bir satırın taban çizgisi, satır kutusunun üstünden ne kadar aşağıda (mm).
function tabanPayi(yaziPt, aralik) {
  const yazi = yaziPt * MM_PT;
  return yazi * ((aralik - (YAZI_YUKARI + YAZI_ASAGI)) / 2 + YAZI_YUKARI);
}

// Satırları kutunun içine yazar. hizala: 'orta' (x = yatay orta) ya da 'sol' (x = sol kenar).
// dikey: 'orta' (kutuda dikey ortalı) ya da 'alt' (satır kutusu kutunun altına oturur).
function yaz(doc, satirlar, { x, ust, yukseklik, yaziPt, aralik, hizala = 'sol', dikey = 'orta' }) {
  if (satirlar.length === 0) return;
  const satirYuksekligi = yaziPt * MM_PT * aralik;
  const toplam = satirlar.length * satirYuksekligi;
  const baslangic = dikey === 'alt' ? ust + yukseklik - toplam : ust + (yukseklik - toplam) / 2;
  const pay = tabanPayi(yaziPt, aralik);
  satirlar.forEach((satir, i) => {
    const taban = baslangic + i * satirYuksekligi + pay;
    if (hizala === 'orta') doc.text(satir, x, taban, { align: 'center' });
    else doc.text(satir, x, taban);
  });
}

function yaziAyarla(doc, kalin, yaziPt) {
  doc.setFont(kalin ? YAZI_KALIN : YAZI_NORMAL, 'normal');
  doc.setFontSize(yaziPt);
}

// Tek hücre. h: {x, y, g, yuk}; ilkSutun/ilkSatir: sol/üst çizgi bu hücrede mi (içerik alanı ona göre daralır).
function hucreMetni(doc, h, metin, { yaziPt, kalin = false, hizala = 'sol', ilkSutun = false, ilkSatir = false, dikey = 'orta' }) {
  const { cizgi, hucreBosluk } = OLCULER;
  const aralik = OLCULER.yazi.satirAraligi;
  const sol = h.x + hucreBosluk + (ilkSutun ? cizgi : 0);
  const sag = h.x + h.g - hucreBosluk - cizgi;
  const ust = h.y + (ilkSatir ? cizgi : 0);
  // Alta oturan metin (TANZİM TARİHİ) alt çizginin üstünde bir hücre boşluğu kadar durur.
  const alt = h.y + h.yuk - cizgi - (dikey === 'alt' ? hucreBosluk : 0);
  yaziAyarla(doc, kalin, yaziPt);
  const satirlar = sar(doc, metin, sag - sol);
  yaz(doc, satirlar, {
    x: hizala === 'orta' ? (sol + sag) / 2 : sol,
    ust,
    yukseklik: alt - ust,
    yaziPt,
    aralik,
    hizala,
    dikey,
  });
}

// Bir sayfanın tamamı: başlık bandı, sütun başlıkları, gövde satırları, imza tablosu.
function sayfaCiz(doc, satirlar, { tanzimYazi, imza }) {
  const o = OLCULER;
  const c = o.cizgi;
  const x0 = o.kenar.sol;
  const y0 = o.kenar.ust;
  const genislik = o.tabloGenislik;
  const sutunlar = o.sutunlar;

  // Sütunların sol kenarları (mm) ve sağ kenarları.
  const solKenar = [];
  let x = x0;
  for (const s of sutunlar) { solKenar.push(x); x += s.genislik; }
  const sagKenar = solKenar.map((sol, i) => sol + sutunlar[i].genislik);

  const bantUst = y0;
  const baslikUst = bantUst + o.baslik.yukseklik;
  const govdeUst = baslikUst + o.sutunBasligi.yukseklik;
  const govdeAlt = govdeUst + satirlar.length * o.satir.yukseklik;

  // --- Çizgiler -------------------------------------------------------------
  doc.setFillColor(0, 0, 0);
  // Yatay: tablonun üstü, her satırın altı.
  dikdortgen(doc, x0, bantUst, genislik, c);
  dikdortgen(doc, x0, baslikUst - c, genislik, c);
  dikdortgen(doc, x0, govdeUst - c, genislik, c);
  for (let i = 1; i <= satirlar.length; i++) {
    dikdortgen(doc, x0, govdeUst + i * o.satir.yukseklik - c, genislik, c);
  }
  // Dikey: sol kenar ve sütun sağ kenarları. Başlık bandında yalnız 1., 6. ve 8. sütunun
  // sağında çizgi vardır (2.–6. sütun birleşik başlık, 7.–8. sütun birleşik tanzim hücresi).
  dikdortgen(doc, x0, bantUst, c, govdeAlt - bantUst);
  sagKenar.forEach((sag, i) => {
    const bantta = i === 0 || i === 5 || i === 7;
    const ust = bantta ? bantUst : baslikUst;
    dikdortgen(doc, sag - c, ust, c, govdeAlt - ust);
  });

  // --- Başlık bandı ---------------------------------------------------------
  doc.setTextColor(0, 0, 0);
  const bandYuk = o.baslik.yukseklik;
  const baslikSol = solKenar[1];
  const baslikSag = sagKenar[5];
  hucreMetni(doc, { x: baslikSol, y: bantUst, g: baslikSag - baslikSol, yuk: bandYuk }, 'FAZLA MESAİ ÇİZELGESİ', {
    yaziPt: o.yazi.baslik, kalin: true, hizala: 'orta', ilkSatir: true,
  });
  const tanzimSol = solKenar[6];
  const tanzimSag = sagKenar[7];
  hucreMetni(doc, { x: tanzimSol, y: bantUst, g: tanzimSag - tanzimSol, yuk: bandYuk }, `TANZİM TARİHİ: ${tanzimYazi}`, {
    yaziPt: o.yazi.tanzim, kalin: true, hizala: 'orta', ilkSatir: true, dikey: 'alt',
  });

  // --- Sütun başlıkları -----------------------------------------------------
  sutunlar.forEach((s, i) => {
    hucreMetni(doc, { x: solKenar[i], y: baslikUst, g: s.genislik, yuk: o.sutunBasligi.yukseklik }, s.baslik, {
      yaziPt: o.yazi.sutunBasligi, kalin: true, hizala: 'orta', ilkSutun: i === 0,
    });
  });

  // --- Gövde satırları ------------------------------------------------------
  satirlar.forEach((s, r) => {
    if (!s) return;
    const y = govdeUst + r * o.satir.yukseklik;
    const metinler = [
      [s.tarih, 'orta', o.yazi.govde],
      [s.ad, 'sol', o.yazi.govde],
      [s.bolum, 'sol', o.yazi.govde],
      [s.neden, 'sol', o.yazi.govde],
      [s.baslama, 'orta', o.yazi.govde],
      [s.bitis, 'orta', o.yazi.govde],
      [s.fm, 'orta', o.yazi.sure],
    ];
    metinler.forEach(([metin, hizala, yaziPt], i) => {
      hucreMetni(doc, { x: solKenar[i], y, g: sutunlar[i].genislik, yuk: o.satir.yukseklik }, metin, {
        yaziPt, hizala, ilkSutun: i === 0,
      });
    });
  });

  // --- İmza tablosu ---------------------------------------------------------
  const ix = x0 + o.imza.solBosluk;
  const iy = govdeAlt + o.imza.ustBosluk;
  const kutular = o.imza.kutular;
  const baslikYuk = o.imza.baslikYuksekligi;
  const isimYuk = o.imza.isimYuksekligi;
  const toplamGenislik = kutular.reduce((t, k) => t + k.genislik, 0);
  dikdortgen(doc, ix, iy, toplamGenislik, c); // üst
  dikdortgen(doc, ix, iy + baslikYuk - c, toplamGenislik, c); // başlıkların altı
  dikdortgen(doc, ix, iy + baslikYuk + isimYuk - c, toplamGenislik, c); // isimlerin altı
  dikdortgen(doc, ix, iy, c, baslikYuk + isimYuk); // sol
  let kx = ix;
  kutular.forEach((k, i) => {
    dikdortgen(doc, kx + k.genislik - c, iy, c, baslikYuk + isimYuk); // sağ
    const baslikHucresi = { x: kx, y: iy, g: k.genislik, yuk: baslikYuk };
    const isimHucresi = { x: kx, y: iy + baslikYuk, g: k.genislik, yuk: isimYuk };
    const ortak = { yaziPt: o.yazi.imza, hizala: 'orta', ilkSutun: i === 0 };
    if (k.baslik) hucreMetni(doc, baslikHucresi, k.baslik, { ...ortak, kalin: true, ilkSatir: true });
    const isim = k.ayar ? (imza?.[k.ayar] ?? '') : '';
    if (isim) hucreMetni(doc, isimHucresi, isim, ortak);
    kx += k.genislik;
  });
}

// pdfUret: PDF baytlarını döndürür. Saf: DOM'a, ağa, dosyaya dokunmaz.
//   jsPDF        jsPDF sınıfı (tarayıcıda window.jspdf.jsPDF, Node'da require)
//   yaziTipleri  { normal, kalin }: Figtree 400 ve 600 TTF dosyaları, base64
//   satirlar, calisanlar, ayarlar   ciktiHtml ile aynı girdiler
//   tanzim       'YYYY-MM-DD'
export function pdfUret({ jsPDF, yaziTipleri, satirlar, calisanlar, ayarlar, tanzim }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Fazla Mesai', creator: 'Fazla Mesai' });
  doc.addFileToVFS('Figtree-Regular.ttf', yaziTipleri.normal);
  doc.addFont('Figtree-Regular.ttf', YAZI_NORMAL, 'normal');
  doc.addFileToVFS('Figtree-SemiBold.ttf', yaziTipleri.kalin);
  doc.addFont('Figtree-SemiBold.ttf', YAZI_KALIN, 'normal');

  const sayfalar = sayfalaraBol(ciktiSatirlari(satirlar, calisanlar));
  const tanzimYazi = tarihYaz(tanzim);
  sayfalar.forEach((sayfa, i) => {
    if (i > 0) doc.addPage();
    sayfaCiz(doc, sayfa, { tanzimYazi, imza: ayarlar?.imza });
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

// ---------------------------------------------------------------------------
// Yalnız tarayıcı: yazı tipi/kütüphane yükleme ve paylaşma.
// ---------------------------------------------------------------------------

// ArrayBuffer -> base64. btoa'ya tek seferde dev bir metin vermemek için parça parça.
export function baytlarBase64(tampon) {
  const bayt = new Uint8Array(tampon);
  const PARCA = 0x8000;
  let metin = '';
  for (let i = 0; i < bayt.length; i += PARCA) {
    metin += String.fromCharCode.apply(null, bayt.subarray(i, i + PARCA));
  }
  return btoa(metin);
}

const KUTUPHANE_HATASI = 'PDF kütüphanesi yüklenemedi.';

function jsPdfYukle() {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  return new Promise((coz, red) => {
    const betik = document.createElement('script');
    betik.src = new URL('../kutuphane/jspdf.umd.min.js', import.meta.url).href;
    betik.async = true;
    betik.onload = () => {
      if (globalThis.jspdf?.jsPDF) coz(globalThis.jspdf.jsPDF);
      else red(new Error(KUTUPHANE_HATASI));
    };
    betik.onerror = () => {
      betik.remove();
      red(new Error(KUTUPHANE_HATASI));
    };
    document.head.append(betik);
  });
}

async function yaziTipiYukle(dosya) {
  const yanit = await fetch(new URL(`../kutuphane/${dosya}`, import.meta.url));
  if (!yanit.ok) throw new Error(KUTUPHANE_HATASI);
  return baytlarBase64(await yanit.arrayBuffer());
}

let yuklenen = null;

// İlk çağrıda jsPDF ve iki yazı tipi depodaki kutuphane/ klasöründen yüklenir (dış site yok),
// sonra bellekte tutulur. Yükleme başarısız olursa bir sonraki çağrı yeniden dener.
export function kutuphaneYukle() {
  if (!yuklenen) {
    yuklenen = Promise.all([
      jsPdfYukle(),
      yaziTipiYukle('figtree-400.ttf'),
      yaziTipiYukle('figtree-600.ttf'),
    ]).then(([jsPDF, normal, kalin]) => ({ jsPDF, yaziTipleri: { normal, kalin } }));
    yuklenen.catch(() => { yuklenen = null; });
  }
  return yuklenen;
}

function indir(dosya) {
  const adres = URL.createObjectURL(dosya);
  const baglanti = document.createElement('a');
  baglanti.href = adres;
  baglanti.download = dosya.name;
  baglanti.hidden = true;
  document.body.append(baglanti);
  baglanti.click();
  baglanti.remove();
  // İndirme başladıktan sonra adres serbest bırakılır. unref: Node'da (testlerde) bu zamanlayıcı işlemi açık tutmasın.
  setTimeout(() => URL.revokeObjectURL(adres), 60000)?.unref?.();
}

// Telefon ya da tablet mi (dokunmatik ekran)? Bilgisayarda (fare) false.
function dokunmatik() {
  return globalThis.matchMedia?.('(pointer: coarse)').matches === true;
}

// Telefonda ve tablette (dokunmatik ekran) dosya paylaşımı varsa paylaş menüsü açılır (WhatsApp); bilgisayarda
// (fare) ve dosya paylaşımı olmayan tarayıcıda PDF iner, işletim sisteminin paylaş penceresi açılmaz (spec 8.3).
// Sonuç: 'paylasildi' | 'indirildi' | 'vazgecildi' (paylaş menüsü kapatıldı, AbortError) | 'izin-yok'.
// 'izin-yok': tarayıcı paylaşmayı reddetti (NotAllowedError), çünkü düğmeye dokunulalı birkaç saniyeden fazla
// geçti (yavaş bağlantıda veri okunurken). PDF sessizce indirilmez: çağıran baytları saklar, bir "Gönder" düğmesi
// gösterir ve yeni dokunuşla { yeniden: true } ile yeniden çağırır. Yeniden denemede izin yine yoksa (ör. sayfa
// paylaşım izni olmayan bir çerçevede) PDF iner. Paylaşım başka beklenmedik bir hatayla düşerse PDF yine iner.
export async function pdfPaylas(bayt, dosyaAdi, { yeniden = false } = {}) {
  const dosya = new File([bayt], dosyaAdi, { type: 'application/pdf' });
  if (dokunmatik() && navigator.canShare?.({ files: [dosya] })) {
    try {
      await navigator.share({ files: [dosya] });
      return 'paylasildi';
    } catch (hata) {
      if (hata?.name === 'AbortError') return 'vazgecildi';
      if (hata?.name === 'NotAllowedError' && !yeniden) return 'izin-yok';
    }
  }
  indir(dosya);
  return 'indirildi';
}
