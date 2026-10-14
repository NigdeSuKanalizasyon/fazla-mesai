// GitHub Contents API istemcisi. Yalnızca metin taşır; şifreleme bu modülün işi değil.
// fetch, AbortController, TextEncoder/TextDecoder ve btoa/atob kullanılır; aynı modül
// Node'da ve tarayıcıda çalışır. İstemciye verilen fetch, `Response` döndürmelidir.

import { b64, b64Coz } from './sifre.js';

const API = 'https://api.github.com';
const API_SURUMU = '2022-11-28';
const VARSAYILAN_ZAMAN_ASIMI = 15000; // ms

// Arayüz bu türe göre metin seçer (bkz. plan, Görev 7); her tür bir kullanıcı eylemine karşılık gelir.
const MESAJLAR = {
  yetki: 'GitHub anahtarı kabul edilmedi.',
  'depo-yok': 'Kayıt deposu bulunamadı.',
  cakisma: 'Dosya başka bir yerde değişmiş.',
  erisim: 'GitHub şu an yanıt vermiyor.',
  internet: 'İnternet bağlantısı kurulamadı.',
};

// tur: 'yetki' | 'depo-yok' | 'cakisma' | 'erisim' | 'internet'
export class GitHubHatasi extends Error {
  constructor(tur, mesaj, secenek) {
    if (!Object.hasOwn(MESAJLAR, tur)) {
      throw new TypeError(`Bilinmeyen GitHub hata türü: ${String(tur)}`);
    }
    super(mesaj ?? MESAJLAR[tur], secenek);
    this.name = 'GitHubHatasi';
    this.tur = tur;
  }
}

function metinDenetle(deger, ad) {
  if (typeof deger !== 'string' || deger === '') {
    throw new TypeError(`${ad} boş olmayan bir metin olmalı.`);
  }
  return deger;
}

// Baştaki/sondaki "/" atılır; geriye boş yol kalırsa hata.
function yolDuzelt(yol, ad) {
  return metinDenetle(metinDenetle(yol, ad).replace(/^\/+|\/+$/g, ''), ad);
}

// Her parça ayrı kodlanır, "/" ayıracı kalır.
function yolKodla(yol) {
  return yol.split('/').map(encodeURIComponent).join('/');
}

function beklenmeyenYanit(neden) {
  return new GitHubHatasi('erisim', 'GitHub beklenmeyen bir yanıt verdi.', neden ? { cause: neden } : undefined);
}

// 403 bir yetki sorunu değil, hız sınırı olabilir: hakkı bitmiş (remaining 0) ya da retry-after var.
function hizSiniriMi(basliklar) {
  return basliklar.get('x-ratelimit-remaining') === '0' || basliklar.has('retry-after');
}

// 2xx dışındaki her yanıtı bir GitHubHatasi'na çevirir; 2xx ise bir şey yapmaz.
// 404 burada depo-yok sayılır; 404'ü başka türlü yorumlayan yöntemler (oku, liste) bunu çağırmadan önce ayıklar.
function durumDenetle({ durum, basliklar }) {
  if (durum >= 200 && durum < 300) return;
  let tur;
  if (durum === 401) tur = 'yetki';
  else if (durum === 403) tur = hizSiniriMi(basliklar) ? 'erisim' : 'yetki';
  else if (durum === 404) tur = 'depo-yok';
  else if (durum === 409 || durum === 422) tur = 'cakisma';
  else tur = 'erisim'; // 429, 5xx ve beklenmeyen diğer durumlar
  throw new GitHubHatasi(tur, `${MESAJLAR[tur]} (HTTP ${durum})`);
}

function utf8Kodla(metin) {
  return b64(new TextEncoder().encode(metin));
}

// GitHub base64'ü 60 karakterlik satırlara böler; boşluk/satır sonları atılır.
function utf8Coz(base64) {
  try {
    const bayt = b64Coz(base64.replace(/\s+/g, ''));
    // fatal: bozuk UTF-8 sessizce değişmesin; ignoreBOM: baştaki BOM da aynen kalsın.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bayt);
  } catch (hata) {
    throw beklenmeyenYanit(hata);
  }
}

export class GitHubDepo {
  #sahip;
  #depo;
  #token;
  #fetch;
  #zamanAsimi;

  constructor({ sahip, depo, token, fetch = globalThis.fetch, zamanAsimi = VARSAYILAN_ZAMAN_ASIMI }) {
    this.#sahip = metinDenetle(sahip, 'sahip');
    this.#depo = metinDenetle(depo, 'depo');
    this.#token = metinDenetle(token, 'token');
    if (typeof fetch !== 'function') throw new TypeError('fetch bir işlev olmalı.');
    if (!Number.isFinite(zamanAsimi) || zamanAsimi <= 0) {
      throw new TypeError('zamanAsimi pozitif bir sayı (ms) olmalı.');
    }
    this.#fetch = fetch;
    this.#zamanAsimi = zamanAsimi;
  }

