// Şifreli kayıtlar: depodaki her kayıt dosyası AES-GCM ile şifrelenmiş JSON'dur.
//   calisanlar.json      -> { calisanlar: [{ id, ad, aktif }] }
//   ayarlar.json         -> ayarlar nesnesinin kendisi
//   mesai/YYYY-MM.json   -> { satirlar: [{ id, tarih, calisanId, neden, baslama, bitis }] }
// Dosyanın GitHub'daki metni: JSON.stringify(await sifrele(anahtar, veri)).
//
// Birkaç cihaz aynı anda yazabilir; bu yüzden her değişiklik "oku -> uygula -> yaz" olarak
// yapılır ve GitHub çakışma bildirirse (409/422) baştan, taze veriyle yinelenir.
// Bu modül aldığı satır/çalışan/ayar nesnelerini olduğu gibi saklar; doğrulama çağıranın işidir.

import { sifrele, coz, SifreHatasi } from './sifre.js';
import { GitHubHatasi } from './github.js';
import { ayAnahtari } from './tarih.js';

const DENEME_SAYISI = 3; // çakışmada toplam deneme
const CALISANLAR_YOLU = 'calisanlar.json';
const AYARLAR_YOLU = 'ayarlar.json';
const AY_BICIMI = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const MESAI_YOLU = /^mesai\/(\d{4}-(?:0[1-9]|1[0-2]))\.json$/;
const KIMLIK_HARFLERI = '0123456789abcdefghijklmnopqrstuvwxyz';
const KIMLIK_UZUNLUGU = 8;
const SATIR_KIMLIGI = /^s_[0-9a-z]{8}$/;

export const VARSAYILAN_AYARLAR = Object.freeze({
  bolumYazisi: '',
  imza: Object.freeze({ bolumAmiri: '', puantor: '', bolumMuduru: '' }),
});

// Çözülemeyen (şifresi açılmayan, JSON olmayan, beklenmedik biçimli) kayıt dosyası.
// Böyle bir dosyanın üzerine hiçbir zaman yazılmaz.
export class BozukDosyaHatasi extends Error {
  constructor(yol, secenek) {
    super(`Kayıt dosyası açılamadı: ${yol}`, secenek);
    this.name = 'BozukDosyaHatasi';
    this.yol = yol;
  }
}

// Ay değiştiren düzenlemede satır yeni aya yazıldı ama eski aydan silinemedi: satır iki ayda da duruyor.
export class KismiTasimaHatasi extends Error {
  constructor(secenek) {
    super('Satır yeni aya eklendi ama eski aydan silinemedi. Eski aydaki kopyayı silin.', secenek);
    this.name = 'KismiTasimaHatasi';
  }
}

// 'c' (çalışan) ya da 's' (satır) + '_' + 8 karakter [0-9a-z].
export function yeniKimlik(onEk) {
  if (onEk !== 'c' && onEk !== 's') throw new TypeError("onEk 'c' ya da 's' olmalı.");
  const harf = KIMLIK_HARFLERI.length;
  const sinir = 256 - (256 % harf); // bunun üstündeki baytlar atılır: harfler eşit olasılıkta kalır
  let sonuc = '';
  while (sonuc.length < KIMLIK_UZUNLUGU) {
    for (const bayt of globalThis.crypto.getRandomValues(new Uint8Array(KIMLIK_UZUNLUGU))) {
      if (bayt < sinir && sonuc.length < KIMLIK_UZUNLUGU) sonuc += KIMLIK_HARFLERI[bayt % harf];
    }
  }
  return `${onEk}_${sonuc}`;
}

function mesaiYolu(ay) {
  if (typeof ay !== 'string' || !AY_BICIMI.test(ay)) {
    throw new TypeError(`Ay 'YYYY-AA' biçiminde olmalı: ${String(ay)}`);
  }
  return `mesai/${ay}.json`;
}

// GitHub'da görünen commit mesajı; kişi adı içermez.
function commitMesaji(yol) {
  if (yol === CALISANLAR_YOLU) return 'Çalışanlar';
  if (yol === AYARLAR_YOLU) return 'Ayarlar';
  const mesai = typeof yol === 'string' ? MESAI_YOLU.exec(yol) : null;
  if (mesai) return `Mesai: ${mesai[1]}`;
  throw new TypeError(`Bilinmeyen kayıt yolu: ${String(yol)}`);
}

// Çözülmüş dosyada beklenen listeyi verir; biçim tutmuyorsa dosya bozuk sayılır (üzerine yazılmaz).
function listeAl(veri, alan, yol) {
  if (veri === null || typeof veri !== 'object' || !Array.isArray(veri[alan])) {
    throw new BozukDosyaHatasi(yol);
  }
  return veri[alan];
}

