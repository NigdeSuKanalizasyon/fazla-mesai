import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubDepo, GitHubHatasi } from '../uygulama/github.js';
import { sahteGitHub } from './sahte-github.mjs';

const TABAN = 'https://api.github.com/repos/sahip/depo';

function depoOlustur(fetch, secenek = {}) {
  return new GitHubDepo({ sahip: 'sahip', depo: 'depo', token: 't', fetch, ...secenek });
}

// Gelen istekleri (adres + seçenekler) kaydeden, sahteye ileten sarmalayıcı.
function kaydeden(sahte) {
  const cagrilar = [];
  const fetch = (adres, secenek) => {
    cagrilar.push({ adres: String(adres), secenek });
    return sahte.fetch(adres, secenek);
  };
  return { fetch, cagrilar };
}

// Verilen vaat GitHubHatasi (istenen türde) ile reddedilmeli.
function hataBekle(vaat, tur) {
  return assert.rejects(vaat, (hata) => {
    assert.ok(hata instanceof GitHubHatasi, `GitHubHatasi bekleniyordu: ${hata}`);
    assert.equal(hata.tur, tur);
    return true;
  });
}

const sabitYanit = (durum, basliklar = {}, govde = '') => () =>
  Promise.resolve(new Response(govde === '' ? null : govde, { status: durum, headers: basliklar }));

// ---- Brief'teki testler ----

test('oku_yok_bos_doner', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  assert.deepEqual(await depo.oku('mesai/2026-10.json'), { icerik: null, sha: null });
});

test('yaz_oku_turkce', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  const metin = 'Şule Öztürk ğüşiöç';

  const { sha: ilkSha } = await depo.yaz('calisanlar.json', metin, null, 'Çalışanlar');
  assert.match(ilkSha, /^[0-9a-f]{40}$/);
  assert.deepEqual(await depo.oku('calisanlar.json'), { icerik: metin, sha: ilkSha });
  assert.equal(sahte.dosyalar.get('calisanlar.json').icerik, metin);

  // doğru sha ile güncelleme: yeni sha
  const { sha: ikinciSha } = await depo.yaz('calisanlar.json', `${metin}!`, ilkSha, 'Çalışanlar');
  assert.notEqual(ikinciSha, ilkSha);
  assert.equal((await depo.oku('calisanlar.json')).icerik, `${metin}!`);

  // eski sha ile yazış: çakışma, dosya değişmez
  await hataBekle(depo.yaz('calisanlar.json', 'ezilmesin', ilkSha, 'Çalışanlar'), 'cakisma');
  assert.deepEqual(await depo.oku('calisanlar.json'), { icerik: `${metin}!`, sha: ikinciSha });
});

test('yeni_dosya_shasiz', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  const { sha } = await depo.yaz('ayarlar.json', '{}', null, 'Ayarlar');
  assert.equal(sahte.dosyalar.get('ayarlar.json').sha, sha);
  assert.equal(sahte.dosyalar.get('ayarlar.json').icerik, '{}');
});

test('hata_eslemesi', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);

  sahte.sonrakiYanit(401);
  await hataBekle(depo.oku('a.json'), 'yetki');

  sahte.sonrakiYanit(500);
  await hataBekle(depo.oku('a.json'), 'erisim');

  sahte.sonrakiYanit(409);
  await hataBekle(depo.yaz('a.json', 'x', null, 'm'), 'cakisma');

  sahte.sonrakiYanit(404);
  await hataBekle(depo.depoyuDenetle(), 'depo-yok');
});

test('ag_hatasi', async () => {
  const fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  const depo = depoOlustur(fetch);
  await hataBekle(depo.depoyuDenetle(), 'internet');
  await hataBekle(depo.oku('a.json'), 'internet');
  await hataBekle(depo.yaz('a.json', 'x', null, 'm'), 'internet');
  await hataBekle(depo.liste('mesai'), 'internet');
});

test('basliklar', async () => {
  const { fetch, cagrilar } = kaydeden(sahteGitHub());
  const depo = depoOlustur(fetch);
  await depo.oku('a.json');
  await depo.yaz('a.json', 'x', null, 'm');
  assert.equal(cagrilar.length, 2);
  for (const { secenek } of cagrilar) {
    const basliklar = new Headers(secenek.headers);
    assert.equal(basliklar.get('Authorization'), 'Bearer t');
    assert.equal(basliklar.get('X-GitHub-Api-Version'), '2022-11-28');
    assert.equal(basliklar.get('Accept'), 'application/vnd.github+json');
    assert.equal(secenek.cache, 'no-store');
  }
});

