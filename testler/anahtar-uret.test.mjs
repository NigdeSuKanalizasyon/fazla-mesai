import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { kutudanAnahtar, tokenCoz, SifreHatasi, TEKRAR } from '../uygulama/sifre.js';

const BETIK = fileURLToPath(new URL('./yardimci/anahtar-uret.mjs', import.meta.url));

function calistir(...argumanlar) {
  return spawnSync(process.execPath, [BETIK, ...argumanlar], { encoding: 'utf8' });
}

test('anahtar_uret_kutu_parolayla_acilir', async () => {
  const sonuc = calistir('deneme-parolasi-12', 'github_pat_deneme_abc', '1000');
  assert.equal(sonuc.status, 0, sonuc.stderr);
  const kutu = JSON.parse(sonuc.stdout);
  assert.equal(kutu.surum, 1);
  assert.equal(kutu.tekrar, 1000);
  assert.equal(await tokenCoz(await kutudanAnahtar('deneme-parolasi-12', kutu), kutu), 'github_pat_deneme_abc');
  await assert.rejects(async () => tokenCoz(await kutudanAnahtar('yanlis-parola-12', kutu), kutu), SifreHatasi);
});

test('anahtar_uret_tekrar_verilmezse_TEKRAR', () => {
  // Yalnızca kutunun alanına bakılır; 600.000 tekrarlı çözme testi yavaşlatır.
  const sonuc = calistir('deneme-parolasi-12', 'github_pat_deneme_abc');
  assert.equal(sonuc.status, 0, sonuc.stderr);
  assert.equal(JSON.parse(sonuc.stdout).tekrar, TEKRAR);
});

test('anahtar_uret_hatali_kullanim', () => {
  for (const argumanlar of [[], ['tek'], ['p', 't', 'sifir'], ['p', 't', '0'], ['p', 't', '1.5'], ['p', 't', '1', 'fazla']]) {
    const sonuc = calistir(...argumanlar);
    assert.notEqual(sonuc.status, 0, argumanlar.join(' '));
    assert.equal(sonuc.stdout, '');
    assert.match(sonuc.stderr, /Kullanım/);
  }
});
