// Çizelge (ana ekran, spec 7.1): ay çubuğu (‹ Ekim 2026 ›), üç düğme (Mesai ekle, Yazdır,
// PDF / Gönder) ve seçili ayın satırları. Telefonda her satır bir kart, geniş ekranda bir tablo
// satırıdır (stil.css). Satıra dokununca Düzenle penceresi açılır (mesai-formu.js).
//
// Satırlar Kayitlar.ay() sırasıyla (tarih, sonra başlama saati) gelir. Ay değişince yalnız liste
// yenilenir; geç gelen eski bir yanıt yeni ayın listesinin üstüne yazılmaz.
// Yazdır ve PDF ekranda görünen satırları kullanır; ayarlar (bölüm yazısı, imzalar) o an okunur.

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

export function ekranCiz(kok, baglam) {
  const { kayitlar, durum, bildir, hataMetni } = baglam;
  let veri = null; // ekrandaki ay: { ay, satirlar, calisanlar }
  let istek = 0; // son liste isteğinin sırası

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

  async function listeyiYukle() {
    const sira = ++istek;
    const ay = durum.ay;
    // Odak listedeki bir satırdaysa (pencere kapanınca oraya döner) yeni listede aynı satıra geçer.
    const odak = liste.contains(document.activeElement) ? document.activeElement.closest('[data-satir]') : null;
    liste.setAttribute('aria-busy', 'true');
    if (veri?.ay !== ay) {
      veri = null;
      liste.replaceChildren(yerTutucu());
    }
    let sonuc;
    try {
      const [satirlar, calisanlar] = await Promise.all([kayitlar.ay(ay), kayitlar.calisanlar()]);
      sonuc = { ay, satirlar, calisanlar };
    } catch (hata) {
      if (sira !== istek || !liste.isConnected) return;
      console.error(hata);
      veri = null;
      const satir = eleman('p', 'ekran-hata', hataMetni(hata));
      satir.setAttribute('role', 'alert');
      liste.replaceChildren(satir);
      liste.removeAttribute('aria-busy');
      return;
    }
    if (sira !== istek || !liste.isConnected) return;
    veri = sonuc;
    liste.replaceChildren(sonuc.satirlar.length === 0 ? bosAy() : tabloOlustur(sonuc.satirlar, sonuc.calisanlar));
    liste.removeAttribute('aria-busy');
    if (odak) {
      const ayni = liste.querySelector(`[data-satir="${CSS.escape(odak.dataset.satir)}"]`);
      (ayni ?? ekleDugmesi).focus();
    }
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

  // Ekrandaki ay yüklüyse onun satırları, değilse taze okuma; ayarlar her seferinde okunur.
  async function ciktiVerisi() {
    const ay = durum.ay;
    const [satirlar, calisanlar, ayarlar] = veri?.ay === ay
      ? [veri.satirlar, veri.calisanlar, await kayitlar.ayarlar()]
      : await Promise.all([kayitlar.ay(ay), kayitlar.calisanlar(), kayitlar.ayarlar()]);
    return { ay, satirlar, calisanlar, ayarlar, tanzim: istanbulSimdi(new Date()).tarih };
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
    yazdirmaAlani().innerHTML = ciktiHtml(girdi);
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
