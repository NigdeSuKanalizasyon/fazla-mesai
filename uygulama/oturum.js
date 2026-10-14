// "Bu cihazda açık kalsın": parolayla üretilen AES anahtarı IndexedDB'de 30 gün saklanır.
// Anahtar dışarı çıkarılamaz (non-extractable) CryptoKey olarak durur: tarayıcı onu kullanabilir
// ama JavaScript bile ham baytlarını okuyamaz. Parola ve token hiçbir zaman saklanmaz.
//
//   veritabanı 'fazla-mesai', deposu 'oturum', anahtarı 'anahtar'
//   değer { anahtar: CryptoKey, zaman: giriş anı (ms) }

const VERITABANI = 'fazla-mesai';
const SURUM = 1;
const DEPO = 'oturum';
const ANAHTAR = 'anahtar';
export const OTURUM_SURESI = 30 * 24 * 60 * 60 * 1000; // 30 gün, ms
const SAAT_PAYI = 24 * 60 * 60 * 1000; // cihaz saati biraz geri alınırsa oturum düşmesin

function veritabaniAc() {
  return new Promise((coz, reddet) => {
    const istek = indexedDB.open(VERITABANI, SURUM);
    istek.onupgradeneeded = () => {
      if (!istek.result.objectStoreNames.contains(DEPO)) istek.result.createObjectStore(DEPO);
    };
    istek.onsuccess = () => {
      const db = istek.result;
      db.onversionchange = () => db.close(); // başka sekmede yükseltme olursa yolu açık bırak
      coz(db);
    };
    istek.onerror = () => reddet(istek.error);
    istek.onblocked = () => reddet(new Error('Oturum veritabanı başka bir sekmede açık.'));
  });
}

// Tek istekli işlem; işlem tamamlanınca isteğin sonucunu verir.
async function islem(kip, yap) {
  const db = await veritabaniAc();
  try {
    return await new Promise((coz, reddet) => {
      const tx = db.transaction(DEPO, kip);
      const istek = yap(tx.objectStore(DEPO));
      tx.oncomplete = () => coz(istek.result);
      tx.onerror = () => reddet(tx.error);
      tx.onabort = () => reddet(tx.error ?? new Error('Oturum işlemi yarıda kaldı.'));
    });
  } finally {
    db.close();
  }
}

export async function oturumKaydet(anahtar, simdi = Date.now()) {
  if (!(anahtar instanceof CryptoKey) || anahtar.extractable) {
    throw new TypeError('Oturuma yalnızca dışarı çıkarılamaz bir CryptoKey kaydedilir.');
  }
  await islem('readwrite', (depo) => depo.put({ anahtar, zaman: simdi }, ANAHTAR));
}

// Geçerli kayıt yoksa null. 30 günden eski (ya da bozuk) kayıt silinir.
export async function oturumGetir(simdi = Date.now()) {
  const kayit = await islem('readonly', (depo) => depo.get(ANAHTAR));
  if (kayit === undefined) return null;
  const gecen = typeof kayit?.zaman === 'number' ? simdi - kayit.zaman : NaN;
  const gecerli = kayit?.anahtar instanceof CryptoKey
    && Number.isFinite(gecen)
    && gecen < OTURUM_SURESI
    && gecen > -SAAT_PAYI; // ileri tarihli kayıt (saat yanlışken giriş) süresiz kalmasın
  if (gecerli) return kayit.anahtar;
  await oturumSil();
  return null;
}

export async function oturumSil() {
  await islem('readwrite', (depo) => depo.delete(ANAHTAR));
}
