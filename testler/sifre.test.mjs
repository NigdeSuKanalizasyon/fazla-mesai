import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SifreHatasi,
  TEKRAR,
  anahtarUret,
  sifrele,
  coz,
  tokenKutusuOlustur,
  kutudanAnahtar,
  tokenCoz,
  b64,
  b64Coz,
} from '../uygulama/sifre.js';

const TEKRAR_TEST = 1000; // testlerde hız için; üretimde TEKRAR (600000) kullanılır
const tuzUret = () => globalThis.crypto.getRandomValues(new Uint8Array(16));

async function anahtar(parola = 'dogru-parola-12', tuz = new Uint8Array(16).fill(7)) {
  return anahtarUret(parola, tuz, TEKRAR_TEST);
}

// ---- Brief'teki testler ----

test('gidis_donus', async () => {
  const k = await anahtar();
  const nesne = { a: 'Çağrı Işık', n: [1, 2] };
  const dosya = await sifrele(k, nesne);
  assert.deepEqual(await coz(k, dosya), nesne);
});

test('iv_her_seferinde_farkli', async () => {
  const k = await anahtar();
  const nesne = { a: 'Şule Öztürk' };
  const bir = await sifrele(k, nesne);
  const iki = await sifrele(k, nesne);
  assert.notEqual(bir.iv, iki.iv);
});

test('yanlis_parola', async () => {
  const tuz = tuzUret();
  const dogru = await anahtarUret('dogru-parola-12', tuz, TEKRAR_TEST);
  const yanlis = await anahtarUret('yanlis-parola-12', tuz, TEKRAR_TEST);
  const dosya = await sifrele(dogru, { a: 'Ali Veli' });
  await assert.rejects(() => coz(yanlis, dosya), SifreHatasi);
});

test('token_kutusu', async () => {
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  const dogru = await kutudanAnahtar('dogru-parola-12', kutu);
  assert.equal(await tokenCoz(dogru, kutu), 'github_pat_x');
  const yanlis = await kutudanAnahtar('yanlis-parola-12', kutu);
  await assert.rejects(() => tokenCoz(yanlis, kutu), SifreHatasi);
});

test('anahtar_disari_alinamaz', async () => {
  const k = await anahtar();
  await assert.rejects(() => globalThis.crypto.subtle.exportKey('raw', k));
  assert.equal(k.extractable, false);
  assert.equal(k.algorithm.name, 'AES-GCM');
  assert.equal(k.algorithm.length, 256);
  assert.deepEqual([...k.usages].sort(), ['decrypt', 'encrypt']);
});

test('kutu_bicimi', async () => {
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  assert.deepEqual(Object.keys(kutu).sort(), ['iv', 'surum', 'tekrar', 'tuz', 'veri']);
  assert.equal(kutu.surum, 1);
  assert.equal(kutu.tekrar, TEKRAR_TEST);
  assert.equal(b64Coz(kutu.tuz).length, 16);
  assert.equal(b64Coz(kutu.iv).length, 12);
});

// ---- Ek testler ----

test('TEKRAR_600000', () => assert.equal(TEKRAR, 600000));

test('dosya_bicimi', async () => {
  const dosya = await sifrele(await anahtar(), { a: 1 });
  assert.deepEqual(Object.keys(dosya).sort(), ['iv', 'surum', 'veri']);
  assert.equal(dosya.surum, 1);
  assert.equal(b64Coz(dosya.iv).length, 12);
  assert.equal(typeof dosya.veri, 'string');
});

test('dosyada_duz_metin_yok', async () => {
  const dosya = await sifrele(await anahtar(), { ad: 'Çağrı Işık' });
  assert.ok(!JSON.stringify(dosya).includes('Çağrı'));
});

test('ayni_parola_tuz_tekrar_ayni_anahtar', async () => {
  const tuz = tuzUret();
  const a = await anahtarUret('dogru-parola-12', tuz, TEKRAR_TEST);
  const b = await anahtarUret('dogru-parola-12', tuz, TEKRAR_TEST);
  const dosya = await sifrele(a, { x: 1 });
  assert.deepEqual(await coz(b, dosya), { x: 1 });
});

test('farkli_tuz_coz_basarisiz', async () => {
  const a = await anahtarUret('dogru-parola-12', tuzUret(), TEKRAR_TEST);
  const b = await anahtarUret('dogru-parola-12', tuzUret(), TEKRAR_TEST);
  const dosya = await sifrele(a, { x: 1 });
  await assert.rejects(() => coz(b, dosya), SifreHatasi);
});

test('veri_degistirilirse_SifreHatasi', async () => {
  const k = await anahtar();
  const dosya = await sifrele(k, { a: 'Ali Veli' });
  const bayt = b64Coz(dosya.veri);
  bayt[0] ^= 1;
  await assert.rejects(() => coz(k, { ...dosya, veri: b64(bayt) }), SifreHatasi);
});

test('iv_degistirilirse_SifreHatasi', async () => {
  const k = await anahtar();
  const dosya = await sifrele(k, { a: 'Ali Veli' });
  const iv = b64Coz(dosya.iv);
  iv[0] ^= 1;
  await assert.rejects(() => coz(k, { ...dosya, iv: b64(iv) }), SifreHatasi);
});

