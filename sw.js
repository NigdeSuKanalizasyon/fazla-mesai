// Servis çalışanı (service worker): sayfa dosyalarını cihazda saklar.
//
//   * Önce ağ, olmazsa önbellek: internet varken her zaman en yeni dosya gelir (ve önbellek
//     tazelenir); internet yokken uygulama önbellekten açılır. Yeni sürüm bir sonraki açılışta alınır.
//   * Kayıtlara ve token kutusuna karışmaz: api.github.com (başka adres) ve veri/anahtar.json
//     hiç yakalanmaz, tarayıcı onları kendisi ağdan alır. Kayıtlar hiçbir zaman saklanmaz.
//   * Kurulumda her dosya ayrı indirilir; biri inmezse geri kalanı yine saklanır, kurulum bozulmaz.
//
// Kapsam bu dosyanın klasörüdür (uygulamanın klasörü); mağaza ve eski mesai-takip bundan etkilenmez.
// Yeni bir uygulama dosyası (modül, yazı tipi, simge) eklenince DOSYALAR listesine de eklenir;
// testler/pwa.test.mjs listeyi depodaki dosyalarla karşılaştırır.

const ONBELLEK = 'fazla-mesai-v1';

const DOSYALAR = [
  './',
  'index.html',
  'stil.css',
  'manifest.webmanifest',
  'simge-180.png',
  'simge-192.png',
  'simge-512.png',
  'simge-512-maskable.png',
  'uygulama/baslat.js',
  'uygulama/cikti.js',
  'uygulama/github.js',
  'uygulama/hatalar.js',
  'uygulama/kayitlar.js',
  'uygulama/kurallar.js',
  'uygulama/oturum.js',
  'uygulama/pdf.js',
  'uygulama/sifre.js',
  'uygulama/sure.js',
  'uygulama/tarih.js',
  'uygulama/toplamlar.js',
  'uygulama/ekranlar/ayarlar.js',
  'uygulama/ekranlar/calisanlar.js',
  'uygulama/ekranlar/cizelge.js',
  'uygulama/ekranlar/giris.js',
  'uygulama/ekranlar/toplamlar.js',
  'kutuphane/jspdf.umd.min.js',
  'kutuphane/figtree-400.ttf',
  'kutuphane/figtree-600.ttf',
  'kutuphane/yazitipi/bricolage-grotesque-latin-700-normal.woff2',
  'kutuphane/yazitipi/bricolage-grotesque-latin-ext-700-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-400-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-500-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-600-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-ext-400-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-ext-500-normal.woff2',
  'kutuphane/yazitipi/figtree-latin-ext-600-normal.woff2',
];

self.addEventListener('install', (olay) => {
  olay.waitUntil((async () => {
    const onbellek = await caches.open(ONBELLEK);
    // cache: 'reload' tarayıcının HTTP önbelleğindeki eski kopyayı atlar.
    const sonuclar = await Promise.allSettled(
      DOSYALAR.map((dosya) => onbellek.add(new Request(dosya, { cache: 'reload' }))),
    );
    sonuclar.forEach((sonuc, i) => {
      if (sonuc.status === 'rejected') console.warn('Önbelleğe alınamadı:', DOSYALAR[i], sonuc.reason);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil((async () => {
    // Yalnızca bu uygulamanın eski sürüm önbellekleri silinir (aynı adreste başka uygulamalar var).
    const adlar = await caches.keys();
    await Promise.all(adlar.filter((ad) => ad.startsWith('fazla-mesai-') && ad !== ONBELLEK)
      .map((ad) => caches.delete(ad)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (olay) => {
  const istek = olay.request;
  if (istek.method !== 'GET' || istek.headers.has('range')) return;
  const adres = new URL(istek.url);
  if (adres.origin !== self.location.origin) return; // api.github.com ve başka siteler
  if (adres.pathname.endsWith('/veri/anahtar.json')) return; // token kutusu: her zaman ağdan, saklanmaz
  olay.respondWith(onceAg(olay, istek));
});

async function onceAg(olay, istek) {
  try {
    // no-cache: tarayıcının HTTP önbelleği (GitHub Pages ~10 dk) eski dosyayı vermesin; değişmediyse 304.
    const yanit = await fetch(istek, { cache: 'no-cache' });
    if (yanit.ok && yanit.type === 'basic' && !yanit.redirected) {
      const kopya = yanit.clone();
      olay.waitUntil(caches.open(ONBELLEK).then((onbellek) => onbellek.put(istek, kopya)));
    }
    return yanit;
  } catch (hata) {
    const onbellek = await caches.open(ONBELLEK);
    const kayit = await onbellek.match(istek, { ignoreSearch: true });
    if (kayit) return kayit;
    throw hata;
  }
}