test('liste_klasor', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  // Bilerek sırasız yazılır: sıralama istemcinin işi.
  await depo.yaz('mesai/2026-10.json', 'on', null, 'Mesai: 2026-10');
  await depo.yaz('mesai/2026-09.json', 'dokuz', null, 'Mesai: 2026-09');
  await depo.yaz('ayarlar.json', '{}', null, 'Ayarlar');
  assert.deepEqual(await depo.liste('mesai'), ['mesai/2026-09.json', 'mesai/2026-10.json']);
  assert.deepEqual(await depo.liste('yok'), []);
});

// ---- Ek testler ----

test('yaz_govdesi_ve_adresler', async () => {
  const { fetch, cagrilar } = kaydeden(sahteGitHub());
  const depo = depoOlustur(fetch);
  const metin = 'Çağrı Işık';

  const { sha } = await depo.yaz('mesai/2026-10.json', metin, null, 'Mesai: 2026-10');
  await depo.yaz('mesai/2026-10.json', `${metin}2`, sha, 'Mesai: 2026-10');

  const [yeni, guncelleme] = cagrilar;
  assert.equal(yeni.adres, `${TABAN}/contents/mesai/2026-10.json`);
  assert.equal(yeni.secenek.method, 'PUT');
  assert.equal(new Headers(yeni.secenek.headers).get('Content-Type'), 'application/json');
  // sha null iken gövdede hiç sha anahtarı yok
  assert.deepEqual(JSON.parse(yeni.secenek.body), {
    message: 'Mesai: 2026-10',
    content: Buffer.from(metin, 'utf8').toString('base64'),
  });
  assert.deepEqual(JSON.parse(guncelleme.secenek.body), {
    message: 'Mesai: 2026-10',
    content: Buffer.from(`${metin}2`, 'utf8').toString('base64'),
    sha,
  });
});

test('okuma_istegi', async () => {
  const sahte = sahteGitHub();
  const { fetch, cagrilar } = kaydeden(sahte);
  const depo = depoOlustur(fetch);
  await depo.oku('ayarlar.json');
  await depo.liste('mesai');
  await depo.depoyuDenetle();
  assert.deepEqual(
    cagrilar.map((c) => [c.secenek.method, c.adres]),
    [
      ['GET', `${TABAN}/contents/ayarlar.json`],
      ['GET', `${TABAN}/contents/mesai`],
      ['GET', TABAN],
    ],
  );
  assert.deepEqual(sahte.istekler, [
    { yontem: 'GET', yol: 'ayarlar.json' },
    { yontem: 'GET', yol: 'mesai' },
    { yontem: 'GET', yol: '' },
  ]);
  // okuma isteklerinde gövde ve Content-Type yok
  for (const { secenek } of cagrilar) {
    assert.equal(secenek.body, undefined);
    assert.equal(new Headers(secenek.headers).get('Content-Type'), null);
  }
});

test('yol_parcalari_kodlanir_ayiracler_kalir', async () => {
  const sahte = sahteGitHub();
  const { fetch, cagrilar } = kaydeden(sahte);
  const depo = depoOlustur(fetch);
  const yol = 'mesai/a b#c?d%e.json';
  await depo.yaz(yol, 'x', null, 'm');
  assert.equal(cagrilar[0].adres, `${TABAN}/contents/mesai/a%20b%23c%3Fd%25e.json`);
  assert.ok(sahte.dosyalar.has(yol), 'sahte, kodlanmış adresi doğru çözmeli');
  assert.equal((await depo.oku(yol)).icerik, 'x');
});

test('sahip_ve_depo_adi_kodlanir', async () => {
  const { fetch, cagrilar } = kaydeden(sahteGitHub());
  await new GitHubDepo({ sahip: 'a b', depo: 'c/d', token: 't', fetch }).depoyuDenetle();
  assert.equal(cagrilar[0].adres, 'https://api.github.com/repos/a%20b/c%2Fd');
});

test('yol_bastaki_sondaki_egik_cizgi_temizlenir', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  await depo.yaz('/mesai/2026-10.json', 'x', null, 'm');
  assert.ok(sahte.dosyalar.has('mesai/2026-10.json'));
  assert.deepEqual(await depo.liste('mesai/'), ['mesai/2026-10.json']);
});

test('klasor_listesi_sadece_dosyalar', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  await depo.yaz('mesai/2026-10.json', 'x', null, 'm');
  await depo.yaz('mesai/eski/2025-12.json', 'y', null, 'm'); // alt klasör listede görünmez
  assert.deepEqual(await depo.liste('mesai'), ['mesai/2026-10.json']);
});

