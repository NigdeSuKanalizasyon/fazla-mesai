// Giriş ekranı ve ona benzeyen iki durum: açılış ("Açılıyor…") ve açılışta çıkan sorun.
// Hepsi aynı sahnede durur: işaret, "Fazla Mesai" başlığı, altında içerik.

import { SifreHatasi } from '../sifre.js';

// Uygulamanın işareti: yeşil zemin, boru, altın düğüm ve içinde saat (simgelerle aynı dil).
const ISARET = `
  <svg class="isaret" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="16" fill="#1F6B4F"/>
    <path d="M0 32H64" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="8" fill="none"/>
    <circle cx="32" cy="32" r="15" fill="#C49A2C"/>
    <path d="M32 24.5v8l5.5 3.5" stroke="#16302B" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;

function sahne(kok, icerik) {
  const sablon = document.createElement('template');
  sablon.innerHTML = `
    <section class="giris">
      <div class="giris-kutusu">
        ${ISARET}
        <h1 class="giris-baslik">Fazla Mesai</h1>
        ${icerik}
      </div>
    </section>`;
  kok.replaceChildren(sablon.content);
}

export function acilisCiz(kok) {
  sahne(kok, '<p class="giris-durum">Açılıyor…</p>');
  kok.setAttribute('aria-busy', 'true');
}

// Açılışta oturum varken (ya da anahtar dosyası okunamazken) çıkan sorun; parola sorulmaz.
export function sorunCiz(kok, { metin, tekrarDene }) {
  sahne(kok, `
    <p class="giris-hata" role="alert"></p>
    <button class="dugme dugme-ana" type="button">Tekrar dene</button>`);
  kok.removeAttribute('aria-busy');
  kok.querySelector('.giris-hata').textContent = metin;
  const dugme = kok.querySelector('button');
  dugme.addEventListener('click', () => {
    dugme.disabled = true;
    tekrarDene();
  });
}

// girisYap(parola): başarıda ana ekranı kendisi çizer; hata atarsa metni burada gösterilir.
export function girisCiz(kok, { girisYap, hataMetni }) {
  sahne(kok, `
    <form class="giris-formu" novalidate>
      <label class="alan-etiketi" for="giris-parola">Parola</label>
      <input class="alan" id="giris-parola" name="parola" type="password"
        autocomplete="current-password" autocapitalize="off" spellcheck="false"
        aria-describedby="giris-hata">
      <p class="giris-hata" id="giris-hata" role="alert"></p>
      <button class="dugme dugme-ana" type="submit">Giriş yap</button>
    </form>`);
  kok.removeAttribute('aria-busy');

  const form = kok.querySelector('form');
  const kutu = form.querySelector('input');
  const hataAlani = form.querySelector('.giris-hata');
  const dugme = form.querySelector('button');

  kutu.addEventListener('input', () => kutu.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async (olay) => {
    olay.preventDefault();
    if (dugme.disabled) return; // anahtar üretilirken ikinci basış
    hataAlani.textContent = '';
    dugme.disabled = true;
    dugme.textContent = 'Açılıyor…';
    kutu.readOnly = true;
    try {
      await girisYap(kutu.value);
    } catch (hata) {
      if (!form.isConnected) return;
      if (!(hata instanceof SifreHatasi)) console.error(hata);
      hataAlani.textContent = hataMetni(hata);
      if (hata instanceof SifreHatasi) {
        kutu.value = ''; // spec 9: parola yanlışsa kutu temizlenir
        kutu.setAttribute('aria-invalid', 'true');
      }
      dugme.disabled = false;
      dugme.textContent = 'Giriş yap';
      kutu.readOnly = false;
      kutu.focus();
    }
  });
  kutu.focus({ preventScroll: true });
}
