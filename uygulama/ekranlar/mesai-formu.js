// Mesai ekle / Düzenle penceresi (spec 7.2). Telefonda tam ekran bir sayfa, geniş ekranda ortada bir
// pencere (stil.css). Yerleşik <dialog> ile açılır: klavye odağı içeride kalır, Esc kapatır, kapanınca
// odak pencereyi açan düğmeye döner.
//
// Eklemede bir ya da birden fazla aktif çalışan seçilir; her biri için ayrı satır açılır, hepsi tek
// tarihte olduğu için tek yazışla (aynı ay) kaydedilir. Satır kimlikleri pencere açılınca çalışan başına
// bir kez üretilir ve her denemede aynısı gönderilir: yanıtı kaybolmuş (ama GitHub'a ulaşmış) bir kayıttan
// sonra Kaydet'e yeniden basılırsa Kayitlar o satırları yeniden eklemez, kopya oluşmaz.
// Düzenlemede tek çalışan seçilir; satırın çalışanı sonradan pasife alınmışsa o çalışan kalabilir
// (kural pasif çalışanı SEÇMEYİ yasaklar), başka bir pasif çalışan seçilemez.
// Kurallar kurallar.js'ten gelir (satirDenetle); süre sure.js'ten (fazlaMesaiDakika). Kayıt sürerken
// düğme pasiftir; hata olursa pencere açık kalır, girilenler durur, hata metni formun üstünde yazar.
// Ekranda yalnızca hataMetni() gösterilir (KismiTasimaHatasi'nın mesajı da onun üzerinden gelir).

import { satirDenetle, satirTemizle, NEDEN_SINIRI } from '../kurallar.js';
import { fazlaMesaiDakika, sureYaz } from '../sure.js';
import { ayAnahtari, haftaGunu, istanbulSimdi } from '../tarih.js';
import { KismiTasimaHatasi, yeniKimlik } from '../kayitlar.js';

const GUN_ADLARI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;
const SAAT_BICIMI = /^([01]\d|2[0-3]):[0-5]\d$/;
const HATA_SIRASI = ['tarih', 'calisan', 'neden', 'saat'];

let sayac = 0; // her pencerenin kimlikleri ayrı olsun

export function gunAdi(tarih) {
  return GUN_ADLARI[haftaGunu(tarih) - 1];
}

// <input type="date"> ya boş ya da geçerli bir 'YYYY-MM-DD' verir.
function tarihMi(deger) {
  return TARIH_BICIMI.test(deger);
}

// Pencereler #uygulama'nın içine konur: ekranın stilleri (odak halkası, hareket azaltma) onlara da
// uyar, yazdırırken ekranla birlikte gizlenir. <dialog> yine de en üst katmanda açılır.
function kap() {
  return document.getElementById('uygulama') ?? document.body;
}

function saatDegeri(kutu) {
  return SAAT_BICIMI.test(kutu.value) ? kutu.value : null;
}

function adaGore(a, b) {
  return a.ad.localeCompare(b.ad, 'tr');
}