// Tarihe, sonra başlama saatine göre; saatsiz (pazar) satır o günün başında. Eşitlerde dosyadaki sıra korunur.
function satirKarsilastir(a, b) {
  const tarihA = a.tarih ?? '';
  const tarihB = b.tarih ?? '';
  if (tarihA !== tarihB) return tarihA < tarihB ? -1 : 1;
  const saatA = a.baslama ?? '';
  const saatB = b.baslama ?? '';
  if (saatA === saatB) return 0;
  return saatA < saatB ? -1 : 1;
}

export class Kayitlar {
  #depo;
  #anahtar;

  constructor({ depo, anahtar } = {}) {
    if (!depo) throw new TypeError('depo gerekli.');
    if (!anahtar) throw new TypeError('anahtar gerekli.');
    this.#depo = depo;
    this.#anahtar = anahtar;
  }

  async calisanlar() {
    const { veri } = await this.#oku(CALISANLAR_YOLU, { calisanlar: [] });
    return listeAl(veri, 'calisanlar', CALISANLAR_YOLU);
  }

  async ayarlar() {
    const { veri } = await this.#oku(AYARLAR_YOLU, VARSAYILAN_AYARLAR);
    return veri;
  }

  async ay(ay) {
    const yol = mesaiYolu(ay);
    const { veri } = await this.#oku(yol, { satirlar: [] });
    return [...listeAl(veri, 'satirlar', yol)].sort(satirKarsilastir);
  }

