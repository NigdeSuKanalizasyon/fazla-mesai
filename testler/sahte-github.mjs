// Bellek içi sahte GitHub Contents API. SADECE testler içindir; ağa hiç çıkmaz.
//
//   const sahte = sahteGitHub();
//   new GitHubDepo({ ..., fetch: sahte.fetch });
//
// Dışarı verdikleri:
//   fetch                 fetch uyumlu işlev; gerçek `Response` döndürür.
//   dosyalar              Map<yol, { icerik, sha }>; icerik UTF-8 metindir. Testler buraya
//                         doğrudan dosya koyabilir (sha verilmezse ilk okunuşta atanır).
//   istekler              Gelen her isteğin kaydı: { yontem, yol }. yol = contents yolu
//                         (çözülmüş, örn. "mesai/2026-10.json"); depo adresi için ''.
//                         Sonraki yanıtla düşürülen istekler de kayda girer.
//   sonrakiYanit(d, k=1)  Sıradaki k isteği (yöntem fark etmez) HTTP d durumuyla düşürür;
//                         dosyalara dokunulmaz. Birden çok çağrı sıraya girer.
//
// Gerçek API'ye benzetilen davranış:
//   GET  /repos/{o}/{r}                  200 | 404 (bilinmeyen adres)
//   GET  /repos/{o}/{r}/contents/{dosya} 200 { type:'file', content (60'ar karakterlik
//                                        satırlar, satır sonlu base64), encoding:'base64', sha }
//   GET  /repos/{o}/{r}/contents/{klasor} 200 [{ name, path, type:'file'|'dir', sha, size }]
//   GET  .../contents/{olmayan}          404
//   PUT  .../contents/{dosya}            gövde { message, content (base64), sha? }
//        yeni dosya                      201 (sha verilmişse 409)
//        var olan dosya                  sha yok 422; sha eski/yanlış 409; doğru 200
//        message yok/boş, content yok ya da base64 değil: 422; gövde JSON değil: 400
//        yanıt                           { content: { name, path, sha, size }, commit: { sha, message } }
//   Diğer yöntemler                      405
// Her yazışta yeni, ardışık bir sha (40 onaltılık hane) üretilir. Sahte tek bir depo gibi
// davranır: adresteki sahip/depo adı yok sayılır, kimlik doğrulaması yoktur.

const BASE64_BICIMI = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SATIR_UZUNLUGU = 60; // GitHub base64'ü bu uzunlukta satırlara böler
const GOVDESIZ_DURUMLAR = new Set([204, 205, 304]); // Response bu durumlarda gövde kabul etmez
const KLASOR_SHA = '0'.repeat(40);

function yanitla(durum, govde) {
  return new Response(GOVDESIZ_DURUMLAR.has(durum) ? null : JSON.stringify(govde), {
    status: durum,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-ratelimit-remaining': '4999',
    },
  });
}

function base64Satirli(icerik) {
  const satirlar = Buffer.from(icerik, 'utf8').toString('base64').match(/.{1,60}/g) ?? [];
  return satirlar.length ? `${satirlar.join('\n')}\n` : '';
}

