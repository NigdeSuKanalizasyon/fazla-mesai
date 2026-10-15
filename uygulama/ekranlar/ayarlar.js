// Ayarlar (spec 7.5): imza isimleri (Bölüm Amiri, Puantör, Bölüm Müdürü), Çıkış ve en altta uygulama
// sürümü. Bölümü sütunu ayarlanmaz; çıktıya her satırda BOLUM_YAZISI (cikti.js) yazılır.
//
// Form hemen çizilir, kutular ayarlar okunana kadar pasiftir. Ayarlar okunamazsa form kalkar (var olan
// dosyanın üzerine yazılmasın) ve hata yazar; Çıkış ve sürüm yerinde kalır. Kaydederken dosyadaki
// bilinmeyen alanlar korunur. Kayıt sürerken düğme pasiftir; hata olursa girilenler durur, hata metni
// formun üstünde yazar. Ekranda yalnızca hataMetni() gösterilir.
//
// Çıkış: oturum anahtarı IndexedDB'den silinir, sonra sayfa yeniden yüklenir. Yeniden yükleme,
// bellekteki token'ı ve anahtarı da siler; açılış oturum bulamaz ve giriş ekranını gösterir.

import { oturumSil } from '../oturum.js';
import { eleman, hataKutusu } from './ortak.js';

export const SURUM = 's1.1';

let sayac = 0; // her ekranın kimlikleri ayrı olsun

function nesne(deger) {
  return deger !== null && typeof deger === 'object' && !Array.isArray(deger) ? deger : {};
}

function metin(deger) {
  return typeof deger === 'string' ? deger : '';
}

export function ekranCiz(kok, baglam) {
  const { kayitlar, bildir, hataMetni } = baglam;
  const k = `ay${++sayac}`;

  // --- Sayfa iskeleti ---
  const bolum = eleman('section', 'ekran-sutun ayarlar');
  const alan = eleman('div', 'ayar-alani');

  const cikisBolumu = eleman('div', 'cikis-bolumu');
  const cikis = eleman('button', 'dugme dugme-ikincil cikis-dugmesi', 'Çıkış');
  cikis.type = 'button';
  cikis.addEventListener('click', async () => {
    cikis.disabled = true;
    try {
      await oturumSil();
    } catch (hata) {
      console.error(hata);
      cikis.disabled = false;
      bildir(hataMetni(hata), { hata: true });
      return;
    }
    location.reload();
  });
  cikisBolumu.append(cikis);

  bolum.append(eleman('h1', 'ekran-baslik', 'Ayarlar'), alan, cikisBolumu, eleman('p', 'surum', SURUM));
  kok.replaceChildren(bolum);

  // --- Form ---
  const form = document.createElement('form');
  form.className = 'ayar-formu';
  form.noValidate = true;
  form.setAttribute('aria-busy', 'true');

  function kutuOlustur(ad, etiket) {
    const grup = eleman('div', 'alan-grubu');
    const yazi = eleman('label', 'alan-etiketi', etiket);
    yazi.htmlFor = `${k}-${ad}`;
    const giris = eleman('input', 'alan');
    giris.id = `${k}-${ad}`;
    giris.name = ad;
    giris.type = 'text';
    giris.autocomplete = 'off';
    giris.spellcheck = false;
    giris.disabled = true; // ayarlar gelene kadar
    grup.append(yazi, giris);
    return { grup, giris };
  }

  const imza = eleman('fieldset', 'imza-alanlari');
  imza.append(eleman('legend', '', 'İmza isimleri'));
  const imzaKutulari = [['bolumAmiri', 'Bölüm Amiri'], ['puantor', 'Puantör'], ['bolumMuduru', 'Bölüm Müdürü']]
    .map(([ad, etiket]) => {
      const { grup, giris } = kutuOlustur(ad, etiket);
      giris.setAttribute('autocapitalize', 'words');
      imza.append(grup);
      return giris;
    });

  const formHatasi = eleman('p', 'form-hata');
  formHatasi.setAttribute('role', 'alert');
  formHatasi.tabIndex = -1;
  const kaydetDugmesi = eleman('button', 'dugme dugme-ana', 'Kaydet');
  kaydetDugmesi.type = 'submit';
  kaydetDugmesi.disabled = true;
  form.append(imza, formHatasi, kaydetDugmesi);
  alan.append(form);

  const kutular = imzaKutulari;
  let kayitli = null; // dosyadaki son hali; kaydederken bilinmeyen alanlar buradan korunur
  let mesgul = false;

  function doldur(ayarlar) {
    const imzalar = nesne(ayarlar.imza);
    for (const giris of imzaKutulari) giris.value = metin(imzalar[giris.name]);
  }

  function kilitle(kilitli) {
    mesgul = kilitli;
    for (const giris of kutular) giris.disabled = kilitli;
    kaydetDugmesi.disabled = kilitli;
    kaydetDugmesi.textContent = kilitli ? 'Kaydediliyor…' : 'Kaydet';
    if (kilitli) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }

  async function kaydet() {
    if (mesgul || kayitli === null) return; // çift basış, Enter: tek kayıt
    formHatasi.textContent = '';
    const yeni = { ...kayitli, imza: { ...nesne(kayitli.imza) } };
    for (const giris of imzaKutulari) yeni.imza[giris.name] = giris.value.trim();
    kilitle(true);
    try {
      await kayitlar.ayarlariKaydet(yeni);
    } catch (hata) {
      console.error(hata);
      kilitle(false);
      formHatasi.textContent = hataMetni(hata);
      formHatasi.focus();
      return;
    }
    kayitli = yeni;
    doldur(yeni); // kırpılmış hali görünsün
    kilitle(false);
    bildir('Ayarlar kaydedildi');
  }

  form.addEventListener('submit', (olay) => {
    olay.preventDefault();
    kaydet();
  });

  async function yukle() {
    let okunan;
    try {
      okunan = nesne(await kayitlar.ayarlar());
    } catch (hata) {
      console.error(hata);
      if (!alan.isConnected) return;
      alan.replaceChildren(hataKutusu(hataMetni(hata), () => baglam.yenile()));
      return;
    }
    if (!alan.isConnected) return;
    kayitli = okunan;
    doldur(okunan);
    kilitle(false);
  }

  return yukle();
}