  // Bir kayıt dosyasını okur, `islem(veri)` ile değiştirir, şifreleyip yazar. Dosya yoksa `varsayilan` ile başlar.
  // GitHub çakışma bildirirse (dosya araya başka bir yazışla değişmiş) okumadan başlayıp `islem`i taze veriyle
  // yeniden uygular; toplam 3 deneme. Başka hata türleri (erisim, internet, yetki) yeniden denenmez: zaman aşımına
  // uğramış bir yazış GitHub'a ulaşmış olabilir. Çözülemeyen dosyada BozukDosyaHatasi atılır, hiçbir şey yazılmaz.
  // Yazılan veriyi döndürür.
  async degistir(yol, islem, varsayilan) {
    const mesaj = commitMesaji(yol);
    let sonCakisma;
    for (let deneme = 1; deneme <= DENEME_SAYISI; deneme++) {
      try {
        const { veri, sha } = await this.#oku(yol, varsayilan);
        const yeni = await islem(veri);
        if (yeni === undefined) throw new TypeError('islem yeni veriyi döndürmeli.');
        const dosya = await sifrele(this.#anahtar, yeni);
        await this.#depo.yaz(yol, JSON.stringify(dosya), sha, mesaj);
        return yeni;
      } catch (hata) {
        if (!(hata instanceof GitHubHatasi) || hata.tur !== 'cakisma') throw hata;
        sonCakisma = hata;
      }
    }
    throw sonCakisma;
  }

  // Aynı aydaki satırlar tek yazışta, farklı aylar ayrı yazışta eklenir. Eklenen satırları (id'li) girdi sırasıyla döndürür.
  // Satır id'siyle gelirse ('s_' + 8 karakter) o id kullanılır, gelmezse yeni üretilir. Dosyada aynı id'li satır zaten
  // varsa yeni hali onun yerine (aynı sırada) yazılır, ikinci satır eklenmez: yanıtı kaybolmuş ama GitHub'a ulaşmış bir
  // yazıştan sonra kullanıcı aynı satırları (belki düzeltip) yeniden kaydederse kopya oluşmaz, son hali saklanır.
  // Kimlikler pencere başına üretildiği için başka bir satırın üstüne yazılmaz. Aynı çağrıda bir id iki kez gelirse
  // sonuncusu yazılır. Kimlikler çakışmada da değişmez: tekrar denenen yazış aynı satırları yazar.
  async satirlarEkle(satirlar) {
    const eklenenler = satirlar.map(({ id, ...alanlar }) => {
      if (id === undefined || id === null) return { id: yeniKimlik('s'), ...alanlar };
      if (typeof id !== 'string' || !SATIR_KIMLIGI.test(id)) throw new TypeError(`Satır kimliği geçersiz: ${String(id)}`);
      return { id, ...alanlar };
    });
    const aylar = new Map();
    for (const satir of eklenenler) {
      const ay = ayAnahtari(satir.tarih);
      if (!aylar.has(ay)) aylar.set(ay, []);
      aylar.get(ay).push(satir);
    }
    for (const ay of aylar.keys()) mesaiYolu(ay); // hiçbir şey yazılmadan önce tümünü denetle
    for (const [ay, grup] of aylar) {
      const yol = mesaiYolu(ay);
      await this.degistir(
        yol,
        (veri) => {
          const liste = listeAl(veri, 'satirlar', yol);
          const gelenler = new Map(grup.map((satir) => [satir.id, satir])); // aynı id iki kez: sonuncusu
          const varolanlar = new Set(liste.map((s) => s.id));
          const yeniler = [...gelenler.values()].filter((satir) => !varolanlar.has(satir.id));
          return { ...veri, satirlar: [...liste.map((s) => gelenler.get(s.id) ?? s), ...yeniler] };
        },
        { satirlar: [] },
      );
    }
    return eklenenler;
  }

  // `eski`nin yerine `yeni` yazılır; kimlik eskininki kalır. Ay aynıysa tek yazış. Ay değiştiyse önce yeni aya
  // yazılır, sonra eski aydan silinir; ikinci adım başarısız olursa satır iki ayda da durur (KismiTasimaHatasi).
  // Satır dosyada yoksa (başka cihaz silmiş) kullanıcının son hali yine de saklanır; tekrar çağrılınca kopya oluşmaz.
  async satirGuncelle(eski, yeni) {
    const kayit = { ...yeni, id: eski.id };
    const eskiAy = ayAnahtari(eski.tarih);
    const yeniAy = ayAnahtari(kayit.tarih);
    const yeniYol = mesaiYolu(yeniAy);
    if (eskiAy !== yeniAy) mesaiYolu(eskiAy); // ilk yazıştan önce denetle

    await this.degistir(
      yeniYol,
      (veri) => {
        const liste = listeAl(veri, 'satirlar', yeniYol);
        const sira = liste.findIndex((s) => s.id === kayit.id);
        const satirlar = sira === -1 ? [...liste, kayit] : liste.map((s, i) => (i === sira ? kayit : s));
        return { ...veri, satirlar };
      },
      { satirlar: [] },
    );
    if (eskiAy === yeniAy) return;

    try {
      await this.#satirKaldir(eskiAy, eski.id);
    } catch (hata) {
      throw new KismiTasimaHatasi({ cause: hata });
    }
  }

  async satirSil(satir) {
    await this.#satirKaldir(ayAnahtari(satir.tarih), satir.id);
  }

  async calisanEkle(ad) {
    const calisan = { id: yeniKimlik('c'), ad, aktif: true };
    await this.degistir(
      CALISANLAR_YOLU,
      (veri) => ({ ...veri, calisanlar: [...listeAl(veri, 'calisanlar', CALISANLAR_YOLU), calisan] }),
      { calisanlar: [] },
    );
    return calisan;
  }

  // Yalnızca verilen alanlar (ad, aktif) değişir. Çalışan yoksa hata atılır, bir şey yazılmaz.
  async calisanGuncelle(id, { ad, aktif } = {}) {
    await this.degistir(
      CALISANLAR_YOLU,
      (veri) => {
        const liste = listeAl(veri, 'calisanlar', CALISANLAR_YOLU);
        if (!liste.some((c) => c.id === id)) throw new Error(`Çalışan bulunamadı: ${String(id)}`);
        const calisanlar = liste.map((c) => {
          if (c.id !== id) return c;
          const guncel = { ...c };
          if (ad !== undefined) guncel.ad = ad;
          if (aktif !== undefined) guncel.aktif = aktif;
          return guncel;
        });
        return { ...veri, calisanlar };
      },
      { calisanlar: [] },
    );
  }

  async ayarlariKaydet(ayarlar) {
    await this.degistir(AYARLAR_YOLU, () => ayarlar, VARSAYILAN_AYARLAR);
  }

  async #satirKaldir(ay, id) {
    const yol = mesaiYolu(ay);
    await this.degistir(
      yol,
      (veri) => ({ ...veri, satirlar: listeAl(veri, 'satirlar', yol).filter((s) => s.id !== id) }),
      { satirlar: [] },
    );
  }

  // { veri, sha }. Dosya yoksa veri `varsayilan`ın kopyası, sha null. Çözülemezse BozukDosyaHatasi.
  // Kopya alınır: çağıran (ya da işlem) döndürülen nesneyi değiştirse de sabit varsayılan bozulmaz.
  async #oku(yol, varsayilan) {
    const { icerik, sha } = await this.#depo.oku(yol);
    if (icerik === null) return { veri: structuredClone(varsayilan), sha: null };
    try {
      return { veri: await coz(this.#anahtar, JSON.parse(icerik)), sha };
    } catch (hata) {
      // JSON.parse -> SyntaxError; yanlış anahtar, bozulmuş ya da eksik veri -> SifreHatasi.
      if (hata instanceof SyntaxError || hata instanceof SifreHatasi) {
        throw new BozukDosyaHatasi(yol, { cause: hata });
      }
      throw hata;
    }
  }
}
