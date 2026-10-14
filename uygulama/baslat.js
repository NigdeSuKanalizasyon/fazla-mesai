// Açılış akışı, ana ekran kabuğu (alttaki dört sekme) ve alttaki bildirim.
//
// Açılış: veri/anahtar.json (önbelleksiz) -> IndexedDB'deki oturum anahtarı -> token çözülür
// -> veri deposu denetlenir -> ana ekran. Oturum yoksa (ya da anahtar artık token'ı açmıyorsa:
// parola değişmiş) giriş ekranı. Oturum varken bir sorun çıkarsa parola sorulmaz; metin ve
// "Tekrar dene" gösterilir, oturum silinmez.
//
// Token ve anahtar yalnızca bellekte (Kayitlar/GitHubDepo içinde) durur; IndexedDB'ye yalnızca
// dışarı çıkarılamaz anahtar yazılır (oturum.js).

import { kutudanAnahtar, tokenCoz, SifreHatasi } from './sifre.js';
import { GitHubDepo, GitHubHatasi } from './github.js';
import { Kayitlar } from './kayitlar.js';
import { ayAnahtari, istanbulSimdi } from './tarih.js';
import { oturumGetir, oturumKaydet, oturumSil } from './oturum.js';
import { hataMetni } from './hatalar.js';
import { acilisCiz, girisCiz, sorunCiz } from './ekranlar/giris.js';
import * as cizelge from './ekranlar/cizelge.js';
import * as toplamlar from './ekranlar/toplamlar.js';
import * as calisanlar from './ekranlar/calisanlar.js';
import * as ayarlar from './ekranlar/ayarlar.js';

export { hataMetni };

export const VERI_SAHIBI = 'NigdeSuKanalizasyon';
export const VERI_DEPOSU = 'fazla-mesai-veri';

const ANAHTAR_DOSYASI = 'veri/anahtar.json';
const ZAMAN_ASIMI = 15000; // ms; github.js ile aynı
const BILDIRIM_SURESI = 2800; // ms

const SIMGE = 'class="sekme-simge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

const SEKMELER = [
  {
    kimlik: 'cizelge',
    ad: 'Çizelge',
    ekran: cizelge,
    simge: `<svg ${SIMGE}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 2.75v3.5M16 2.75v3.5M7.5 13.5h2.5M14 13.5h2.5M7.5 17h2.5"/></svg>`,
  },
  {
    kimlik: 'toplamlar',
    ad: 'Toplamlar',
    ekran: toplamlar,
    simge: `<svg ${SIMGE}><path d="M17.5 5.5h-11l6 6.5-6 6.5h11"/></svg>`,
  },
  {
    kimlik: 'calisanlar',
    ad: 'Çalışanlar',
    ekran: calisanlar,
    simge: `<svg ${SIMGE}><circle cx="9" cy="8.5" r="3.5"/><path d="M2.75 19.5c.7-3.2 3.1-5 6.25-5s5.55 1.8 6.25 5M15.25 5.2a3.5 3.5 0 0 1 0 6.6M17.75 14.9c1.9.6 3.1 2.2 3.5 4.6"/></svg>`,
  },
  {
    kimlik: 'ayarlar',
    ad: 'Ayarlar',
    ekran: ayarlar,
    simge: `<svg ${SIMGE}><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>`,
  },
];

// --- Açılış ------------------------------------------------------------------

export async function baslat(kok) {
  bildirimAlani(); // canlı bölge, ilk bildirimden önce sayfada olsun
  acilisCiz(kok);
  let kutu;
  try {
    kutu = await kutuGetir();
    const anahtar = await kayitliAnahtar();
    const token = anahtar && (await oturumTokeni(anahtar, kutu));
    if (token) {
      await anaEkranaGec(kok, { anahtar, token });
      return;
    }
  } catch (hata) {
    console.error(hata);
    sorunCiz(kok, { metin: hataMetni(hata), tekrarDene: () => baslat(kok) });
    return;
  }
  girisCiz(kok, { hataMetni, girisYap: (parola) => girisYap(kok, kutu, parola) });
}

// Token kutusu. Ağ yoksa 'internet'; dosya yoksa ya da biçimi bozuksa 'depo-yok' (Anıl'ın işi);
// GitHub Pages yanıt vermiyorsa 'erisim'.
async function kutuGetir() {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI);
  let yanit;
  let metin;
  try {
    yanit = await fetch(ANAHTAR_DOSYASI, { cache: 'no-store', signal: kontrol.signal });
    metin = await yanit.text();
  } catch (hata) {
    const tur = kontrol.signal.aborted ? 'erisim' : 'internet';
    throw new GitHubHatasi(tur, `${ANAHTAR_DOSYASI} okunamadı.`, { cause: hata });
  } finally {
    clearTimeout(zamanlayici);
  }
  if (yanit.status === 404) throw new GitHubHatasi('depo-yok', `${ANAHTAR_DOSYASI} yok (HTTP 404).`);
  if (!yanit.ok) throw new GitHubHatasi('erisim', `${ANAHTAR_DOSYASI} okunamadı (HTTP ${yanit.status}).`);
  let kutu = null;
  try {
    kutu = JSON.parse(metin);
  } catch {
    // aşağıda biçim hatası sayılır
  }
  if (!kutuBicimiDogru(kutu)) throw new GitHubHatasi('depo-yok', `${ANAHTAR_DOSYASI} biçimi geçersiz.`);
  return kutu;
}

