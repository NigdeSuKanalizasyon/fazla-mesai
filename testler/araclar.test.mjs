// Bakım araçları ve OKU.md: davranışlar testler/ekran/test_kurulum_araci.py'de denenir; burada
// değişmemesi gereken sözler ve güvenlik özellikleri denetlenir. geri-getir.ps1 bu ortamda
// çalıştırılamaz (PowerShell yok); gerçek depoda Görev 12'de Anıl'la denenir, burada yalnız metni denetlenir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('../', import.meta.url));
const ham = (yol) => readFileSync(join(KOK, yol));
const oku = (yol) => ham(yol).toString('utf8');
const kodOnlu = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/.*$/gm, '');

test('oku_md_zorunlu_satirlar', () => {
  const oku_md = oku('OKU.md');
  assert.ok(oku_md.includes("GitHub anahtarının bitiş tarihi: (Görev 12'de yazılacak)"));
  assert.ok(oku_md.includes('Bu klasöre şifresiz parola, şifresiz token ya da gerçek kişi adı konmaz.'));
  assert.ok(oku_md.includes('https://nigdesukanalizasyon.github.io/fazla-mesai/'));
  for (const kelime of ['Uygulamalar mağazası', '30 gün', 'Çıkış', 'kurulum.html', 'parola-degistir.html',
    'geri-getir.ps1', 'E/H', 'WhatsApp', 'fazla-mesai-veri', 'şifreli', 'çift tıklayınca **açılmaz**']) {
    assert.ok(oku_md.includes(kelime), `OKU.md'de yok: ${kelime}`);
  }
  assert.ok(oku_md.split('\n').length < 120, 'OKU.md kısa kalmalı');
});

// Son düzeltme turu (F2, F3, M3): token değişimi, yedek, aynı adres, geri getirme ve iPhone uyarıları.
test('oku_md_guvenlik_ve_bakim_notlari', () => {
  const oku_md = oku('OKU.md');
  for (const kelime of ['yeni bir token', 'yeni parolayı', "Token'ı yeniliyorum", 'eski token\'ı sil',
    'gh repo clone NigdeSuKanalizasyon/fazla-mesai-veri', 'git pull', 'nigdesukanalizasyon.github.io` adresindeki',
    'mesai-takip', 'Parola değişikliğinden önceki bir tarihe döndürme', '7 gün', 'ana ekrana ekle',
    'Bilgisayarda paylaşma menüsü açılmaz, PDF iner', '**Gönder**']) {
    assert.ok(oku_md.includes(kelime), `OKU.md'de yok: ${kelime}`);
  }
  const sira = ['yeni bir token', 'parola-degistir.html`** ile', "kurulum.html`**'de \"Token'ı yeniliyorum", 'eski token\'ı sil']
    .map((k) => oku_md.indexOf(k));
  assert.deepEqual([...sira].sort((a, b) => a - b), sira, 'adımlar sırayla: token, parola, kurulum, eskiyi sil');
});

test('oku_md_gercek_token_ya_da_parola_icermez', () => {
  const oku_md = oku('OKU.md');
  assert.ok(!/github_pat_[A-Za-z0-9_]{10,}|ghp_[A-Za-z0-9]{10,}/.test(oku_md));
  assert.ok(!/anilb|Users\\/i.test(oku_md), 'kullanıcı adı/yol yok');
});