test('bos_dosya_null_degil', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  const { sha } = await depo.yaz('bos.json', '', null, 'm');
  assert.deepEqual(await depo.oku('bos.json'), { icerik: '', sha });
});

test('bom_ve_uzun_icerik_aynen_gider_gelir', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  // Başta BOM; ayrıca tek seferde fromCharCode'a verilemeyecek kadar büyük.
  const metin = `﻿${'Şule Öztürk ğüşiöç 😀 '.repeat(20000)}`;
  await depo.yaz('buyuk.json', metin, null, 'm');
  assert.equal(sahte.dosyalar.get('buyuk.json').icerik, metin);
  assert.equal((await depo.oku('buyuk.json')).icerik, metin);
});

test('hata_eslemesi_her_yontem', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  const islemler = {
    depoyuDenetle: () => depo.depoyuDenetle(),
    oku: () => depo.oku('a.json'),
    yaz: () => depo.yaz('a.json', 'x', null, 'm'),
    liste: () => depo.liste('mesai'),
  };
  const tablo = [
    [401, 'yetki'],
    [403, 'yetki'],
    [409, 'cakisma'],
    [422, 'cakisma'],
    [429, 'erisim'],
    [500, 'erisim'],
    [502, 'erisim'],
    [503, 'erisim'],
    [400, 'erisim'],
  ];
  for (const [yontem, islem] of Object.entries(islemler)) {
    for (const [durum, tur] of tablo) {
      sahte.sonrakiYanit(durum);
      await assert.rejects(islem(), (hata) => hata instanceof GitHubHatasi && hata.tur === tur, `${yontem} ${durum}`);
    }
  }
  assert.equal(sahte.dosyalar.size, 0);
});

test('404_yonteme_gore', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  sahte.sonrakiYanit(404);
  assert.deepEqual(await depo.oku('a.json'), { icerik: null, sha: null });
  sahte.sonrakiYanit(404);
  assert.deepEqual(await depo.liste('mesai'), []);
  sahte.sonrakiYanit(404);
  await hataBekle(depo.yaz('a.json', 'x', null, 'm'), 'depo-yok');
  sahte.sonrakiYanit(404);
  await hataBekle(depo.depoyuDenetle(), 'depo-yok');
});

test('depo_denetle_basarili', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  assert.equal(await depo.depoyuDenetle(), undefined);
});

test('yazista_sha_eksik_422_cakisma', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  await depo.yaz('a.json', 'bir', null, 'm');
  // var olan dosyaya sha'sız yazış (başka biri araya dosya eklemiş)
  await hataBekle(depo.yaz('a.json', 'iki', null, 'm'), 'cakisma');
  assert.equal(sahte.dosyalar.get('a.json').icerik, 'bir');
});

test('hiz_siniri_erisim_sayilir', async () => {
  // Gerçek API: 403 + x-ratelimit-remaining: 0 (ya da 429); yetki sorunu değil.
  const sinirli = depoOlustur(sabitYanit(403, { 'x-ratelimit-remaining': '0' }));
  await hataBekle(sinirli.oku('a.json'), 'erisim');
  await hataBekle(sinirli.yaz('a.json', 'x', null, 'm'), 'erisim');
  // İkincil sınır: retry-after başlığı
  await hataBekle(depoOlustur(sabitYanit(403, { 'retry-after': '30' })).oku('a.json'), 'erisim');
  await hataBekle(depoOlustur(sabitYanit(429)).oku('a.json'), 'erisim');
  // Hakkı kalmış 403 gerçekten yetki hatasıdır
  await hataBekle(depoOlustur(sabitYanit(403, { 'x-ratelimit-remaining': '4999' })).oku('a.json'), 'yetki');
  await hataBekle(depoOlustur(sabitYanit(403)).oku('a.json'), 'yetki');
});

test('zaman_asimi_erisim', async () => {
  // fetch, signal iptal edilince AbortError ile reddeder (gerçek tarayıcı davranışı)
  let imza;
  const fetch = (adres, { signal }) =>
    new Promise((_, reddet) => {
      imza = signal;
      signal.addEventListener('abort', () => reddet(new DOMException('The operation was aborted.', 'AbortError')));
    });
  await hataBekle(depoOlustur(fetch, { zamanAsimi: 20 }).oku('a.json'), 'erisim');
  assert.ok(imza.aborted);
});

