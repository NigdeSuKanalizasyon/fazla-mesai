// Şifreleme: parola -> PBKDF2-SHA256 -> AES-GCM 256 anahtarı.
// Yalnızca globalThis.crypto.subtle, btoa/atob ve TextEncoder/TextDecoder kullanılır;
// aynı modül Node'da ve tarayıcıda çalışır.

export const TEKRAR = 600000; // PBKDF2 tekrar sayısı
const SURUM = 1;
const TUZ_BAYT = 16;
const IV_BAYT = 12;
const B64_PARCA = 0x8000; // String.fromCharCode'a tek seferde verilecek en çok bayt

// Şifre çözme/doğrulama başarısız olduğunda (yanlış parola, bozulmuş ya da eksik veri) fırlatılır.
export class SifreHatasi extends Error {
  constructor(mesaj = 'Şifre çözülemedi.', secenek) {
    super(mesaj, secenek);
    this.name = 'SifreHatasi';
  }
}

export function b64(bytes) {
  const bayt = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let ikili = '';
  // Büyük dizilerde yığın taşmasın diye parça parça çevrilir.
  for (let i = 0; i < bayt.length; i += B64_PARCA) {
    ikili += String.fromCharCode.apply(null, bayt.subarray(i, i + B64_PARCA));
  }
  return btoa(ikili);
}

export function b64Coz(s) {
  if (typeof s !== 'string') throw new SifreHatasi('Geçersiz base64 verisi.');
  let ikili;
  try {
    ikili = atob(s);
  } catch (hata) {
    throw new SifreHatasi('Geçersiz base64 verisi.', { cause: hata });
  }
  const bayt = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
  return bayt;
}

function rastgele(uzunluk) {
  return globalThis.crypto.getRandomValues(new Uint8Array(uzunluk));
}

export async function anahtarUret(parola, tuz, tekrar) {
  const subtle = globalThis.crypto.subtle;
  const ham = await subtle.importKey('raw', new TextEncoder().encode(parola), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: tuz, iterations: tekrar },
    ham,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: JavaScript anahtarı dışarı veremez
    ['encrypt', 'decrypt'],
  );
}

// Her şifrelemede yeni rastgele iv.
async function baytSifrele(anahtar, bayt) {
  const iv = rastgele(IV_BAYT);
  const sifreli = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, anahtar, bayt);
  return { iv: b64(iv), veri: b64(new Uint8Array(sifreli)) };
}

// { surum: 1, iv, veri } biçimini denetler; her tür bozukluk SifreHatasi'dır.
function zarfOku(zarf) {
  if (zarf === null || typeof zarf !== 'object' || zarf.surum !== SURUM) {
    throw new SifreHatasi('Şifreli veri biçimi geçersiz.');
  }
  const iv = b64Coz(zarf.iv);
  const veri = b64Coz(zarf.veri);
  if (iv.length !== IV_BAYT) throw new SifreHatasi('Şifreli veri biçimi geçersiz.');
  return { iv, veri };
}

async function baytCoz(anahtar, zarf) {
  const { iv, veri } = zarfOku(zarf);
  try {
    const acik = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, anahtar, veri);
    return new Uint8Array(acik);
  } catch (hata) {
    // AES-GCM doğrulaması tutmadı: yanlış anahtar ya da değiştirilmiş veri.
    throw new SifreHatasi('Şifre çözülemedi.', { cause: hata });
  }
}

export async function sifrele(anahtar, nesne) {
  const json = JSON.stringify(nesne);
  if (json === undefined) throw new SifreHatasi('Bu değer şifrelenemez.');
  const { iv, veri } = await baytSifrele(anahtar, new TextEncoder().encode(json));
  return { surum: SURUM, iv, veri };
}

export async function coz(anahtar, dosya) {
  const acik = await baytCoz(anahtar, dosya);
  try {
    return JSON.parse(new TextDecoder().decode(acik));
  } catch (hata) {
    throw new SifreHatasi('Şifre çözülen veri okunamadı.', { cause: hata });
  }
}

// Token kutusu: parolayla şifrelenmiş GitHub token'ı (veri/anahtar.json).
export async function tokenKutusuOlustur(parola, token, secenek = {}) {
  const { tekrar = TEKRAR, tuz = rastgele(TUZ_BAYT) } = secenek;
  const anahtar = await anahtarUret(parola, tuz, tekrar);
  const { iv, veri } = await baytSifrele(anahtar, new TextEncoder().encode(token));
  return { surum: SURUM, tuz: b64(tuz), tekrar, iv, veri };
}

export async function kutudanAnahtar(parola, kutu) {
  if (kutu === null || typeof kutu !== 'object' || kutu.surum !== SURUM) {
    throw new SifreHatasi('Token kutusu biçimi geçersiz.');
  }
  const tuz = b64Coz(kutu.tuz);
  if (!Number.isInteger(kutu.tekrar) || kutu.tekrar < 1) {
    throw new SifreHatasi('Token kutusu biçimi geçersiz.');
  }
  return anahtarUret(parola, tuz, kutu.tekrar);
}

export async function tokenCoz(anahtar, kutu) {
  const acik = await baytCoz(anahtar, kutu);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(acik);
  } catch (hata) {
    throw new SifreHatasi('Şifre çözülen veri okunamadı.', { cause: hata });
  }
}
