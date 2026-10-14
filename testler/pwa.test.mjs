// Telefona yükleme: servis çalışanının önbellek listesi, manifest ve index.html bağlantıları.
// Davranış (çevrimdışı açılış, yüklenebilirlik) testler/ekran/test_cevrimdisi.py'de denenir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('../', import.meta.url));
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');
const var_mi = (yol) => existsSync(join(KOK, yol)) && statSync(join(KOK, yol)).isFile();

function jsDosyalari(klasor) {
  const sonuc = [];
  for (const girdi of readdirSync(join(KOK, klasor), { withFileTypes: true })) {
    const yol = `${klasor}/${girdi.name}`;
    if (girdi.isDirectory()) sonuc.push(...jsDosyalari(yol));
    else if (girdi.name.endsWith('.js')) sonuc.push(yol);
  }
  return sonuc;
}

// sw.js'teki DOSYALAR dizisi (kaynak metinden; sw.js tarayıcı dışında çalıştırılmaz).
function onbellekListesi() {
  const sw = oku('sw.js');
  const dizi = sw.match(/const DOSYALAR = \[([\s\S]*?)\];/);
  assert.ok(dizi, 'sw.js içinde `const DOSYALAR = [...]` yok');
  return [...dizi[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const liste = () => onbellekListesi().filter((d) => d !== './');

test('sw_onbellek_adi_ve_kapsam', () => {
  const sw = oku('sw.js');
  assert.match(sw, /const ONBELLEK = 'fazla-mesai-v1';/);
  assert.ok(!/https?:\/\//.test(sw.replace(/\/\/.*$/gm, '')), 'sw.js kodunda dış adres yok');
});

test('sw_listesi_yalniz_depoda_olan_dosyalar_ve_tekrarsiz', () => {
  const dosyalar = onbellekListesi();
  assert.ok(dosyalar.includes('./'), 'uygulamanın kök adresi (./) listede olmalı');
  assert.equal(new Set(dosyalar).size, dosyalar.length, 'listede tekrar var');
  for (const dosya of liste()) assert.ok(var_mi(dosya), `listede ama depoda yok: ${dosya}`);
});

test('sw_listesi_uygulama_modullerinin_hepsini_icerir', () => {
  const dosyalar = liste();
  for (const js of jsDosyalari('uygulama')) {
    assert.ok(dosyalar.includes(js), `önbellek listesinde yok: ${js} (çevrimdışı açılmaz)`);
  }
});

test('sw_listesi_sayfa_ve_kutuphane_dosyalarini_icerir', () => {
  const dosyalar = liste();
  for (const dosya of ['index.html', 'stil.css', 'manifest.webmanifest',
    'simge-180.png', 'simge-192.png', 'simge-512.png', 'simge-512-maskable.png',
    'kutuphane/jspdf.umd.min.js', 'kutuphane/figtree-400.ttf', 'kutuphane/figtree-600.ttf']) {
    assert.ok(dosyalar.includes(dosya), `önbellek listesinde yok: ${dosya}`);
  }
  // stil.css'in url() ile istediği yazı tipleri ve pdf.js'in yüklediği kütüphane dosyaları
  for (const m of oku('stil.css').matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    assert.ok(dosyalar.includes(m[1]), `önbellek listesinde yok: ${m[1]}`);
  }
  for (const m of oku('uygulama/pdf.js').matchAll(/['"`](?:\.\.\/)?kutuphane\/([^'"`$]+\.(?:js|ttf))['"`]/g)) {
    assert.ok(dosyalar.includes(`kutuphane/${m[1]}`), `önbellek listesinde yok: kutuphane/${m[1]}`);
  }
  // kutuphane/ içindeki çalışma zamanı dosyaları (yazı tipleri, PDF kütüphanesi) eksiksiz
  const yazitipleri = readdirSync(join(KOK, 'kutuphane/yazitipi')).map((d) => `kutuphane/yazitipi/${d}`);
  for (const dosya of yazitipleri) assert.ok(dosyalar.includes(dosya), `önbellek listesinde yok: ${dosya}`);
});

test('sw_listesinde_anahtar_json_ve_dis_adres_yok', () => {
  for (const dosya of onbellekListesi()) {
    assert.ok(!dosya.includes('anahtar.json'), 'anahtar.json önbelleğe alınmaz');
    assert.ok(!/^[a-z]+:\/\//i.test(dosya), `dış adres: ${dosya}`);
  }
});

test('manifest_alanlari', () => {
  const m = JSON.parse(oku('manifest.webmanifest'));
  assert.equal(m.name, 'Fazla Mesai');
  assert.equal(m.short_name, 'Fazla Mesai');
  assert.equal(m.lang, 'tr');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.match(m.theme_color, /^#[0-9A-Fa-f]{6}$/);
  assert.match(m.background_color, /^#[0-9A-Fa-f]{6}$/);
  const simgeler = new Map(m.icons.map((s) => [`${s.sizes}|${s.purpose ?? 'any'}`, s]));
  for (const anahtar of ['192x192|any', '512x512|any', '512x512|maskable']) {
    const s = simgeler.get(anahtar);
    assert.ok(s, `manifestte simge yok: ${anahtar}`);
    assert.equal(s.type, 'image/png');
    assert.ok(var_mi(s.src), `simge dosyası yok: ${s.src}`);
    assert.ok(liste().includes(s.src), `simge önbellek listesinde yok: ${s.src}`);
  }
});

test('index_manifest_simge_ve_servis_calisani_baglantilari', () => {
  const html = oku('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="simge-180\.png">/);
  assert.match(html, /<link rel="icon" type="image\/png"[^>]*href="simge-192\.png">/);
  assert.match(html, /serviceWorker\.register\(\s*'sw\.js'/);
  assert.match(html, /apple-mobile-web-app-title" content="Fazla Mesai"/);
  // varolan kabuk bozulmadı
  assert.match(html, /import \{ baslat \} from '\.\/uygulama\/baslat\.js'/);
  assert.ok(html.includes('<main id="uygulama" aria-busy="true"></main>'));
});

test('sw_listesi_import_zincirindeki_her_modulu_kapsar', () => {
  // index.html'den başlayıp göreli import'ları izler: zincirdeki her .js dosyası listede olmalı
  const dosyalar = liste();
  const gorulen = new Set();
  const sira = ['uygulama/baslat.js'];
  while (sira.length) {
    const yol = sira.pop();
    if (gorulen.has(yol)) continue;
    gorulen.add(yol);
    assert.ok(var_mi(yol), `import edilen dosya yok: ${yol}`);
    const klasor = yol.split('/').slice(0, -1).join('/');
    for (const m of oku(yol).matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      sira.push(relative('.', join(klasor, m[1])).split('\\').join('/'));
    }
  }
  for (const yol of gorulen) assert.ok(dosyalar.includes(yol), `import zincirinde ama önbellek listesinde yok: ${yol}`);
});
