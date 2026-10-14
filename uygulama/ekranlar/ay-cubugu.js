// Ay çubuğu: ‹ Ekim 2026 ›. Çizelge ve Toplamlar ekranlarında ortaktır; seçili ay baglam.durum.ay'da
// durur, bu yüzden sekmeler arasında aynı ay kalır. İçinde bulunulan aydan (Europe/Istanbul) ileri
// gidilmez: o ayda › pasiftir. Çubuk kendi başlığını ve düğmelerini günceller, sonra degisince()
// çağrılır; ekran yalnızca içeriğini yeniler (çubuk yeniden çizilmez, odak düğmede kalır).

import { ayAdi, ayAnahtari, ayKaydir, istanbulSimdi } from '../tarih.js';

const OK = (yol) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" '
  + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${yol}"/></svg>`;

function buAy() {
  return ayAnahtari(istanbulSimdi(new Date()).tarih);
}

export function ayCubuguOlustur(baglam, { degisince }) {
  const cubuk = document.createElement('header');
  cubuk.className = 'ay-cubugu';
  cubuk.innerHTML = `
    <button type="button" class="ay-ok" aria-label="Önceki ay">${OK('M14.5 5.5 8 12l6.5 6.5')}</button>
    <h1 class="ay-adi" aria-live="polite"></h1>
    <button type="button" class="ay-ok" aria-label="Sonraki ay">${OK('M9.5 5.5 16 12l-6.5 6.5')}</button>`;
  const [geri, ileri] = cubuk.querySelectorAll('.ay-ok');
  const baslik = cubuk.querySelector('.ay-adi');

  function guncelle() {
    baslik.textContent = ayAdi(baglam.durum.ay);
    ileri.disabled = baglam.durum.ay >= buAy();
  }

  function git(adim) {
    if (adim > 0 && baglam.durum.ay >= buAy()) {
      guncelle(); // ay, çubuk çizildikten sonra değişmiş olabilir (gece yarısı)
      return;
    }
    const odakIleride = document.activeElement === ileri;
    baglam.durum.ay = ayKaydir(baglam.durum.ay, adim);
    guncelle();
    if (odakIleride && ileri.disabled) geri.focus(); // pasif düğmede odak kalmaz
    degisince();
  }

  geri.addEventListener('click', () => git(-1));
  ileri.addEventListener('click', () => git(1));
  guncelle();
  return cubuk;
}
