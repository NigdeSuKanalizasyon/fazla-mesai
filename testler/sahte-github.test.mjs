// Sahte GitHub'ın kendisinin testi: sonraki görevlerin testleri ve ekran testleri
// bu davranışa güvenir, o yüzden gerçek Contents API'ye benzemesi burada sabitlenir.
// Bu dosya GitHubDepo'yu kullanmaz; doğrudan sahte.fetch ile konuşur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteGitHub } from './sahte-github.mjs';

const TABAN = 'https://api.github.com/repos/s/d';
const adres = (yol) => `${TABAN}/contents/${yol}`;

const b64 = (metin) => Buffer.from(metin, 'utf8').toString('base64');
const put = (sahte, yol, govde) =>
  sahte.fetch(adres(yol), { method: 'PUT', body: JSON.stringify(govde) });

test('olmayan_dosya_404', async () => {
  const sahte = sahteGitHub();
  const yanit = await sahte.fetch(adres('yok.json'));
  assert.equal(yanit.status, 404);
  assert.deepEqual(sahte.istekler, [{ yontem: 'GET', yol: 'yok.json' }]);
});

test('yeni_dosya_201_okununca_satir_satir_base64', async () => {
  const sahte = sahteGitHub();
  const icerik = 'Şule Öztürk ğüşiöç '.repeat(10); // base64'ü 60 karakterden uzun
  const yazildi = await put(sahte, 'mesai/2026-10.json', { message: 'm', content: b64(icerik) });
  assert.equal(yazildi.status, 201);
  const { content, commit } = await yazildi.json();
  assert.match(content.sha, /^[0-9a-f]{40}$/);
  assert.equal(content.path, 'mesai/2026-10.json');
  assert.equal(typeof commit.sha, 'string');
  assert.deepEqual(sahte.dosyalar.get('mesai/2026-10.json'), { icerik, sha: content.sha });

  const okundu = await sahte.fetch(adres('mesai/2026-10.json'));
  assert.equal(okundu.status, 200);
  const veri = await okundu.json();
  assert.equal(veri.type, 'file');
  assert.equal(veri.encoding, 'base64');
  assert.equal(veri.sha, content.sha);
  // Gerçek API gibi 60 karakterlik satırlar, sonda satır sonu.
  assert.ok(veri.content.includes('\n'));
  assert.ok(veri.content.endsWith('\n'));
  assert.ok(veri.content.split('\n').every((satir) => satir.length <= 60));
  assert.equal(Buffer.from(veri.content.replace(/\n/g, ''), 'base64').toString('utf8'), icerik);
});

test('var_olan_dosya_sha_kurallari', async () => {
  const sahte = sahteGitHub();
  const ilk = await (await put(sahte, 'a.json', { message: 'm', content: b64('bir') })).json();

  // sha yok -> 422
  assert.equal((await put(sahte, 'a.json', { message: 'm', content: b64('iki') })).status, 422);
  // yanlış sha -> 409
  assert.equal((await put(sahte, 'a.json', { message: 'm', content: b64('iki'), sha: 'x'.repeat(40) })).status, 409);
  // reddedilen yazışlar dosyayı değiştirmedi
  assert.deepEqual(sahte.dosyalar.get('a.json'), { icerik: 'bir', sha: ilk.content.sha });

  // doğru sha -> 200, yeni sha
  const guncel = await put(sahte, 'a.json', { message: 'm', content: b64('iki'), sha: ilk.content.sha });
  assert.equal(guncel.status, 200);
  const ikinci = await guncel.json();
  assert.notEqual(ikinci.content.sha, ilk.content.sha);
  assert.deepEqual(sahte.dosyalar.get('a.json'), { icerik: 'iki', sha: ikinci.content.sha });

  // eski sha artık bayat -> 409
  assert.equal((await put(sahte, 'a.json', { message: 'm', content: b64('uc'), sha: ilk.content.sha })).status, 409);
});

test('olmayan_dosyaya_sha_ile_yazmak_409', async () => {
  const sahte = sahteGitHub();
  const yanit = await put(sahte, 'a.json', { message: 'm', content: b64('x'), sha: 'x'.repeat(40) });
  assert.equal(yanit.status, 409);
  assert.equal(sahte.dosyalar.size, 0);
});

test('gecersiz_put_govdesi_422', async () => {
  const sahte = sahteGitHub();
  assert.equal((await put(sahte, 'a.json', { content: b64('x') })).status, 422, 'message yok');
  assert.equal((await put(sahte, 'a.json', { message: '', content: b64('x') })).status, 422, 'message boş');
  assert.equal((await put(sahte, 'a.json', { message: 'm' })).status, 422, 'content yok');
  assert.equal((await put(sahte, 'a.json', { message: 'm', content: 'bu base64 degil!' })).status, 422);
  const bozukJson = await sahte.fetch(adres('a.json'), { method: 'PUT', body: '{' });
  assert.equal(bozukJson.status, 400);
  assert.equal(sahte.dosyalar.size, 0);
});

test('bos_icerik_yazilabilir', async () => {
  const sahte = sahteGitHub();
  assert.equal((await put(sahte, 'bos.json', { message: 'm', content: '' })).status, 201);
  const veri = await (await sahte.fetch(adres('bos.json'))).json();
  assert.equal(veri.content, '');
  assert.equal(sahte.dosyalar.get('bos.json').icerik, '');
});

test('shalar_her_yazista_degisir', async () => {
  const sahte = sahteGitHub();
  const shalar = new Set();
  let sha;
  for (let i = 0; i < 5; i++) {
    const govde = { message: 'm', content: b64(`v${i}`) };
    if (sha) govde.sha = sha;
    ({ content: { sha } } = await (await put(sahte, 'a.json', govde)).json());
    shalar.add(sha);
  }
  assert.equal(shalar.size, 5);
});

