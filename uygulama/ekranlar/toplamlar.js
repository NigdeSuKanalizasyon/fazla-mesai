// Mesailer sekmesi (spec 7.3 "Toplamlar"): seçili ayda her çalışanın toplamı, ada göre sıralı
// ("Ad Soyad — 12 saat 40 dakika + 2 pazar"). O ay kaydı olmayan çalışan listede görünmez.
//
// Ay çubuğu Çizelge ile ortaktır (baglam.durum.ay), bu yüzden iki sekmede de aynı ay açılır.
// Hesap toplamlar.js'te (ayToplamlari); bu dosya yalnızca okuyup çizer. Ay değişince yalnız liste
// yenilenir; geç gelen eski bir yanıt yeni ayın listesinin üstüne yazılmaz.

import { ayToplamlari } from '../toplamlar.js';
import { ayCubuguOlustur } from './ay-cubugu.js';
import { bosKutu, eleman, hataKutusu, yerTutucu } from './ortak.js';

const BOS_AY = 'Bu ay için kayıt yok.';

// Ad ile süre arasındaki çizgi ekranda görünmez (telefonda ad üstte, süre altta durur) ama
// ekran okuyucu "Ali Veli — 1 saat 40 dakika" diye okur.
function toplamSatiri(kisi) {
  const li = eleman('li', 'toplam-satir');
  li.append(
    eleman('span', 'toplam-ad', kisi.ad || '—'),
    eleman('span', 'sadece-okuyucu', ' — '),
    eleman('span', 'toplam-yazi', kisi.yazi),
  );
  return li;
}

export function ekranCiz(kok, baglam) {
  const { kayitlar, durum, hataMetni } = baglam;
  let istek = 0; // son liste isteğinin sırası

  const bolum = eleman('section', 'ekran-sutun');
  const cubuk = ayCubuguOlustur(baglam, { degisince: () => yukle() });
  const liste = eleman('div', 'toplamlar-liste');
  bolum.append(cubuk, liste);
  kok.replaceChildren(bolum);

  async function yukle() {
    const sira = ++istek;
    const ay = durum.ay;
    liste.setAttribute('aria-busy', 'true');
    liste.replaceChildren(yerTutucu());
    let kisiler;
    try {
      const [satirlar, calisanlar] = await Promise.all([kayitlar.ay(ay), kayitlar.calisanlar()]);
      kisiler = ayToplamlari(satirlar, calisanlar);
    } catch (hata) {
      if (sira !== istek || !liste.isConnected) return;
      console.error(hata);
      liste.replaceChildren(hataKutusu(hataMetni(hata), () => yukle()));
      liste.removeAttribute('aria-busy');
      return;
    }
    if (sira !== istek || !liste.isConnected) return;
    if (kisiler.length === 0) {
      liste.replaceChildren(bosKutu(BOS_AY));
    } else {
      const ul = eleman('ul', 'kart-liste');
      ul.setAttribute('role', 'list');
      ul.append(...kisiler.map(toplamSatiri));
      liste.replaceChildren(ul);
    }
    liste.removeAttribute('aria-busy');
  }

  return yukle();
}