// Biçim burada denetlenir; bozuk kutu sonradan "Parola yanlış." diye görünmesin.
function kutuBicimiDogru(kutu) {
  const metinMi = (deger) => typeof deger === 'string' && deger !== '';
  return kutu !== null && typeof kutu === 'object' && kutu.surum === 1
    && metinMi(kutu.tuz) && metinMi(kutu.iv) && metinMi(kutu.veri)
    && Number.isInteger(kutu.tekrar) && kutu.tekrar > 0;
}

// IndexedDB açılamazsa (gizli pencere vb.) oturum yok sayılır; parola sorulur.
async function kayitliAnahtar() {
  try {
    return await oturumGetir();
  } catch (hata) {
    console.warn('Oturum okunamadı.', hata);
    return null;
  }
}

// Kayıtlı anahtar token'ı açmıyorsa (parola değişmiş) oturum silinir, null döner.
async function oturumTokeni(anahtar, kutu) {
  try {
    return await tokenCoz(anahtar, kutu);
  } catch (hata) {
    if (!(hata instanceof SifreHatasi)) throw hata;
    await oturumSil().catch((silmeHatasi) => console.warn('Oturum silinemedi.', silmeHatasi));
    return null;
  }
}

async function girisYap(kok, kutu, parola) {
  const anahtar = await kutudanAnahtar(parola, kutu);
  const token = await tokenCoz(anahtar, kutu); // yanlış parola: SifreHatasi
  const depo = await depoAc(token);
  try {
    await oturumKaydet(anahtar);
  } catch (hata) {
    console.warn('Oturum kaydedilemedi; bir dahaki açılışta parola sorulur.', hata);
  }
  kabukCiz(kok, new Kayitlar({ depo, anahtar }));
}

async function anaEkranaGec(kok, { anahtar, token }) {
  const depo = await depoAc(token);
  kabukCiz(kok, new Kayitlar({ depo, anahtar }));
}

async function depoAc(token) {
  const depo = new GitHubDepo({ sahip: VERI_SAHIBI, depo: VERI_DEPOSU, token });
  await depo.depoyuDenetle();
  return depo;
}

// --- Ana ekran kabuğu -----------------------------------------------------------

// baglam = { kayitlar, durum: { ay: 'YYYY-MM' }, bildir, hataMetni, yenile(): Promise<void> }
// Her sekme modülü ekranCiz(kok, baglam) verir. Her çizimde yeni bir kok elementi verilir:
// sekme değişince eski, yarım kalmış çizim sayfadan kopmuş elemente yazar, ekranı bozmaz.
function kabukCiz(kok, kayitlar) {
  const sablon = document.createElement('template');
  sablon.innerHTML = `
    <div class="kabuk">
      <div class="ekran" tabindex="-1"></div>
      <nav class="sekmeler" aria-label="Sekmeler">
        ${SEKMELER.map((s) => `<button type="button" class="sekme" data-sekme="${s.kimlik}">${s.simge}<span>${s.ad}</span></button>`).join('')}
      </nav>
    </div>`;
  kok.replaceChildren(sablon.content);
  kok.removeAttribute('aria-busy');

  const ekranAlani = kok.querySelector('.ekran');
  const dugmeler = [...kok.querySelectorAll('.sekmeler [data-sekme]')];
  const durum = { ay: ayAnahtari(istanbulSimdi(new Date()).tarih) };
  let etkin = SEKMELER[0];

  const baglam = { kayitlar, durum, bildir, hataMetni, yenile: () => ciz() };

  async function ciz() {
    const alan = document.createElement('div');
    alan.className = 'ekran-icerik';
    alan.dataset.ekran = etkin.kimlik;
    ekranAlani.replaceChildren(alan);
    try {
      await etkin.ekran.ekranCiz(alan, baglam);
    } catch (hata) {
      console.error(hata);
      if (!alan.isConnected) return;
      const satir = document.createElement('p');
      satir.className = 'ekran-hata';
      satir.setAttribute('role', 'alert');
      satir.textContent = hataMetni(hata);
      alan.replaceChildren(satir);
    }
  }

  function sec(sekme) {
    etkin = sekme;
    for (const dugme of dugmeler) {
      if (dugme.dataset.sekme === sekme.kimlik) dugme.setAttribute('aria-current', 'page');
      else dugme.removeAttribute('aria-current');
    }
  }

  kok.querySelector('.sekmeler').addEventListener('click', (olay) => {
    const dugme = olay.target.closest('[data-sekme]');
    if (!dugme) return;
    const sekme = SEKMELER.find((s) => s.kimlik === dugme.dataset.sekme);
    window.scrollTo(0, 0);
    if (sekme === etkin) return;
    sec(sekme);
    ciz();
  });

  sec(etkin);
  ekranAlani.focus({ preventScroll: true });
  return ciz();
}

// --- Bildirim -----------------------------------------------------------------

let bildirimZamanlayici;

function bildirimAlani() {
  let alan = document.querySelector('.bildirim');
  if (!alan) {
    alan = document.createElement('div');
    alan.className = 'bildirim';
    alan.setAttribute('role', 'status');
    alan.setAttribute('aria-live', 'polite');
    document.body.append(alan);
  }
  return alan;
}

// Alttaki kısa bildirim; 2,8 saniye görünür. Yeni bildirim eskisinin yerine geçer.
export function bildir(metin) {
  const alan = bildirimAlani();
  alan.textContent = metin;
  alan.classList.add('gorunur');
  clearTimeout(bildirimZamanlayici);
  bildirimZamanlayici = setTimeout(() => alan.classList.remove('gorunur'), BILDIRIM_SURESI);
}