test('zaman_asimi_signali_yoksayan_fetch', async () => {
  const fetch = () => new Promise(() => {}); // hiç dönmez
  await hataBekle(depoOlustur(fetch, { zamanAsimi: 20 }).depoyuDenetle(), 'erisim');
});

test('zaman_asimi_yanit_govdesi_takilirsa', async () => {
  const fetch = () =>
    Promise.resolve({ status: 200, headers: new Headers(), text: () => new Promise(() => {}) });
  await hataBekle(depoOlustur(fetch, { zamanAsimi: 20 }).oku('a.json'), 'erisim');
});

test('govde_okunurken_ag_kopmasi_internet', async () => {
  const fetch = () =>
    Promise.resolve({
      status: 200,
      headers: new Headers(),
      text: () => Promise.reject(new TypeError('network error')),
    });
  await hataBekle(depoOlustur(fetch).oku('a.json'), 'internet');
});

test('fetch_this_olmadan_cagrilir', async () => {
  // Tarayıcıda window.fetch bir nesnenin yöntemi gibi çağrılırsa "Illegal invocation" verir.
  const sahte = sahteGitHub();
  let gorulen = 'cagrilmadi';
  const fetch = function (...argumanlar) {
    gorulen = this;
    return sahte.fetch(...argumanlar);
  };
  await depoOlustur(fetch).depoyuDenetle();
  assert.equal(gorulen, undefined);
});

test('hata_ayrintilari', async () => {
  const sahte = sahteGitHub();
  const depo = depoOlustur(sahte.fetch);
  sahte.sonrakiYanit(401);
  const hata = await depo.oku('a.json').catch((h) => h);
  assert.ok(hata instanceof Error);
  assert.equal(hata.name, 'GitHubHatasi');
  assert.equal(hata.tur, 'yetki');
  assert.match(hata.message, /401/);
  assert.ok(!hata.message.includes('Bearer'), 'token mesaja sızmamalı');

  const ag = new TypeError('Failed to fetch');
  const agHatasi = await depoOlustur(() => Promise.reject(ag)).oku('a.json').catch((h) => h);
  assert.equal(agHatasi.cause, ag, 'asıl hata cause olarak saklanır');
});

test('github_hatasi_olusturucu', () => {
  const hata = new GitHubHatasi('cakisma');
  assert.ok(hata instanceof Error);
  assert.equal(hata.tur, 'cakisma');
  assert.ok(hata.message.length > 0, 'varsayılan Türkçe mesaj');
  assert.equal(new GitHubHatasi('erisim', 'özel').message, 'özel');
  for (const tur of ['yetki', 'depo-yok', 'cakisma', 'erisim', 'internet']) {
    assert.equal(new GitHubHatasi(tur).tur, tur);
  }
  assert.throws(() => new GitHubHatasi('baska'), TypeError);
  assert.throws(() => new GitHubHatasi(), TypeError);
});

test('beklenmeyen_yanit_erisim', async () => {
  const icerik = (alanlar) => JSON.stringify({ type: 'file', sha: 'a'.repeat(40), encoding: 'base64', content: 'eA==', ...alanlar });
  const yanitla = (govde) => depoOlustur(sabitYanit(200, {}, govde));

  // JSON olmayan 200 gövdesi
  await hataBekle(yanitla('<html>').oku('a.json'), 'erisim');
  // klasör yolu dosya diye okunmaya çalışılırsa
  await hataBekle(yanitla('[]').oku('mesai'), 'erisim');
  // dosya yolu klasör diye listelenirse
  await hataBekle(yanitla(icerik({})).liste('a.json'), 'erisim');
  // base64 olmayan içerik, base64 dışı kodlama (1 MB üstü dosyalar "none" döner), eksik sha
  await hataBekle(yanitla(icerik({ content: 'bu base64 değil!' })).oku('a.json'), 'erisim');
  await hataBekle(yanitla(icerik({ encoding: 'none', content: '' })).oku('a.json'), 'erisim');
  await hataBekle(yanitla(icerik({ sha: undefined })).oku('a.json'), 'erisim');
  // geçerli base64 ama UTF-8 değil (tek 0xFF baytı)
  await hataBekle(yanitla(icerik({ content: '/w==' })).oku('a.json'), 'erisim');
  // yazış yanıtında sha yok
  await hataBekle(yanitla('{}').yaz('a.json', 'x', null, 'm'), 'erisim');
  // iyi biçimli yanıt yine de çalışır (yardımcının kendisini doğrular), satır sonlu base64 dahil
  assert.deepEqual(await yanitla(icerik({ content: 'eA=\n=\n' })).oku('a.json'), { icerik: 'x', sha: 'a'.repeat(40) });
});