test('bozuk_dosya_SifreHatasi', async () => {
  const k = await anahtar();
  const iyi = await sifrele(k, { a: 1 });
  const bozuklar = [
    null,
    undefined,
    'metin',
    42,
    {},
    { surum: 1 },
    { surum: 1, iv: iyi.iv },
    { surum: 1, veri: iyi.veri },
    { surum: 1, iv: '***', veri: iyi.veri }, // geçersiz base64
    { surum: 1, iv: iyi.iv, veri: '***' },
    { surum: 1, iv: 5, veri: iyi.veri }, // metin değil
    { surum: 1, iv: iyi.iv, veri: null },
    { surum: 1, iv: b64(new Uint8Array(5)), veri: iyi.veri }, // iv uzunluğu yanlış
    { surum: 2, iv: iyi.iv, veri: iyi.veri }, // bilinmeyen sürüm
    { iv: iyi.iv, veri: iyi.veri }, // sürüm yok
  ];
  for (const bozuk of bozuklar) {
    await assert.rejects(() => coz(k, bozuk), SifreHatasi, `beklenen SifreHatasi: ${JSON.stringify(bozuk)}`);
  }
});

test('hata_ham_DOMException_degil', async () => {
  const k = await anahtar();
  const dosya = await sifrele(k, { a: 1 });
  try {
    await coz(k, { ...dosya, veri: '***' });
    assert.fail('hata bekleniyordu');
  } catch (e) {
    assert.ok(e instanceof SifreHatasi);
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'SifreHatasi');
  }
});

test('farkli_turler_gidis_donus', async () => {
  const k = await anahtar();
  for (const deger of [null, 0, 'metin', true, [], [1, 'İ', { ç: 'ğ' }], { a: { b: { c: 'Şule Öztürk' } } }]) {
    assert.deepEqual(await coz(k, await sifrele(k, deger)), deger);
  }
});

test('sifrelenemeyen_deger_SifreHatasi', async () => {
  const k = await anahtar();
  await assert.rejects(() => sifrele(k, undefined), SifreHatasi);
});

test('bozuk_kutu_SifreHatasi', async () => {
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  const k = await kutudanAnahtar('dogru-parola-12', kutu);
  const bozuklar = [
    null,
    undefined,
    {},
    { ...kutu, tuz: undefined },
    { ...kutu, tuz: '***' },
    { ...kutu, tekrar: undefined },
    { ...kutu, tekrar: 'bin' },
    { ...kutu, tekrar: 0 },
    { ...kutu, tekrar: 1.5 },
  ];
  for (const bozuk of bozuklar) {
    await assert.rejects(() => kutudanAnahtar('dogru-parola-12', bozuk), SifreHatasi, `kutudanAnahtar: ${JSON.stringify(bozuk)}`);
  }
  const bozukVeri = [
    null,
    {},
    { ...kutu, iv: undefined },
    { ...kutu, veri: '***' },
    { ...kutu, veri: undefined },
    { ...kutu, surum: 2 },
  ];
  for (const bozuk of bozukVeri) {
    await assert.rejects(() => tokenCoz(k, bozuk), SifreHatasi, `tokenCoz: ${JSON.stringify(bozuk)}`);
  }
});

test('token_degistirilirse_SifreHatasi', async () => {
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  const k = await kutudanAnahtar('dogru-parola-12', kutu);
  const bayt = b64Coz(kutu.veri);
  bayt[bayt.length - 1] ^= 1;
  await assert.rejects(() => tokenCoz(k, { ...kutu, veri: b64(bayt) }), SifreHatasi);
});

test('token_kutusu_tuz_secenegi', async () => {
  const tuz = tuzUret();
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST, tuz });
  assert.deepEqual(b64Coz(kutu.tuz), tuz);
});

test('token_kutusu_her_seferinde_farkli_tuz_ve_iv', async () => {
  const bir = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  const iki = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', { tekrar: TEKRAR_TEST });
  assert.notEqual(bir.tuz, iki.tuz);
  assert.notEqual(bir.iv, iki.iv);
});

test('token_kutusu_varsayilan_tekrar_TEKRAR', async () => {
  // Tek seferlik üretim ayarı denetimi: seçenek verilmezse 600000 kullanılır.
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'github_pat_x');
  assert.equal(kutu.tekrar, TEKRAR);
});

test('token_turkce_karakter_gidis_donus', async () => {
  const kutu = await tokenKutusuOlustur('dogru-parola-12', 'şğüıöç-İĞÜ', { tekrar: TEKRAR_TEST });
  const k = await kutudanAnahtar('dogru-parola-12', kutu);
  assert.equal(await tokenCoz(k, kutu), 'şğüıöç-İĞÜ');
});

test('b64_gidis_donus', () => {
  assert.equal(b64(new Uint8Array(0)), '');
  assert.deepEqual(b64Coz(''), new Uint8Array(0));
  const tum = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(b64Coz(b64(tum)), tum);
  assert.equal(b64(new Uint8Array([72, 105])), 'SGk=');
  assert.deepEqual(b64Coz('SGk='), new Uint8Array([72, 105]));
});

test('b64_buyuk_veri_yigin_tasmaz', () => {
  const buyuk = new Uint8Array(3_000_000);
  for (let i = 0; i < buyuk.length; i++) buyuk[i] = (i * 31) & 0xff;
  const s = b64(buyuk);
  assert.equal(s, Buffer.from(buyuk).toString('base64'));
  assert.deepEqual(b64Coz(s), buyuk);
});

test('b64Coz_gecersiz_SifreHatasi', () => {
  assert.throws(() => b64Coz('***'), SifreHatasi);
  assert.throws(() => b64Coz(undefined), SifreHatasi);
  assert.throws(() => b64Coz(5), SifreHatasi);
});

test('buyuk_nesne_gidis_donus', async () => {
  const k = await anahtar();
  const nesne = { satirlar: Array.from({ length: 5000 }, (_, i) => ({ i, ad: 'Ali Veli', neden: 'Çalışma ' + i })) };
  assert.deepEqual(await coz(k, await sifrele(k, nesne)), nesne);
});
