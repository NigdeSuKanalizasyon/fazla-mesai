// Çalışanlar (spec 7.4): aktifler üstte, pasifler altta soluk ("Pasif" etiketiyle). Çalışan ekle,
// Adını düzelt, Pasife al / Aktif yap. Çalışan hiçbir zaman silinmez: eski satırlarda adı kalır.
//
// Ekleme ve ad düzeltme küçük bir pencerede (<dialog>) yapılır: klavye odağı içeride kalır, Esc kapatır,
// kapanınca odak açan düğmeye döner. Aynı ad ikinci kez kullanılamaz: karşılaştırma boşluklar kırpılıp
// toLocaleLowerCase('tr') ile yapılır (Işık = ışık, İlker = ilker). Pasif çalışanların adları da sayılır.
// Kayıt sürerken düğmeler pasiftir; hata olursa pencere açık kalır, ad durur, hata metni yazar. Bir yazış hata
// verdiyse (GitHub'a yine de ulaşmış olabilir) pencere nasıl kapanırsa kapansın liste tazelenir. Kayıt sürerken
// pencere yine de kapanırsa (Chrome'da art arda iki Esc ya da geri hareketi) sayfadan atılmaz: yazış düşerse
// yazılan adla yeniden açılır ve hata içinde yazar; yazış biterse kaldırılır.
// Ekranda yalnızca hataMetni() gösterilir.

import { bosKutu, eleman, hataKutusu, pencereKabi, yerTutucu } from './ortak.js';

const AYNI_AD = 'Bu adda bir çalışan zaten var.';
const AD_BOS = 'Ad soyadı yazın.';
const BOS_LISTE = 'Henüz çalışan yok.';

const ARTI = '<svg class="dugme-simge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';

let sayac = 0; // her pencerenin kimlikleri ayrı olsun

function adaGore(a, b) {
  return a.ad.localeCompare(b.ad, 'tr');
}

function adAnahtari(ad) {
  return String(ad ?? '').trim().toLocaleLowerCase('tr');
}

// haricId: ad düzeltmede çalışanın kendisi sayılmaz (yalnız harf büyüklüğünü düzeltebilsin).
function adKullanimda(calisanlar, ad, haricId = null) {
  const anahtar = adAnahtari(ad);
  return calisanlar.some((c) => c.id !== haricId && adAnahtari(c.ad) === anahtar);
}