test('yanit_govdesi_olmayan_hatalar_yine_eslenir', async () => {
  // Gövdesi JSON olmayan 5xx (ör. HTML hata sayfası) da erisim olmalı.
  await hataBekle(depoOlustur(sabitYanit(502, {}, '<html>Bad Gateway</html>')).oku('a.json'), 'erisim');
  await hataBekle(depoOlustur(sabitYanit(401, {}, 'metin')).oku('a.json'), 'yetki');
});

test('olusturucu_argumanlari_denetlenir', () => {
  const temel = { sahip: 's', depo: 'd', token: 't', fetch: () => {} };
  assert.doesNotThrow(() => new GitHubDepo(temel));
  for (const alan of ['sahip', 'depo', 'token']) {
    assert.throws(() => new GitHubDepo({ ...temel, [alan]: '' }), TypeError, alan);
    assert.throws(() => new GitHubDepo({ ...temel, [alan]: undefined }), TypeError, alan);
    assert.throws(() => new GitHubDepo({ ...temel, [alan]: 5 }), TypeError, alan);
  }
  assert.throws(() => new GitHubDepo({ ...temel, fetch: 'fetch' }), TypeError);
  for (const kotu of [0, -1, NaN, Infinity, '15000']) {
    assert.throws(() => new GitHubDepo({ ...temel, zamanAsimi: kotu }), TypeError, String(kotu));
  }
});

test('yontem_argumanlari_denetlenir', async () => {
  const { fetch, cagrilar } = kaydeden(sahteGitHub());
  const depo = depoOlustur(fetch);
  for (const kotu of ['', '/', undefined, 5]) {
    await assert.rejects(depo.oku(kotu), TypeError, `oku ${String(kotu)}`);
    await assert.rejects(depo.liste(kotu), TypeError, `liste ${String(kotu)}`);
    await assert.rejects(depo.yaz(kotu, 'x', null, 'm'), TypeError, `yaz ${String(kotu)}`);
  }
  await assert.rejects(depo.yaz('a.json', undefined, null, 'm'), TypeError, 'icerik yok');
  await assert.rejects(depo.yaz('a.json', 5, null, 'm'), TypeError, 'icerik sayı');
  await assert.rejects(depo.yaz('a.json', 'x', null, ''), TypeError, 'mesaj boş');
  await assert.rejects(depo.yaz('a.json', 'x', null, undefined), TypeError, 'mesaj yok');
  await assert.rejects(depo.yaz('a.json', 'x', 5, 'm'), TypeError, 'sha sayı');
  await assert.rejects(depo.yaz('a.json', 'x', '', 'm'), TypeError, 'sha boş metin');
  assert.equal(cagrilar.length, 0, 'geçersiz argümanla ağa çıkılmaz');
  // sha undefined, null gibi sayılır
  await depo.yaz('a.json', 'x', undefined, 'm');
  assert.equal(cagrilar.length, 1);
});

test('token_nesneden_sizmaz', () => {
  const depo = new GitHubDepo({ sahip: 's', depo: 'd', token: 'gizli-token-123', fetch: () => {} });
  assert.ok(!JSON.stringify(depo).includes('gizli-token-123'));
  assert.ok(!Object.values(depo).some((d) => String(d).includes('gizli-token-123')));
});

test('zamanlayici_basarida_temizlenir', async () => {
  // Varsayılan 15 sn'lik zaman aşımı sayacı işlem bitince kalmamalı; kalsaydı
  // bu test dosyası 15 sn asılı kalırdı. Burada sayaç doğrudan ölçülür.
  const gercek = globalThis.setTimeout;
  const gercekTemizle = globalThis.clearTimeout;
  const acik = new Set();
  globalThis.setTimeout = (...a) => {
    const kimlik = gercek(...a);
    acik.add(kimlik);
    return kimlik;
  };
  globalThis.clearTimeout = (kimlik) => {
    acik.delete(kimlik);
    return gercekTemizle(kimlik);
  };
  try {
    const sahte = sahteGitHub();
    const depo = depoOlustur(sahte.fetch);
    await depo.oku('a.json');
    await depo.yaz('a.json', 'x', null, 'm');
    sahte.sonrakiYanit(500);
    await depo.oku('a.json').catch(() => {});
    assert.equal(acik.size, 0);
  } finally {
    globalThis.setTimeout = gercek;
    globalThis.clearTimeout = gercekTemizle;
  }
});
