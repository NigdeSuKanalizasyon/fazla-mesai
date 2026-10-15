// Çizelge (ana ekran, spec 7.1): ay çubuğu (‹ Ekim 2026 ›), üç düğme (Mesai ekle, Yazdır,
// PDF / Gönder) ve seçili ayın satırları. Telefonda her satır bir kart, geniş ekranda bir tablo
// satırıdır (stil.css). Satıra dokununca Düzenle penceresi açılır (mesai-formu.js).
//
// Satırlar Kayitlar.ay() sırasıyla (tarih, sonra başlama saati) gelir. Ay değişince yalnız liste
// yenilenir; geç gelen eski bir yanıt yeni ayın listesinin üstüne yazılmaz.
// Yazdır ve PDF ay, çalışanlar ve ayarları her seferinde GitHub'dan taze okur (başka cihazın yazdığı ya da
// az önce kaydedilip listesi henüz tazelenmemiş satır da çıktıya girer); liste de aynı okumayla tazelenir.
// Yazdır'ın çıktısı yazdırma bitince silinir: tarayıcının kendi yazdırması (Ctrl+P, menüden Yazdır) sonradan
// eski bir çıktıyı basmaz (stil.css o zaman kısa bir not basar).

import { fazlaMesaiDakika, sureYaz } from '../sure.js';
import { haftaGunu, istanbulSimdi, tarihYaz } from '../tarih.js';
import { ciktiHtml } from '../cikti.js';
import { kutuphaneYukle, pdfDosyaAdi, pdfPaylas, pdfUret } from '../pdf.js';
import { ayCubuguOlustur } from './ay-cubugu.js';
import { gunAdi, mesaiFormuAc } from './mesai-formu.js';

const KUTUPHANE_HATASI = 'PDF kütüphanesi yüklenemedi.';
const SUTUNLAR = ['Tarih', 'Ad soyad', 'Mesai nedeni', 'Başlama', 'Bitiş', 'Süre'];

const SIMGE = 'class="dugme-simge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const SIMGELER = {
  ekle: `<svg ${SIMGE}><path d="M12 5v14M5 12h14"/></svg>`,
  yazdir: `<svg ${SIMGE}><path d="M7 9V3.5h10V9M7 17.5H4.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7H17"/><path d="M7 14h10v6.5H7z"/></svg>`,
  gonder: `<svg ${SIMGE}><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></svg>`,
};

function eleman(etiket, sinif, metin) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}

function dugme(sinif, simge, metin) {
  const d = eleman('button', `dugme ${sinif}`);
  d.type = 'button';
  d.innerHTML = SIMGELER[simge];
  d.append(eleman('span', '', metin));
  return d;
}

// Bir satırın kartı / tablo satırı. Bütün metinler textContent ile yazılır (adlar, nedenler kullanıcı verisi).
function satirOlustur(satir, adlar) {
  const pazar = haftaGunu(satir.tarih) === 7;
  const dugmesi = eleman('button', pazar ? 'satir satir-pazar' : 'satir');
  dugmesi.type = 'button';
  dugmesi.dataset.satir = satir.id;

  const tarih = eleman('span', 'satir-tarih');
  tarih.append(eleman('span', 'satir-gun', tarihYaz(satir.tarih)), eleman('span', 'satir-gunadi', gunAdi(satir.tarih)));
  const saatler = eleman('span', 'satir-saatler');
  saatler.append(
    eleman('span', 'satir-baslama', pazar ? '' : (satir.baslama ?? '')),
    eleman('span', 'satir-bitis', pazar ? '' : (satir.bitis ?? '')),
  );
  const sure = pazar ? 'PAZAR' : sureYaz(fazlaMesaiDakika(satir.tarih, satir.baslama, satir.bitis));
  dugmesi.append(
    tarih,
    eleman('span', 'satir-ad', adlar.get(satir.calisanId) ?? '—'),
    eleman('span', 'satir-neden', satir.neden ?? ''),
    saatler,
    eleman('span', 'satir-sure', sure),
  );
  const li = eleman('li');
  li.append(dugmesi);
  return li;
}

function bosAy() {
  const kutu = eleman('div', 'bos-ay');
  kutu.innerHTML = '<svg class="bos-ay-simge" viewBox="0 0 64 24" aria-hidden="true" focusable="false">'
    + '<path d="M2 12h60" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'
    + '<circle class="bos-ay-dugum" cx="32" cy="12" r="7"/></svg>';
  kutu.append(eleman('p', 'bos-ay-metni', 'Bu ay için kayıt yok.'));
  return kutu;
}

