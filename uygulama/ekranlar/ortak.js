// Toplamlar, Çalışanlar ve Ayarlar ekranlarının ortak küçük parçaları. Metinler textContent ile
// yazılır (adlar kullanıcı verisidir); innerHTML yalnızca sabit simge ve kalıplar için kullanılır.

export function eleman(etiket, sinif, metin) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}

// Pencereler #uygulama'nın içine konur: ekranın stilleri (odak halkası, hareket azaltma) onlara da
// uyar, yazdırırken ekranla birlikte gizlenir. <dialog> yine de en üst katmanda açılır.
export function pencereKabi() {
  return document.getElementById('uygulama') ?? document.body;
}

// Boş liste: kesikli kutuda boru ve altın düğüm, altında metin.
export function bosKutu(metin) {
  const kutu = eleman('div', 'bos-ay');
  kutu.innerHTML = '<svg class="bos-ay-simge" viewBox="0 0 64 24" aria-hidden="true" focusable="false">'
    + '<path d="M2 12h60" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'
    + '<circle class="bos-ay-dugum" cx="32" cy="12" r="7"/></svg>';
  kutu.append(eleman('p', 'bos-ay-metni', metin));
  return kutu;
}

// Liste yüklenirken görünen soluk kutular.
export function yerTutucu(adet = 3) {
  const kutu = eleman('div', 'yer-tutucular');
  kutu.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < adet; i++) kutu.append(eleman('div', 'yer-tutucu'));
  return kutu;
}

// Yüklenemeyen ekran: hata metni ve "Tekrar dene". Sekme çubuğu ve Çıkış yerinde kalır.
export function hataKutusu(metin, tekrarDene) {
  const kutu = eleman('div', 'hata-kutusu');
  const yazi = eleman('p', 'ekran-hata', metin);
  yazi.setAttribute('role', 'alert');
  const dugme = eleman('button', 'dugme dugme-ikincil', 'Tekrar dene');
  dugme.type = 'button';
  dugme.addEventListener('click', () => {
    dugme.disabled = true;
    tekrarDene();
  });
  kutu.append(yazi, dugme);
  return kutu;
}