test('klasor_listesi', async () => {
  const sahte = sahteGitHub();
  sahte.dosyalar.set('mesai/2026-10.json', { icerik: 'on', sha: 'a'.repeat(40) });
  sahte.dosyalar.set('mesai/2026-09.json', { icerik: 'dokuz', sha: 'b'.repeat(40) });
  sahte.dosyalar.set('mesai/eski/2025-12.json', { icerik: 'x', sha: 'c'.repeat(40) });
  sahte.dosyalar.set('ayarlar.json', { icerik: 'y', sha: 'd'.repeat(40) });

  const yanit = await sahte.fetch(adres('mesai'));
  assert.equal(yanit.status, 200);
  const liste = await yanit.json();
  assert.ok(Array.isArray(liste));
  const adlar = liste.map((e) => [e.name, e.path, e.type]);
  assert.deepEqual(
    adlar.sort(),
    [
      ['2026-09.json', 'mesai/2026-09.json', 'file'],
      ['2026-10.json', 'mesai/2026-10.json', 'file'],
      ['eski', 'mesai/eski', 'dir'],
    ],
  );

  assert.equal((await sahte.fetch(adres('yok'))).status, 404);
  // "mesai" önekiyle başlayan ama klasör olmayan ad klasör sayılmaz.
  sahte.dosyalar.set('mesai-yedek.json', { icerik: 'z', sha: 'e'.repeat(40) });
  assert.equal((await sahte.fetch(adres('mesai-yedek'))).status, 404);
});

test('onceden_konan_dosyaya_sha_atanir', async () => {
  const sahte = sahteGitHub();
  sahte.dosyalar.set('a.json', { icerik: 'bir' }); // sha verilmedi
  const veri = await (await sahte.fetch(adres('a.json'))).json();
  assert.match(veri.sha, /^[0-9a-f]{40}$/);
  // atanan sha kalıcıdır: o sha ile yazış kabul edilir
  assert.equal((await put(sahte, 'a.json', { message: 'm', content: b64('iki'), sha: veri.sha })).status, 200);
});

test('depo_adresi', async () => {
  const sahte = sahteGitHub();
  const yanit = await sahte.fetch(TABAN);
  assert.equal(yanit.status, 200);
  assert.deepEqual(sahte.istekler, [{ yontem: 'GET', yol: '' }]);
  // Başka bir ana makine / yol: gerçek API gibi 404
  assert.equal((await sahte.fetch('https://example.com/repos/s/d')).status, 404);
  assert.equal((await sahte.fetch(`${TABAN}/baska`)).status, 404);
});

test('yol_cozulur_ve_kaydedilir', async () => {
  const sahte = sahteGitHub();
  const yol = 'mesai/a b#c?d.json';
  const kodlu = yol.split('/').map(encodeURIComponent).join('/');
  assert.equal((await put(sahte, kodlu, { message: 'm', content: b64('x') })).status, 201);
  assert.ok(sahte.dosyalar.has(yol));
  assert.deepEqual(sahte.istekler, [{ yontem: 'PUT', yol }]);
});

test('desteklenmeyen_yontem_405', async () => {
  const sahte = sahteGitHub();
  assert.equal((await sahte.fetch(adres('a.json'), { method: 'DELETE' })).status, 405);
  assert.equal((await sahte.fetch(TABAN, { method: 'PUT' })).status, 405);
});

test('sonraki_yanit_siradaki_istekleri_dusurur', async () => {
  const sahte = sahteGitHub();
  sahte.sonrakiYanit(409, 2);
  const a = await put(sahte, 'a.json', { message: 'm', content: b64('x') });
  const b = await sahte.fetch(adres('a.json')); // yöntem fark etmez
  const c = await put(sahte, 'a.json', { message: 'm', content: b64('x') });
  assert.deepEqual([a.status, b.status, c.status], [409, 409, 201]);
  assert.equal((await a.json()).message, 'Sahte hata 409');
  // düşen istekler kayda geçer ama yan etkisi yoktur
  assert.deepEqual(sahte.istekler.map((i) => i.yontem), ['PUT', 'GET', 'PUT']);
  assert.equal(sahte.dosyalar.size, 1);
});

test('sonraki_yanit_varsayilan_bir_kez_ve_sirayla', async () => {
  const sahte = sahteGitHub();
  sahte.sonrakiYanit(500);
  sahte.sonrakiYanit(401, 2);
  const durumlar = [];
  for (let i = 0; i < 5; i++) durumlar.push((await sahte.fetch(TABAN)).status);
  assert.deepEqual(durumlar, [500, 401, 401, 200, 200]);
});

test('sonraki_yanit_gecersiz_arguman', () => {
  const sahte = sahteGitHub();
  assert.throws(() => sahte.sonrakiYanit(99), RangeError);
  assert.throws(() => sahte.sonrakiYanit('500'), RangeError);
  assert.throws(() => sahte.sonrakiYanit(500, 0), RangeError);
  assert.throws(() => sahte.sonrakiYanit(500, 1.5), RangeError);
});

test('govdesiz_durumlar_yanit_olusturur', async () => {
  const sahte = sahteGitHub();
  sahte.sonrakiYanit(204);
  const yanit = await sahte.fetch(TABAN);
  assert.equal(yanit.status, 204);
  assert.equal(await yanit.text(), '');
});

test('her_sahte_ayri_durum_tutar', async () => {
  const bir = sahteGitHub();
  const iki = sahteGitHub();
  await put(bir, 'a.json', { message: 'm', content: b64('x') });
  assert.equal(iki.dosyalar.size, 0);
  assert.equal(iki.istekler.length, 0);
});