function tabloOlustur(satirlar, calisanlar) {
  const adlar = new Map(calisanlar.map((c) => [c.id, c.ad]));
  const tablo = eleman('div', 'cizelge-tablo');
  const basliklar = eleman('div', 'cizelge-basliklar');
  basliklar.setAttribute('aria-hidden', 'true'); // geniş ekranda sütun adları; satırlar kendini anlatır
  basliklar.append(...SUTUNLAR.map((ad) => eleman('span', '', ad)));
  const liste = eleman('ul', 'satirlar');
  liste.setAttribute('role', 'list');
  liste.append(...satirlar.map((s) => satirOlustur(s, adlar)));
  tablo.append(basliklar, liste);
  return tablo;
}

function yerTutucu() {
  const kutu = eleman('div', 'yer-tutucular');
  kutu.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) kutu.append(eleman('div', 'yer-tutucu'));
  return kutu;
}

// Çıktı sayfaları gizli #yazdirma alanına konur (index.html'e dokunmadan, ilk yazdırmada açılır).
// İçinde çıktı sayfalarından başka <section> olmaz (.cikti-sayfa:last-of-type).
function yazdirmaAlani() {
  let alan = document.getElementById('yazdirma');
  if (!alan) {
    alan = document.createElement('div');
    alan.id = 'yazdirma';
    document.body.append(alan);
  }
  return alan;
}

// Yazdırma bitince (afterprint) çıktı silinir. iOS Safari afterprint'i yazdırma penceresi kapanmadan gönderir;
// pencere çıktıyı hâlâ çiziyor olabilir. Bu yüzden alan afterprint'ten sonra, kullanıcı sayfaya yeniden
// dokununca ya da bir tuşa basınca boşaltılır (yazdırma penceresi açıkken sayfaya dokunulamaz).
let yazdirmaBitti = null; // afterprint geldi, dokunuş bekleniyor: AbortController

function ciktiyiSil() {
  yazdirmaBitti?.abort();
  yazdirmaBitti = null;
  document.getElementById('yazdirma')?.replaceChildren();
}

function yazdirmaBitince() {
  if (yazdirmaBitti || !document.getElementById('yazdirma')?.hasChildNodes()) return;
  yazdirmaBitti = new AbortController();
  const secenek = { capture: true, signal: yazdirmaBitti.signal };
  window.addEventListener('pointerdown', ciktiyiSil, secenek);
  window.addEventListener('keydown', ciktiyiSil, secenek);
}

window.addEventListener('afterprint', yazdirmaBitince);

function yazdir(girdi) {
  yazdirmaBitti?.abort(); // yeni çıktı: önceki yazdırmanın beklediği dokunuş artık onu silmez
  yazdirmaBitti = null;
  yazdirmaAlani().innerHTML = ciktiHtml(girdi);
}