  // Depo erişilebilir mi? 404 -> 'depo-yok' (yanlış ad ya da token'ın o depoya izni yok).
  async depoyuDenetle() {
    durumDenetle(await this.#cagir('GET', this.#depoAdresi()));
  }

  // Dosya yoksa { icerik: null, sha: null }.
  async oku(yol) {
    const yanit = await this.#cagir('GET', this.#icerikAdresi(yolDuzelt(yol, 'yol')));
    if (yanit.durum === 404) return { icerik: null, sha: null };
    durumDenetle(yanit);
    const { veri } = yanit;
    if (
      veri === null ||
      typeof veri !== 'object' ||
      Array.isArray(veri) || // yol bir klasör
      veri.type !== 'file' ||
      veri.encoding !== 'base64' || // 1 MB üstü dosyalarda GitHub içerik vermez
      typeof veri.content !== 'string' ||
      typeof veri.sha !== 'string' ||
      veri.sha === ''
    ) {
      throw beklenmeyenYanit();
    }
    return { icerik: utf8Coz(veri.content), sha: veri.sha };
  }

  // sha: dosya zaten varsa okunduğu andaki sha; yeni dosyada null.
  async yaz(yol, icerik, sha, mesaj) {
    const duzYol = yolDuzelt(yol, 'yol');
    if (typeof icerik !== 'string') throw new TypeError('icerik bir metin olmalı.');
    const govde = { message: metinDenetle(mesaj, 'mesaj'), content: utf8Kodla(icerik) };
    if (sha !== null && sha !== undefined) govde.sha = metinDenetle(sha, 'sha');

    const yanit = await this.#cagir('PUT', this.#icerikAdresi(duzYol), govde);
    durumDenetle(yanit);
    const yeniSha = yanit.veri?.content?.sha;
    if (typeof yeniSha !== 'string' || yeniSha === '') throw beklenmeyenYanit();
    return { sha: yeniSha };
  }

  // Klasördeki dosyaların tam yolları (alt klasörler dahil değil), sıralı. Klasör yoksa [].
  async liste(klasor) {
    const yanit = await this.#cagir('GET', this.#icerikAdresi(yolDuzelt(klasor, 'klasor')));
    if (yanit.durum === 404) return [];
    durumDenetle(yanit);
    if (!Array.isArray(yanit.veri)) throw beklenmeyenYanit(); // yol bir dosya
    return yanit.veri
      .filter((girdi) => girdi !== null && typeof girdi === 'object' && girdi.type === 'file' && typeof girdi.path === 'string')
      .map((girdi) => girdi.path)
      .sort();
  }

  #depoAdresi() {
    return `${API}/repos/${encodeURIComponent(this.#sahip)}/${encodeURIComponent(this.#depo)}`;
  }

  #icerikAdresi(yol) {
    return `${this.#depoAdresi()}/contents/${yolKodla(yol)}`;
  }

  // İsteği gönderir, gövdeyi okur; sonuç { durum, basliklar, veri } (veri: ayrıştırılmış JSON ya da undefined).
  // Zaman aşımı gövdenin okunmasını da kapsar. Ağ hatası -> 'internet', zaman aşımı -> 'erisim'.
  async #cagir(yontem, adres, govde) {
    const basliklar = {
      Authorization: `Bearer ${this.#token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_SURUMU,
    };
    const kontrol = new AbortController();
    const secenek = { method: yontem, headers: basliklar, cache: 'no-store', signal: kontrol.signal };
    if (govde !== undefined) {
      basliklar['Content-Type'] = 'application/json';
      secenek.body = JSON.stringify(govde);
    }

    // `this.#fetch(...)` diye çağrılırsa tarayıcıda "Illegal invocation" olur; yerel değişkenle çağrılır.
    const istekYap = this.#fetch;
    let zamanlayici;
    let zamanAsti = false;
    const sureDoldu = new Promise((_, reddet) => {
      zamanlayici = setTimeout(() => {
        zamanAsti = true;
        kontrol.abort();
        reddet(new Error('Zaman aşımı'));
      }, this.#zamanAsimi);
    });

    try {
      const is = (async () => {
        const yanit = await istekYap(adres, secenek);
        const metin = await yanit.text();
        let veri;
        try {
          veri = JSON.parse(metin);
        } catch {
          veri = undefined; // JSON olmayan gövde (örn. HTML hata sayfası): durum kodu yine de eşlenir
        }
        return { durum: yanit.status, basliklar: yanit.headers, veri };
      })();
      // Yarış: signal'i yok sayan bir fetch bile zaman aşımını geciktiremez.
      return await Promise.race([is, sureDoldu]);
    } catch (hata) {
      if (zamanAsti) throw new GitHubHatasi('erisim', 'GitHub zamanında yanıt vermedi.', { cause: hata });
      throw new GitHubHatasi('internet', undefined, { cause: hata });
    } finally {
      clearTimeout(zamanlayici);
    }
  }
}