// adPenceresiAc({ baglam, baslik, dugme, mesgulMetni, ad?, haricId?, kaydet(ad), bitti() })
//   kaydet  ad geçerli ve kullanılmıyorsa çağrılır (yazış); hata atarsa pencere açık kalır
//   bitti   kayıttan sonra (ya da hata veren bir yazıştan sonra) pencere kapanınca çağrılır: liste tazelenir
function adPenceresiAc({ baglam, baslik, dugme, mesgulMetni, ad = '', haricId = null, kaydet, bitti }) {
  const { kayitlar, hataMetni } = baglam;
  const k = `ap${++sayac}`;

  const pencere = document.createElement('dialog');
  pencere.className = 'onay ad-penceresi';
  pencere.setAttribute('aria-labelledby', `${k}-baslik`);
  pencere.innerHTML = `
    <form class="ad-formu" novalidate>
      <h2 class="onay-metni" id="${k}-baslik"></h2>
      <div class="alan-grubu">
        <label class="alan-etiketi" for="${k}-ad">Ad soyad</label>
        <input class="alan" id="${k}-ad" name="ad" type="text" autocomplete="off" autocapitalize="words"
          spellcheck="false" enterkeyhint="done" aria-describedby="${k}-hata">
        <p class="alan-hatasi" id="${k}-hata"></p>
      </div>
      <p class="form-hata" role="alert" tabindex="-1"></p>
      <div class="onay-dugmeleri">
        <button type="button" class="dugme dugme-ikincil vazgec-dugmesi">Vazgeç</button>
        <button type="submit" class="dugme dugme-ana kaydet-dugmesi"></button>
      </div>
    </form>`;
  pencere.querySelector('.onay-metni').textContent = baslik;
  const form = pencere.querySelector('form');
  const kutu = pencere.querySelector('input');
  const alanHatasi = pencere.querySelector('.alan-hatasi');
  const formHatasi = pencere.querySelector('.form-hata');
  const vazgecDugmesi = pencere.querySelector('.vazgec-dugmesi');
  const kaydetDugmesi = pencere.querySelector('.kaydet-dugmesi');
  kaydetDugmesi.textContent = dugme;
  kutu.value = ad;

  let mesgul = false;
  let tazelenmeli = false; // bir yazış hata verdi: kapanınca liste tazelenir

  function alanHatasiGoster(metin) {
    alanHatasi.textContent = metin ?? '';
    if (metin) kutu.setAttribute('aria-invalid', 'true');
    else kutu.removeAttribute('aria-invalid');
  }

  function kilitle(kilitli) {
    mesgul = kilitli;
    kutu.disabled = kilitli;
    vazgecDugmesi.disabled = kilitli;
    kaydetDugmesi.disabled = kilitli;
    kaydetDugmesi.textContent = kilitli ? mesgulMetni : dugme;
    if (kilitli) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }

  // Açıksa kapatır ('close' olayı pencereyi kaldırır); kayıt sürerken kapanmışsa sayfadan kaldırır.
  function kapat() {
    if (pencere.open) pencere.close();
    else pencere.remove();
  }

  // Kayıt sürerken kapanan pencereyi (yazılan ad içinde durur) yeniden açar.
  function yenidenAc() {
    if (!pencere.open && pencere.isConnected) pencere.showModal();
  }

  function sorunGoster(metin) {
    yenidenAc();
    formHatasi.textContent = metin;
    formHatasi.focus();
  }

  async function gonder() {
    if (mesgul) return; // çift basış, Enter: tek kayıt
    formHatasi.textContent = '';
    alanHatasiGoster(null);
    const yeniAd = kutu.value.trim();
    if (yeniAd === '') {
      alanHatasiGoster(AD_BOS);
      kutu.focus();
      return;
    }
    kilitle(true);
    try {
      // Başka bir cihaz bu arada aynı adı eklemiş olabilir: kontrol taze listeyle yapılır.
      const taze = await kayitlar.calisanlar();
      if (adKullanimda(taze, yeniAd, haricId)) {
        kilitle(false);
        yenidenAc();
        alanHatasiGoster(AYNI_AD);
        kutu.focus();
        return;
      }
      await kaydet(yeniAd);
    } catch (hata) {
      console.error(hata);
      tazelenmeli = true;
      kilitle(false);
      sorunGoster(hataMetni(hata));
      return;
    }
    tazelenmeli = false; // aşağıda zaten tazelenir
    kilitle(false);
    kapat();
    bitti();
  }

  pencere.addEventListener('cancel', (olay) => { if (mesgul) olay.preventDefault(); });
  pencere.addEventListener('close', () => {
    // Kayıt sürerken kapandıysa pencere sayfada kalır; yeniden açıldıktan sonra gelen eski olay da yok sayılır.
    if (mesgul || pencere.open) return;
    pencere.remove();
    if (tazelenmeli) bitti();
  });
  form.addEventListener('submit', (olay) => {
    olay.preventDefault();
    gonder();
  });
  vazgecDugmesi.addEventListener('click', () => { if (!mesgul) kapat(); });
  kutu.addEventListener('input', () => alanHatasiGoster(null));

  pencereKabi().append(pencere);
  pencere.showModal();
}

