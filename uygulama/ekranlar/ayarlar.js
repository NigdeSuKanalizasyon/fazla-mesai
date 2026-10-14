// Ayarlar. GEÇİCİ: yalnızca Çıkış; Görev 10 ayar kutularını ve sürümü ekler.
//
// Çıkış: oturum anahtarı IndexedDB'den silinir, sonra sayfa yeniden yüklenir. Yeniden yükleme,
// bellekteki token'ı ve anahtarı da siler; açılış oturum bulamaz ve giriş ekranını gösterir.

import { oturumSil } from '../oturum.js';

export function ekranCiz(kok, baglam) {
  const bolum = document.createElement('section');
  bolum.className = 'ayarlar';
  const cikis = document.createElement('button');
  cikis.type = 'button';
  cikis.className = 'dugme dugme-ikincil';
  cikis.textContent = 'Çıkış';
  cikis.addEventListener('click', async () => {
    cikis.disabled = true;
    try {
      await oturumSil();
    } catch (hata) {
      console.error(hata);
      cikis.disabled = false;
      baglam.bildir(baglam.hataMetni(hata));
      return;
    }
    location.reload();
  });
  bolum.append(cikis);
  kok.replaceChildren(bolum);
}