// "https://api.github.com/repos/{o}/{r}[/contents/{yol}]" -> { tur: 'depo'|'icerik', yol } | null
function adresCoz(adres) {
  let url;
  try {
    url = new URL(adres);
  } catch {
    return null;
  }
  if (url.origin !== 'https://api.github.com') return null;
  let parcalar;
  try {
    parcalar = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  if (parcalar[0] !== 'repos' || parcalar.length < 3) return null;
  if (parcalar.length === 3) return { tur: 'depo', yol: '' };
  if (parcalar[3] !== 'contents') return null;
  return { tur: 'icerik', yol: parcalar.slice(4).join('/') };
}

export function sahteGitHub() {
  const dosyalar = new Map();
  const istekler = [];
  const kuyruk = []; // { durum, kalan }
  let sayac = 0;

  const yeniSha = () => (sayac += 1).toString(16).padStart(40, '0');

  // Testin doğrudan koyduğu, sha'sız kaydı kalıcı bir sha ile tamamlar.
  function kayitBul(yol) {
    const kayit = dosyalar.get(yol);
    if (kayit && !kayit.sha) kayit.sha = yeniSha();
    return kayit;
  }

  function sonrakiYanit(durum, kez = 1) {
    if (!Number.isInteger(durum) || durum < 200 || durum > 599) {
      throw new RangeError('durum 200-599 arasında bir tam sayı olmalı.');
    }
    if (!Number.isInteger(kez) || kez < 1) {
      throw new RangeError('kez 1 ya da daha büyük bir tam sayı olmalı.');
    }
    kuyruk.push({ durum, kalan: kez });
  }

  function dosyaYaniti(yol, kayit) {
    return yanitla(200, {
      type: 'file',
      name: yol.split('/').pop(),
      path: yol,
      sha: kayit.sha,
      size: Buffer.byteLength(kayit.icerik, 'utf8'),
      encoding: 'base64',
      content: base64Satirli(kayit.icerik),
    });
  }

  function klasorYaniti(yol) {
    const onek = `${yol}/`;
    const girdiler = new Map(); // ad -> girdi (ekleme sırası korunur, sıralanmaz)
    for (const anahtar of dosyalar.keys()) {
      if (!anahtar.startsWith(onek)) continue;
      const geri = anahtar.slice(onek.length);
      const ayirac = geri.indexOf('/');
      if (ayirac === -1) {
        const kayit = kayitBul(anahtar);
        girdiler.set(geri, {
          name: geri,
          path: anahtar,
          sha: kayit.sha,
          size: Buffer.byteLength(kayit.icerik, 'utf8'),
          type: 'file',
        });
      } else {
        const ad = geri.slice(0, ayirac);
        if (!girdiler.has(ad)) {
          girdiler.set(ad, { name: ad, path: `${onek}${ad}`, sha: KLASOR_SHA, size: 0, type: 'dir' });
        }
      }
    }
    return girdiler.size ? yanitla(200, [...girdiler.values()]) : null;
  }

  function yaz(yol, govdeMetni) {
    let govde;
    try {
      govde = JSON.parse(govdeMetni);
    } catch {
      return yanitla(400, { message: 'Problems parsing JSON' });
    }
    if (govde === null || typeof govde !== 'object') {
      return yanitla(400, { message: 'Problems parsing JSON' });
    }
    if (typeof govde.message !== 'string' || govde.message === '') {
      return yanitla(422, { message: 'Invalid request.\n\n"message" wasn\'t supplied.' });
    }
    if (typeof govde.content !== 'string') {
      return yanitla(422, { message: 'Invalid request.\n\n"content" wasn\'t supplied.' });
    }
    const duzBase64 = govde.content.replace(/\n/g, '');
    if (!BASE64_BICIMI.test(duzBase64)) {
      return yanitla(422, { message: 'content is not valid Base64' });
    }

    const mevcut = kayitBul(yol);
    if (mevcut) {
      if (govde.sha === undefined || govde.sha === null) {
        return yanitla(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
      }
      if (govde.sha !== mevcut.sha) {
        return yanitla(409, { message: `${yol} does not match ${govde.sha}` });
      }
    } else if (govde.sha !== undefined && govde.sha !== null) {
      return yanitla(409, { message: `${yol} does not match ${govde.sha}` });
    }

    const icerik = Buffer.from(duzBase64, 'base64').toString('utf8');
    const sha = yeniSha();
    dosyalar.set(yol, { icerik, sha });
    return yanitla(mevcut ? 200 : 201, {
      content: { name: yol.split('/').pop(), path: yol, sha, size: Buffer.byteLength(icerik, 'utf8') },
      commit: { sha: yeniSha(), message: govde.message },
    });
  }

  async function fetch(adres, secenek = {}) {
    const yontem = String(secenek.method ?? 'GET').toUpperCase();
    const cozulen = adresCoz(String(adres));
    istekler.push({ yontem, yol: cozulen?.yol ?? '' });

    if (kuyruk.length > 0) {
      const sira = kuyruk[0];
      sira.kalan -= 1;
      if (sira.kalan === 0) kuyruk.shift();
      return yanitla(sira.durum, { message: `Sahte hata ${sira.durum}` });
    }

    if (!cozulen) return yanitla(404, { message: 'Not Found' });

    if (cozulen.tur === 'depo') {
      if (yontem !== 'GET') return yanitla(405, { message: 'Method Not Allowed' });
      return yanitla(200, { full_name: new URL(adres).pathname.split('/').slice(2, 4).join('/') });
    }

    const { yol } = cozulen;
    if (yontem === 'GET') {
      const kayit = kayitBul(yol);
      if (kayit) return dosyaYaniti(yol, kayit);
      return klasorYaniti(yol) ?? yanitla(404, { message: 'Not Found' });
    }
    if (yontem === 'PUT') return yaz(yol, secenek.body);
    return yanitla(405, { message: 'Method Not Allowed' });
  }

  return { fetch, dosyalar, sonrakiYanit, istekler };
}