test('kurulum_html_ag_istegi_yapmaz_ve_dis_kaynak_yuklemez', () => {
  const kod = kodOnlu(oku('araclar/kurulum.html'));
  for (const yasak of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
    assert.ok(!kod.includes(yasak), `kurulum.html'de olmamalı: ${yasak}`);
  }
  assert.ok(!/(?:src|href|action)=["']https?:/i.test(kod), 'dış adres yok');
  assert.ok(!/<form[^>]*\saction=/i.test(kod), 'formun gideceği adres yok');
  // modül yalnızca depodaki sifre.js'i içe aktarır
  assert.deepEqual([...kod.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['../uygulama/sifre.js']);
  assert.match(kod, /onsubmit="return false"/, 'betik çalışmasa da form adrese parola yazmasın');
});

test('parola_degistir_html_yalniz_kendi_dosyasi_ve_veri_deposu', () => {
  const kod = kodOnlu(oku('araclar/parola-degistir.html'));
  for (const yasak of ['XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB',
    'document.cookie']) {
    assert.ok(!kod.includes(yasak), `parola-degistir.html'de olmamalı: ${yasak}`);
  }
  assert.equal((kod.match(/fetch\(/g) ?? []).length, 1, 'tek fetch: ../veri/anahtar.json');
  assert.ok(kod.includes("const ANAHTAR_ADRESI = '../veri/anahtar.json';"));
  assert.deepEqual([...kod.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(),
    ['../uygulama/github.js', '../uygulama/sifre.js']);
  assert.ok(!/(?:src|href|action)=["']https?:/i.test(kod), 'dış adres yok');
  assert.match(kod, /onsubmit="return false"/);
});

test('araclar_sayfalari_ustte_dosyadan_acilmaz_notu_tasir', () => {
  for (const sayfa of ['araclar/kurulum.html', 'araclar/parola-degistir.html']) {
    const html = oku(sayfa);
    const govde = html.slice(html.indexOf('<body>'));
    assert.ok(govde.indexOf('çift tıklayarak açılmaz') > 0, sayfa);
    assert.ok(govde.indexOf('çift tıklayarak açılmaz') < govde.indexOf('<form'), `${sayfa}: not formdan önce olmalı`);
    assert.ok(html.includes("location.protocol === 'file:'"), sayfa);
  }
});

test('arac_css_magaza_renkleri_ve_dis_adres_yok', () => {
  const css = oku('araclar/arac.css');
  for (const deger of ['--boru: #1F6B4F', '--dugum: #C49A2C', '--zemin: #0F1C19', '--boru: #3FA27A']) {
    assert.ok(css.includes(deger), deger);
  }
  assert.ok(!/https?:\/\//.test(css));
  for (const m of css.matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(m[1].startsWith('../kutuphane/yazitipi/'), m[1]);
    assert.ok(readdirSync(join(KOK, 'kutuphane/yazitipi')).includes(m[1].split('/').pop()), `yazı tipi dosyası yok: ${m[1]}`);
  }
});

test('geri_getir_ps1_metni', () => {
  const bayt = ham('araclar/geri-getir.ps1');
  assert.deepEqual([...bayt.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'UTF-8 BOM (Windows PowerShell 5.1 Türkçe harfler için)');
  const ps = bayt.toString('utf8');
  assert.match(ps, /\[Parameter\(Mandatory = \$true\)\]\[string\]\$Yol/);
  assert.match(ps, /\[Parameter\(Mandatory = \$true\)\]\[string\]\$Tarih/);
  assert.ok(ps.includes("$Depo = 'NigdeSuKanalizasyon/fazla-mesai-veri'"));
  assert.ok(ps.includes('gh api'));
  assert.ok(ps.includes('commits?path='));
  assert.ok(ps.includes('until=$until'));
  assert.ok(ps.includes('per_page=1'));
  assert.ok(ps.includes('?ref=$($kayit.sha)'));
  assert.ok(ps.includes('"Geri getirildi: $Yol ($Tarih)"'));
  assert.ok(ps.includes("'--method', 'PUT'"));
  assert.ok(ps.includes('(E/H)'));
  // E/H sorusu yazmadan önce gelir
  assert.ok(ps.indexOf('Read-Host') < ps.indexOf("'PUT'"));
  // yalnızca veri dosyalarına izin verir
  assert.ok(ps.includes('calisanlar\\.json|ayarlar\\.json|mesai/\\d{4}-\\d{2}\\.json'));
  assert.ok(!/github_pat_|ghp_/.test(ps));
});
