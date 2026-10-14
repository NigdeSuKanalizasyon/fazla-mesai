import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hataMetni, BEKLENMEYEN } from '../uygulama/hatalar.js';
import { SifreHatasi } from '../uygulama/sifre.js';
import { GitHubHatasi } from '../uygulama/github.js';
import { BozukDosyaHatasi, KismiTasimaHatasi } from '../uygulama/kayitlar.js';

// spec 9'un metinleri, birebir
const METINLER = {
  yetki: "GitHub anahtarının süresi dolmuş. Anıl'a haber verin.",
  'depo-yok': "Kayıt deposuna ulaşılamıyor. Anıl'a haber verin.",
  cakisma: 'Kaydedilemedi, tekrar deneyin.',
  erisim: "GitHub'a şu an ulaşılamıyor. Birkaç dakika sonra tekrar deneyin.",
  internet: 'İnternet bağlantısı yok. Kayıtlar internetle açılır.',
};

test('hataMetni_sifre_hatasi', () => {
  assert.equal(hataMetni(new SifreHatasi()), 'Parola yanlış.');
  assert.equal(hataMetni(new SifreHatasi('Token kutusu biçimi geçersiz.')), 'Parola yanlış.');
});

test('hataMetni_github_turleri', () => {
  for (const [tur, metin] of Object.entries(METINLER)) {
    assert.equal(hataMetni(new GitHubHatasi(tur)), metin, tur);
  }
});

test('hataMetni_github_ic_mesaji_gostermez', () => {
  // github.js'in mesajları geliştirici içindir; arayüze hiçbiri çıkmaz.
  for (const tur of Object.keys(METINLER)) {
    const hata = new GitHubHatasi(tur, `İç ayrıntı ${tur} (HTTP 500)`);
    assert.notEqual(hataMetni(hata), hata.message);
    assert.ok(!hataMetni(hata).includes('HTTP'));
  }
});

test('hataMetni_bozuk_dosya', () => {
  assert.equal(hataMetni(new BozukDosyaHatasi('mesai/2026-10.json')), 'Bu ayın kaydı açılamadı.');
});

test('hataMetni_kismi_tasima_kendi_mesaji', () => {
  const hata = new KismiTasimaHatasi({ cause: new GitHubHatasi('erisim') });
  assert.equal(hataMetni(hata), hata.message);
  assert.equal(hataMetni(hata), 'Satır yeni aya eklendi ama eski aydan silinemedi. Eski aydaki kopyayı silin.');
});

test('hataMetni_bilinmeyen', () => {
  for (const hata of [new TypeError('x is undefined'), new Error('Çalışan bulunamadı: c_1'), 'metin', undefined, null]) {
    assert.equal(hataMetni(hata), BEKLENMEYEN);
  }
  assert.ok(!BEKLENMEYEN.includes('undefined'));
});