export function ekranCiz(kok, baglam) {
  const { kayitlar, hataMetni, bildir } = baglam;
  let istek = 0; // son liste isteğinin sırası
  let islemde = false; // pasife alma / aktif yapma yazışı sürüyor
  let yuklu = false; // liste en az bir kez geldi
  let calisanlar = []; // ekrandaki liste, aktifler üstte (satır düğmeleri bunu kullanır)

  const bolum = eleman('section', 'ekran-sutun');
  const baslik = eleman('h1', 'ekran-baslik', 'Çalışanlar');
  const ekleDugmesi = eleman('button', 'dugme dugme-ana dugme-calisan-ekle');
  ekleDugmesi.type = 'button';
  ekleDugmesi.innerHTML = ARTI;
  ekleDugmesi.append(eleman('span', '', 'Çalışan ekle'));
  const liste = eleman('div', 'calisanlar-liste');
  bolum.append(baslik, ekleDugmesi, liste);
  kok.replaceChildren(bolum);

  function satirOlustur(c) {
    const li = eleman('li', c.aktif ? 'calisan-satir' : 'calisan-satir calisan-pasif');
    li.dataset.calisan = c.id;
    const bilgi = eleman('div', 'calisan-bilgi');
    bilgi.append(eleman('span', 'calisan-ad', c.ad));
    if (!c.aktif) bilgi.append(eleman('span', 'etiket-pasif', 'Pasif'));

    const eylemler = eleman('div', 'calisan-eylemler');
    eylemler.setAttribute('role', 'group');
    eylemler.setAttribute('aria-label', c.ad);
    const duzelt = eleman('button', 'dugme dugme-ikincil dugme-kucuk', 'Adını düzelt');
    duzelt.type = 'button';
    duzelt.dataset.islem = 'duzelt';
    const durum = eleman('button', 'dugme dugme-ikincil dugme-kucuk', c.aktif ? 'Pasife al' : 'Aktif yap');
    durum.type = 'button';
    durum.dataset.islem = 'durum';
    eylemler.append(duzelt, durum);

    li.append(bilgi, eylemler);
    return li;
  }

  async function yukle() {
    const sira = ++istek;
    // Odak listedeki bir düğmedeyse (pencere kapanınca oraya döner) yenilenen listede aynı düğmeye geçer.
    const odakDugmesi = liste.contains(document.activeElement) ? document.activeElement.closest('[data-islem]') : null;
    const odak = odakDugmesi
      ? { id: odakDugmesi.closest('[data-calisan]')?.dataset.calisan, islem: odakDugmesi.dataset.islem }
      : null;
    liste.setAttribute('aria-busy', 'true');
    if (!yuklu) liste.replaceChildren(yerTutucu());
    let sonuc;
    try {
      sonuc = await kayitlar.calisanlar();
    } catch (hata) {
      if (sira !== istek || !liste.isConnected) return;
      console.error(hata);
      yuklu = false;
      liste.replaceChildren(hataKutusu(hataMetni(hata), () => yukle()));
      liste.removeAttribute('aria-busy');
      return;
    }
    if (sira !== istek || !liste.isConnected) return;
    yuklu = true;
    calisanlar = [...sonuc.filter((c) => c.aktif).sort(adaGore), ...sonuc.filter((c) => !c.aktif).sort(adaGore)];
    if (calisanlar.length === 0) {
      liste.replaceChildren(bosKutu(BOS_LISTE));
    } else {
      const ul = eleman('ul', 'kart-liste calisan-satirlar');
      ul.setAttribute('role', 'list');
      ul.append(...calisanlar.map(satirOlustur));
      liste.replaceChildren(ul);
    }
    liste.removeAttribute('aria-busy');
    if (odak?.id) {
      const ayni = liste.querySelector(`[data-calisan="${CSS.escape(odak.id)}"] [data-islem="${odak.islem}"]`);
      (ayni ?? ekleDugmesi).focus();
    }
  }

  // Yazış ve ardından liste yenilemesi bitene kadar ikinci bir düğme basışı yok sayılır.
  async function durumDegistir(c) {
    if (islemde) return;
    islemde = true;
    liste.setAttribute('aria-busy', 'true');
    try {
      await kayitlar.calisanGuncelle(c.id, { aktif: !c.aktif });
      await yukle();
    } catch (hata) {
      console.error(hata);
      bildir(hataMetni(hata));
      liste.removeAttribute('aria-busy');
    } finally {
      islemde = false;
    }
  }

  ekleDugmesi.addEventListener('click', () => {
    adPenceresiAc({
      baglam,
      baslik: 'Çalışan ekle',
      dugme: 'Ekle',
      mesgulMetni: 'Ekleniyor…',
      kaydet: (ad) => kayitlar.calisanEkle(ad),
      bitti: () => yukle(),
    });
  });

  liste.addEventListener('click', (olay) => {
    const dugme = olay.target.closest('[data-islem]');
    const satir = dugme?.closest('[data-calisan]');
    if (!dugme || !satir) return;
    const c = calisanlar.find((x) => x.id === satir.dataset.calisan);
    if (!c) return;
    if (dugme.dataset.islem === 'durum') {
      durumDegistir(c);
    } else {
      adPenceresiAc({
        baglam,
        baslik: 'Adını düzelt',
        dugme: 'Kaydet',
        mesgulMetni: 'Kaydediliyor…',
        ad: c.ad,
        haricId: c.id,
        kaydet: (ad) => kayitlar.calisanGuncelle(c.id, { ad }),
        bitti: () => yukle(),
      });
    }
  });

  return yukle();
}