// mesaiFormuAc({ baglam, satir?, calisanlar?, degisince? })
//   satir       verilirse Düzenle (Sil de vardır), verilmezse Mesai ekle
//   calisanlar  ekranın elinde varsa (yoksa pencere kendisi yükler)
//   degisince   kayıttan/silmeden sonra (ve yarım kalan taşımada) çağrılır; eklemede { ay } ile.
//               Verilmezse baglam.yenile().
export function mesaiFormuAc({ baglam, satir = null, calisanlar = null, degisince = () => baglam.yenile() }) {
  const { kayitlar, bildir, hataMetni } = baglam;
  const duzenleme = satir !== null;
  const k = `mf${++sayac}`;
  const baslik = duzenleme ? 'Düzenle' : 'Mesai ekle';

  const pencere = document.createElement('dialog');
  pencere.className = 'pencere';
  pencere.setAttribute('aria-labelledby', `${k}-baslik`);
  pencere.innerHTML = `
    <form class="mesai-formu" novalidate>
      <header class="pencere-ust">
        <h2 class="pencere-baslik" id="${k}-baslik">${baslik}</h2>
      </header>
      <div class="pencere-govde">
        <p class="form-hata" role="alert" tabindex="-1"></p>
        <fieldset class="form-alanlar">
          <div class="alan-grubu">
            <label class="alan-etiketi" for="${k}-tarih">Tarih</label>
            <div class="tarih-satiri">
              <input class="alan" id="${k}-tarih" name="tarih" type="date" required aria-describedby="${k}-tarih-gun ${k}-tarih-hata">
              <span class="gun-adi" id="${k}-tarih-gun"></span>
            </div>
            <p class="alan-hatasi" id="${k}-tarih-hata"></p>
          </div>
          <fieldset class="alan-grubu secim" aria-describedby="${k}-calisan-hata">
            <legend class="alan-etiketi">Çalışanlar</legend>
            <div class="secim-listesi" aria-busy="true"></div>
            <p class="alan-hatasi" id="${k}-calisan-hata"></p>
          </fieldset>
          <div class="alan-grubu">
            <div class="etiket-satiri">
              <label class="alan-etiketi" for="${k}-neden">Mesai nedeni</label>
              <span class="sayac" id="${k}-sayac"></span>
            </div>
            <input class="alan" id="${k}-neden" name="neden" type="text" maxlength="${NEDEN_SINIRI}"
              autocomplete="off" enterkeyhint="done" aria-describedby="${k}-sayac ${k}-neden-hata">
            <p class="alan-hatasi" id="${k}-neden-hata"></p>
          </div>
          <div class="alan-grubu">
            <div class="saatler">
              <div class="saat-alani">
                <label class="alan-etiketi" for="${k}-baslama">Başlama</label>
                <input class="alan" id="${k}-baslama" name="baslama" type="time" aria-describedby="${k}-saat-hata">
              </div>
              <div class="saat-alani">
                <label class="alan-etiketi" for="${k}-bitis">Bitiş</label>
                <input class="alan" id="${k}-bitis" name="bitis" type="time" aria-describedby="${k}-saat-hata">
              </div>
            </div>
            <p class="pazar-notu" hidden>PAZAR — saat girilmez</p>
            <p class="alan-hatasi" id="${k}-saat-hata"></p>
            <p class="onizleme" hidden></p>
          </div>
        </fieldset>
        ${duzenleme ? '<button type="button" class="dugme dugme-tehlike sil-dugmesi">Sil</button>' : ''}
      </div>
      <footer class="pencere-alt">
        <button type="button" class="dugme dugme-ikincil vazgec-dugmesi">Vazgeç</button>
        <button type="submit" class="dugme dugme-ana kaydet-dugmesi">Kaydet</button>
      </footer>
    </form>`;

  const form = pencere.querySelector('form');
  const formHatasi = pencere.querySelector('.form-hata');
  const alanlar = pencere.querySelector('.form-alanlar');
  const tarihKutusu = pencere.querySelector(`#${k}-tarih`);
  const gunAlani = pencere.querySelector('.gun-adi');
  const secimListesi = pencere.querySelector('.secim-listesi');
  const nedenKutusu = pencere.querySelector(`#${k}-neden`);
  const sayacAlani = pencere.querySelector('.sayac');
  const saatler = pencere.querySelector('.saatler');
  const baslamaKutusu = pencere.querySelector(`#${k}-baslama`);
  const bitisKutusu = pencere.querySelector(`#${k}-bitis`);
  const pazarNotu = pencere.querySelector('.pazar-notu');
  const onizleme = pencere.querySelector('.onizleme');
  const silDugmesi = pencere.querySelector('.sil-dugmesi');
  const vazgecDugmesi = pencere.querySelector('.vazgec-dugmesi');
  const kaydetDugmesi = pencere.querySelector('.kaydet-dugmesi');
  const hataAlanlari = {
    tarih: pencere.querySelector(`#${k}-tarih-hata`),
    calisan: pencere.querySelector(`#${k}-calisan-hata`),
    neden: pencere.querySelector(`#${k}-neden-hata`),
    saat: pencere.querySelector(`#${k}-saat-hata`),
  };

  let tumCalisanlar = [];
  let mesgul = false; // kayıt ya da silme sürüyor
  const satirKimlikleri = new Map(); // calisanId -> satır kimliği (bu pencere boyunca aynı)

  function satirKimligi(calisanId) {
    if (!satirKimlikleri.has(calisanId)) satirKimlikleri.set(calisanId, yeniKimlik('s'));
    return satirKimlikleri.get(calisanId);
  }

  // Denetimde kullanılan çalışan listesi. Düzenlemede satırın kendi çalışanı pasif olsa da aktif sayılır.
  function denetimCalisanlari() {
    if (!duzenleme) return tumCalisanlar;
    return tumCalisanlar.map((c) => (c.id === satir.calisanId ? { ...c, aktif: true } : c));
  }

  // --- Başlangıç değerleri ---
  tarihKutusu.max = istanbulSimdi(new Date()).tarih;
  tarihKutusu.value = duzenleme ? satir.tarih : tarihKutusu.max;
  if (duzenleme) {
    nedenKutusu.value = satir.neden ?? '';
    baslamaKutusu.value = satir.baslama ?? '';
    bitisKutusu.value = satir.bitis ?? '';
  }

  // --- Çalışan listesi ---
  function secimCiz() {
    const aktifler = tumCalisanlar.filter((c) => c.aktif).sort(adaGore);
    const secenekler = [...aktifler];
    if (duzenleme) {
      // Satırın çalışanı sonradan pasife alınmışsa yine görünür (seçili) ve kalabilir.
      const mevcut = tumCalisanlar.find((c) => c.id === satir.calisanId);
      if (mevcut && !mevcut.aktif) secenekler.push(mevcut);
    }
    const tur = duzenleme ? 'radio' : 'checkbox';
    secimListesi.replaceChildren(...secenekler.map((c) => {
      const etiket = document.createElement('label');
      etiket.className = 'secim-satiri';
      const kutu = document.createElement('input');
      kutu.type = tur;
      kutu.name = `${k}-calisan`;
      kutu.value = c.id;
      kutu.checked = duzenleme && c.id === satir.calisanId;
      const ad = document.createElement('span');
      ad.className = 'secim-adi';
      ad.textContent = c.ad;
      etiket.append(kutu, ad);
      if (!c.aktif) {
        const pasif = document.createElement('span');
        pasif.className = 'etiket-pasif';
        pasif.textContent = 'Pasif';
        etiket.append(pasif);
      }
      return etiket;
    }));
    if (secenekler.length === 0) {
      const bos = document.createElement('p');
      bos.className = 'secim-bos';
      bos.textContent = 'Aktif çalışan yok. Önce Çalışanlar sekmesinden ekleyin.';
      secimListesi.append(bos);
    }
  }

  function secilenler() {
    return [...secimListesi.querySelectorAll('input:checked')].map((kutu) => kutu.value);
  }

  // --- Pazar, gün adı, süre önizlemesi, sayaç ---
  function gorunumGuncelle() {
    const tarih = tarihKutusu.value;
    const gecerli = tarihMi(tarih);
    const pazar = gecerli && haftaGunu(tarih) === 7;
    gunAlani.textContent = gecerli ? gunAdi(tarih) : '';
    saatler.hidden = pazar;
    pazarNotu.hidden = !pazar;
    if (pazar) hataGoster('saat', null);

    const baslama = saatDegeri(baslamaKutusu);
    const bitis = saatDegeri(bitisKutusu);
    const sureVar = gecerli && !pazar && baslama !== null && bitis !== null && bitis > baslama;
    onizleme.hidden = !sureVar;
    onizleme.textContent = sureVar ? `Fazla mesai: ${sureYaz(fazlaMesaiDakika(tarih, baslama, bitis))}` : '';
  }

  function sayacGuncelle() {
    sayacAlani.textContent = `${NEDEN_SINIRI - nedenKutusu.value.length}/${NEDEN_SINIRI}`;
  }

  // --- Hatalar ---
  function hataKutulari(alan) {
    if (alan === 'tarih') return [tarihKutusu];
    if (alan === 'neden') return [nedenKutusu];
    if (alan === 'saat') return [baslamaKutusu, bitisKutusu];
    return [];
  }

  function hataGoster(alan, metin) {
    hataAlanlari[alan].textContent = metin ?? '';
    for (const kutu of hataKutulari(alan)) {
      if (metin) kutu.setAttribute('aria-invalid', 'true');
      else kutu.removeAttribute('aria-invalid');
    }
    if (alan === 'calisan') {
      if (metin) secimListesi.setAttribute('data-hatali', '');
      else secimListesi.removeAttribute('data-hatali');
    }
  }

  function genelHata(metin) {
    formHatasi.textContent = metin ?? '';
  }

  function ilkHatayaOdaklan(hatalar) {
    const alan = HATA_SIRASI.find((a) => hatalar[a]);
    if (alan === 'calisan') {
      secimListesi.querySelector('input')?.focus();
    } else if (alan === 'saat') {
      (saatDegeri(baslamaKutusu) === null ? baslamaKutusu : bitisKutusu).focus();
    } else if (alan) {
      hataKutulari(alan)[0].focus();
    }
  }

  // --- Kayıt ---
  function kilitle(kilitli) {
    mesgul = kilitli;
    alanlar.disabled = kilitli;
    vazgecDugmesi.disabled = kilitli;
    kaydetDugmesi.disabled = kilitli;
    if (silDugmesi) silDugmesi.disabled = kilitli;
    kaydetDugmesi.textContent = kilitli ? 'Kaydediliyor…' : 'Kaydet';
    if (kilitli) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }

  // Girilenlerden kaydedilecek satır(lar). Çalışan seçilmemişse tek, çalışansız satır (kural uyarsın).
  function adaylar() {
    const pazar = tarihMi(tarihKutusu.value) && haftaGunu(tarihKutusu.value) === 7;
    const ortak = {
      tarih: tarihKutusu.value,
      neden: nedenKutusu.value,
      baslama: pazar ? null : saatDegeri(baslamaKutusu),
      bitis: pazar ? null : saatDegeri(bitisKutusu),
    };
    const kimlikler = secilenler();
    return (kimlikler.length > 0 ? kimlikler : [null]).map((calisanId) => ({ ...ortak, calisanId }));
  }

  async function kaydet() {
    if (mesgul) return; // çift basış, Enter: tek kayıt
    genelHata(null);
    for (const alan of HATA_SIRASI) hataGoster(alan, null);

    const satirlar = adaylar();
    const simdi = new Date();
    const denetimListesi = denetimCalisanlari();
    for (const aday of satirlar) {
      const { gecerli, hatalar } = satirDenetle(aday, { simdi, calisanlar: denetimListesi });
      if (!gecerli) {
        for (const [alan, metin] of Object.entries(hatalar)) hataGoster(alan, metin);
        ilkHatayaOdaklan(hatalar);
        return;
      }
    }

    kilitle(true);
    try {
      if (duzenleme) await kayitlar.satirGuncelle(satir, satirTemizle(satirlar[0]));
      else await kayitlar.satirlarEkle(satirlar.map((s) => ({ ...satirTemizle(s), id: satirKimligi(s.calisanId) })));
    } catch (hata) {
      console.error(hata);
      kilitle(false);
      sorunGoster(hataMetni(hata));
      if (hata instanceof KismiTasimaHatasi) degisince({}); // satır iki ayda; liste tazelensin
      return;
    }
    kilitle(false);
    kapat();
    bildir('Kaydedildi');
    degisince(duzenleme ? {} : { ay: ayAnahtari(satirlar[0].tarih) });
  }

  // Pencere açıksa formun üstünde; kapanmışsa (Esc ile kapanmış olabilir) alttaki bildirimde.
  function sorunGoster(metin) {
    if (!pencere.open) {
      bildir(metin);
      return;
    }
    genelHata(metin);
    formHatasi.focus();
  }

  // --- Silme (sorarak) ---
  function silmeyiSor() {
    const onay = document.createElement('dialog');
    onay.className = 'onay';
    onay.setAttribute('role', 'alertdialog');
    onay.setAttribute('aria-labelledby', `${k}-onay`);
    onay.innerHTML = `
      <p class="onay-metni" id="${k}-onay">Bu satır silinsin mi?</p>
      <div class="onay-dugmeleri">
        <button type="button" class="dugme dugme-ikincil" autofocus>Vazgeç</button>
        <button type="button" class="dugme dugme-tehlike-dolu">Sil</button>
      </div>`;
    const [vazgec, sil] = onay.querySelectorAll('button');
    let siliniyor = false;
    onay.addEventListener('cancel', (olay) => { if (siliniyor) olay.preventDefault(); });
    onay.addEventListener('close', () => onay.remove());
    vazgec.addEventListener('click', () => onay.close());
    sil.addEventListener('click', async () => {
      if (siliniyor) return;
      siliniyor = true;
      mesgul = true;
      vazgec.disabled = true;
      sil.disabled = true;
      try {
        await kayitlar.satirSil(satir);
      } catch (hata) {
        console.error(hata);
        mesgul = false;
        siliniyor = false;
        onay.close();
        sorunGoster(hataMetni(hata));
        return;
      }
      mesgul = false;
      onay.close();
      kapat();
      bildir('Silindi');
      degisince({});
    });
    kap().append(onay);
    onay.showModal();
  }

  // --- Açma, kapama ---
  function kapat() {
    if (pencere.open) pencere.close();
  }

  pencere.addEventListener('cancel', (olay) => { if (mesgul) olay.preventDefault(); });
  pencere.addEventListener('close', () => pencere.remove());
  form.addEventListener('submit', (olay) => {
    olay.preventDefault();
    kaydet();
  });
  vazgecDugmesi.addEventListener('click', () => { if (!mesgul) kapat(); });
  silDugmesi?.addEventListener('click', () => { if (!mesgul) silmeyiSor(); });
  tarihKutusu.addEventListener('input', () => { hataGoster('tarih', null); gorunumGuncelle(); });
  nedenKutusu.addEventListener('input', () => { hataGoster('neden', null); sayacGuncelle(); });
  for (const kutu of [baslamaKutusu, bitisKutusu]) {
    kutu.addEventListener('input', () => { hataGoster('saat', null); gorunumGuncelle(); });
  }
  secimListesi.addEventListener('change', () => hataGoster('calisan', null));

  sayacGuncelle();
  gorunumGuncelle();
  kap().append(pencere);
  pencere.showModal();

  const calisanVaadi = calisanlar ? Promise.resolve(calisanlar) : kayitlar.calisanlar();
  calisanVaadi
    .then((liste) => {
      tumCalisanlar = liste;
      secimCiz();
    })
    .catch((hata) => {
      console.error(hata);
      sorunGoster(hataMetni(hata));
    })
    .finally(() => secimListesi.removeAttribute('aria-busy'));
}