export function ekranCiz(kok, baglam) {
  const { kayitlar, durum, bildir, hataMetni } = baglam;
  let veri = null; // listede çizili ay: { ay, satirlar, calisanlar }
  let istek = 0; // son başlatılan okumanın sırası
  let cizilen = 0; // listeye en son çizilen okumanın sırası

  const ust = eleman('div', 'cizelge-ust');
  let cubuk = ayCubuguOlustur(baglam, { degisince: () => listeyiYukle() });
  const eylemler = eleman('div', 'cizelge-eylemler');
  const ekleDugmesi = dugme('dugme-ana dugme-ekle', 'ekle', 'Mesai ekle');
  const yazdirDugmesi = dugme('dugme-ikincil', 'yazdir', 'Yazdır');
  const pdfDugmesi = dugme('dugme-ikincil', 'gonder', 'PDF / Gönder');
  eylemler.append(ekleDugmesi, yazdirDugmesi, pdfDugmesi);
  ust.append(cubuk, eylemler);
  const liste = eleman('div', 'cizelge-liste');
  kok.replaceChildren(ust, liste);

  // Seçili ayı okur ve listeye çizer; okunanları döndürür. ayarlarla: ayarlar da aynı Promise.all'da okunur
  // (Yazdır/PDF). Okumalar sırayla numaralanır: bir yanıt yalnızca hâlâ seçili aya aitse ve listeye ondan
  // yeni bir okuma çizilmemişse çizilir (geç gelen eski yanıt yenisinin üstüne yazılmaz).
  async function ayiOku({ ayarlarla = false } = {}) {
    const sira = ++istek;
    const ay = durum.ay;
    // Odak listedeki bir satırdaysa (pencere kapanınca oraya döner) yeni listede aynı satıra geçer.
    const odak = liste.contains(document.activeElement) ? document.activeElement.closest('[data-satir]') : null;
    liste.setAttribute('aria-busy', 'true');
    if (veri?.ay !== ay) {
      veri = null;
      liste.replaceChildren(yerTutucu());
    }
    const guncel = () => liste.isConnected && ay === durum.ay && sira > cizilen;
    let satirlar;
    let calisanlar;
    let ayarlar;
    try {
      [satirlar, calisanlar, ayarlar] = await Promise.all([
        kayitlar.ay(ay),
        kayitlar.calisanlar(),
        ayarlarla ? kayitlar.ayarlar() : null,
      ]);
    } catch (hata) {
      // Yalnız en son okuma hata gösterir. Yazdır/PDF okuması düşerse listede bu ay duruyorsa o kalır
      // (hata bildirimde yazar); liste boşsa (yer tutucu) hata listeye yazılır.
      if (guncel() && sira === istek) {
        liste.removeAttribute('aria-busy');
        if (!(ayarlarla && veri?.ay === ay)) {
          veri = null;
          const satir = eleman('p', 'ekran-hata', hataMetni(hata));
          satir.setAttribute('role', 'alert');
          liste.replaceChildren(satir);
        }
      }
      throw hata;
    }
    if (guncel()) {
      cizilen = sira;
      veri = { ay, satirlar, calisanlar };
      liste.replaceChildren(satirlar.length === 0 ? bosAy() : tabloOlustur(satirlar, calisanlar));
      if (sira === istek) liste.removeAttribute('aria-busy');
      if (odak) {
        const ayni = liste.querySelector(`[data-satir="${CSS.escape(odak.dataset.satir)}"]`);
        (ayni ?? ekleDugmesi).focus();
      }
    }
    return { ay, satirlar, calisanlar, ayarlar };
  }

  // Liste okuması; hatası listede gösterilir.
  function listeyiYukle() {
    return ayiOku().catch((hata) => console.error(hata));
  }

  // Pencere kayıttan sonra çağırır. Eklenen satır başka aydaysa o aya geçilir (satır listede görünsün).
  function degisince({ ay } = {}) {
    if (ay && ay !== durum.ay) {
      durum.ay = ay;
      const yeni = ayCubuguOlustur(baglam, { degisince: () => listeyiYukle() });
      cubuk.replaceWith(yeni);
      cubuk = yeni;
    }
    return listeyiYukle();
  }

  function formAc(satir) {
    mesaiFormuAc({ baglam, satir, calisanlar: veri?.calisanlar ?? null, degisince });
  }

  // Çıktının girdisi: ay, çalışanlar ve ayarlar tek seferde taze okunur (liste de tazelenir).
  async function ciktiVerisi() {
    const okunan = await ayiOku({ ayarlarla: true });
    return { ...okunan, tanzim: istanbulSimdi(new Date()).tarih };
  }

  // İş sürerken ikinci basış yok sayılır. disabled yerine aria-disabled: klavye odağı düğmede kalır.
  async function mesgulIken(dugmesi, is) {
    if (dugmesi.getAttribute('aria-busy') === 'true') return;
    dugmesi.setAttribute('aria-busy', 'true');
    dugmesi.setAttribute('aria-disabled', 'true');
    try {
      await is();
    } finally {
      dugmesi.removeAttribute('aria-busy');
      dugmesi.removeAttribute('aria-disabled');
    }
  }

  ekleDugmesi.addEventListener('click', () => formAc(null));

  liste.addEventListener('click', (olay) => {
    const dugmesi = olay.target.closest('[data-satir]');
    if (!dugmesi || !veri) return;
    const satir = veri.satirlar.find((s) => s.id === dugmesi.dataset.satir);
    if (satir) formAc(satir);
  });

  yazdirDugmesi.addEventListener('click', () => mesgulIken(yazdirDugmesi, async () => {
    let girdi;
    try {
      girdi = await ciktiVerisi();
    } catch (hata) {
      console.error(hata);
      bildir(hataMetni(hata));
      return;
    }
    yazdir(girdi);
    await document.fonts?.ready; // yazı tipi yüklenmeden basılmasın
    window.print();
  }));

  pdfDugmesi.addEventListener('click', () => mesgulIken(pdfDugmesi, async () => {
    let kutuphane;
    try {
      kutuphane = await kutuphaneYukle();
    } catch (hata) {
      console.error(hata);
      bildir(KUTUPHANE_HATASI);
      return;
    }
    let girdi;
    try {
      girdi = await ciktiVerisi();
    } catch (hata) {
      console.error(hata);
      bildir(hataMetni(hata));
      return;
    }
    let sonuc;
    try {
      const bayt = pdfUret({ ...kutuphane, ...girdi });
      sonuc = await pdfPaylas(bayt, pdfDosyaAdi(girdi.ay));
    } catch (hata) {
      console.error(hata);
      bildir(hataMetni(hata));
      return;
    }
    if (sonuc === 'indirildi') bildir('PDF indirildi');
  }));

  return listeyiYukle();
}
