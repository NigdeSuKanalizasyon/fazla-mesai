# Fazla Mesai Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sadece GitHub üzerinde çalışan, kayıtları şifreli tutan, telefonda ve bilgisayarda açılan, kâğıt formun aynısı çıktı veren Fazla Mesai web uygulaması.

**Architecture:** Derlemesiz, sunucusuz statik site (`fazla-mesai`, Public, GitHub Pages). Bütün iş tarayıcıda: parola → PBKDF2 → AES-GCM anahtarı; kayıtlar `fazla-mesai-veri` (Private) deposundan GitHub Contents API ile şifreli okunur/yazılır. Saf mantık modülleri (süre, kurallar, şifre, GitHub, kayıtlar, toplamlar, çıktı) DOM'suz ES modülleridir ve Node'da test edilir; ekranlar ince DOM katmanıdır ve Playwright ile test edilir.

**Tech Stack:** Düz HTML/CSS/JS (ES modülleri), Web Crypto, IndexedDB, jsPDF 3.0.1 (depoya gömülü), Node 22+ `node --test`, Python Playwright + pytest.

**Spec:** `docs/superpowers/specs/2026-10-14-fazla-mesai-design.md`

## Global Constraints

- Sadece GitHub. Cloudflare ya da başka sunucu yok. Çalışırken dış site (CDN, Google Fonts) yüklenmez; her şey depoda.
- Derleme adımı yok. Tarayıcı dosyaları olduğu gibi yükler (`<script type="module">`).
- Veri deposu: `NigdeSuKanalizasyon/fazla-mesai-veri`. Yollar: `calisanlar.json`, `ayarlar.json`, `mesai/YYYY-MM.json`.
- Şifreleme: PBKDF2-SHA256, **600.000** tekrar, 16 bayt tuz → AES-GCM 256; her yazışta yeni 12 bayt `iv`. Anahtar **non-extractable**.
- Şifreli dosya: `{ "surum": 1, "iv": "<b64>", "veri": "<b64>" }`. `veri/anahtar.json`: `{ "surum": 1, "tuz": "<b64>", "tekrar": 600000, "iv": "<b64>", "veri": "<b64 şifreli token>" }`.
- Oturum: IndexedDB adı `fazla-mesai`, deposu `oturum`; **30 gün**. Diğer bütün tarayıcı depolama anahtarları `fazla-mesai.` ile başlar.
- Kurallar: hafta içi **18:00** sonrası; cumartesi tamamı; pazar saatsiz "PAZAR"; gece yarısını aşma yok; ileri tarih/saat yok (Europe/Istanbul); neden **en fazla 60** karakter; hafta içi 0 dakikalık satır kaydedilmez.
- Çıktı: yatay A4, sayfada **20** satır, başlık + imza alanı her sayfada.
- Çakışmada en fazla **3** deneme (toplam).
- Kullanıcının gördüğü bütün metinler Türkçe ve bu plandaki/spec'teki kelimelerle birebir.
- Depoya hiçbir zaman şifresiz parola, şifresiz token ya da gerçek kişi adı girmez. Testlerde uydurma adlar: "Ali Veli", "Çağrı Işık", "Şule Öztürk".
- Görünüm: mağazanın renk değişkenleri (`--boru #1F6B4F`, `--dugum #C49A2C`, koyu tema dahil) ve yazı tipleri (Bricolage Grotesque 700, Figtree 400/500/600) — woff2 dosyaları `kutuphane/yazitipi/` içinde.
- **Çalışma düzeni:** Çalışma kopyası `/mnt/user-data/outputs/fazla-mesai` (kendi git'i var). Her görevin son adımı: (1) orada commit; (2) değişen dosyalar `device_commit_files` ile `C:\Users\anilb\Desktop\Projeler\Fazla Mesai\` altına yazılır ve orada aynı mesajla commit edilir (Anıl'ın bilgisayarı, PowerShell). Commit mesajları şu iki satırla biter:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_0129qZDHVxkL4Nqi1iBWZXW9`
- GitHub'a gönderim yalnızca Görev 12'de.

## Review Focus

1. **Cihaz saati/saat dilimi farklı** (bilgisayar UTC'ye ayarlı, gece 00:30): "bugün" ve "gelmemiş saat" her zaman Europe/Istanbul'a göre hesaplanmalı. → Görev 1 testi `istanbulSimdi_gece_yarisi`.
2. **Kaydet'e iki kez hızlı basmak** (yavaş ağ): tek satır oluşmalı. → Görev 9 testi `test_kaydet_cift_tiklama_tek_satir`.
3. **Türkçe harfler** (İ, ı, Ş, Ğ, Ç): PDF'te bozulmadan görünmeli, adlar Türkçe alfabeye göre sıralanmalı. → Görev 6 `ayToplamlari_turkce_siralama`, Görev 7 `pdf_turkce_harfler`.
4. **Kayıt sırasında token geçersiz (401)**: kullanıcı girdiğini kaybetmemeli, açık mesaj görmeli, sessizce çıkış yapılmamalı. → Görev 9 testi `test_kayit_401_form_korunur`.
5. **Ay değiştiren düzenlemede ikinci yazışın başarısız olması**: satır kaybolmamalı, uyarı çıkmalı. → Görev 5 testi `satirGuncelle_tasima_yarim_kalirsa_uyarir`.

---

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `index.html` | Kabuk: yazı tipleri, CSS, `<main id="uygulama">`, `uygulama/baslat.js` |
| `stil.css` | Bütün ekran stilleri + yazdırma stilleri |
| `uygulama/tarih.js` | İstanbul saati, ay yardımcıları, tarih yazımı |
| `uygulama/sure.js` | Fazla mesai dakika hesabı ve süre yazımı |
| `uygulama/kurallar.js` | Satır doğrulama, hata metinleri |
| `uygulama/sifre.js` | Anahtar üretme, şifrele/çöz, token kutusu |
| `uygulama/github.js` | Contents API istemcisi, hata sınıflandırma |
| `uygulama/kayitlar.js` | Şifreli kayıt deposu: oku, değiştir (çakışma), satır/çalışan/ayar işlemleri |
| `uygulama/oturum.js` | IndexedDB'de 30 günlük anahtar |
| `uygulama/toplamlar.js` | Kişi başı aylık toplam |
| `uygulama/cikti.js` | Sayfalama, yazdırma HTML'i, ortak ölçüler |
| `uygulama/pdf.js` | jsPDF ile PDF, paylaş/indir |
| `uygulama/baslat.js` | Açılış akışı, sekmeler, bildirim |
| `uygulama/ekranlar/{giris,cizelge,mesai-formu,toplamlar,calisanlar,ayarlar}.js` | Ekranlar |
| `kutuphane/` | `jspdf.umd.min.js` (3.0.1), `figtree-400.ttf`, `figtree-600.ttf`, `yazitipi/*.woff2` |
| `veri/anahtar.json` | Şifreli token (Görev 12'de üretilir) |
| `manifest.webmanifest`, `sw.js`, `simge-*.png` | Telefona yükleme, hızlı açılış |
| `araclar/kurulum.html`, `araclar/parola-degistir.html`, `araclar/geri-getir.ps1` | Bakım araçları |
| `testler/*.test.mjs` | Node testleri; `testler/sahte-github.mjs` ortak sahte API |
| `testler/ekran/` | pytest + Playwright ekran testleri |
| `OKU.md` | Anıl için kullanım ve bakım notu |

---

### Task 1: İskelet, tarih ve süre hesabı

**Files:**
- Create: `package.json`, `.gitignore`, `uygulama/tarih.js`, `uygulama/sure.js`
- Test: `testler/tarih.test.mjs`, `testler/sure.test.mjs`

**Interfaces:**
- Produces:
  - `istanbulSimdi(simdi: Date): { tarih: 'YYYY-MM-DD', saat: 'HH:MM' }`
  - `haftaGunu(tarih: 'YYYY-MM-DD'): 1..7` (pazartesi 1, pazar 7; saat diliminden bağımsız)
  - `ayAnahtari(tarih): 'YYYY-MM'`, `ayKaydir(ay: 'YYYY-MM', adim: number): 'YYYY-MM'`, `ayAdi(ay): 'Ekim 2026'`, `tarihYaz(tarih): 'GG.AA.YYYY'`
  - `fazlaMesaiDakika(tarih, baslama: 'HH:MM'|null, bitis: 'HH:MM'|null): number`
  - `sureYaz(dakika: number): string`, `toplamYaz(dakika: number, pazar: number): string`

- [ ] **Step 1: İskelet.** `package.json`: `{ "name": "fazla-mesai", "private": true, "type": "module", "scripts": { "test": "node --test testler/" } }`. `.gitignore`: `node_modules/`, `.pytest_cache/`, `__pycache__/`, `testler/ekran/cikti/`. Spec'i Anıl'ın klasöründen bu kopyaya almak gerekmez, zaten burada.

- [ ] **Step 2: Failing testler**

```js
// testler/tarih.test.mjs
test('istanbulSimdi_gece_yarisi', () => {
  assert.deepEqual(istanbulSimdi(new Date('2026-10-14T21:30:00Z')), { tarih: '2026-10-15', saat: '00:30' });
});
test('haftaGunu', () => { assert.equal(haftaGunu('2026-10-12'), 1); assert.equal(haftaGunu('2026-10-17'), 6); assert.equal(haftaGunu('2026-10-18'), 7); });
test('ayKaydir_yil_gecisi', () => { assert.equal(ayKaydir('2026-12', 1), '2027-01'); assert.equal(ayKaydir('2026-01', -1), '2025-12'); });
test('ayAdi', () => assert.equal(ayAdi('2026-10'), 'Ekim 2026'));
test('tarihYaz', () => assert.equal(tarihYaz('2026-10-05'), '05.10.2026'));
```

```js
// testler/sure.test.mjs
test('hafta_ici_18_sonrasi', () => assert.equal(fazlaMesaiDakika('2026-10-14', '17:00', '19:40'), 100));
test('hafta_ici_18_once_biter', () => assert.equal(fazlaMesaiDakika('2026-10-14', '16:00', '17:30'), 0));
test('hafta_ici_18_den_baslar', () => assert.equal(fazlaMesaiDakika('2026-10-14', '18:30', '20:00'), 90));
test('cumartesi_tamami', () => assert.equal(fazlaMesaiDakika('2026-10-17', '08:00', '12:15'), 255));
test('pazar_sifir', () => assert.equal(fazlaMesaiDakika('2026-10-18', null, null), 0));
test('sureYaz', () => { assert.equal(sureYaz(100), '1 saat 40 dakika'); assert.equal(sureYaz(60), '1 saat'); assert.equal(sureYaz(40), '40 dakika'); assert.equal(sureYaz(0), '0 dakika'); });
test('toplamYaz', () => { assert.equal(toplamYaz(760, 2), '12 saat 40 dakika + 2 pazar'); assert.equal(toplamYaz(760, 0), '12 saat 40 dakika'); assert.equal(toplamYaz(0, 1), '1 pazar'); });
```

- [ ] **Step 3: Çalıştır, düştüğünü gör.** `node --test testler/` → FAIL (modül yok).

- [ ] **Step 4: Uygula.** `istanbulSimdi` → `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', ... hourCycle: 'h23' })`. `haftaGunu` → tarihi UTC öğlen olarak kur, `getUTCDay()` (0→7). Saatleri dakikaya çevirip hesapla; yuvarlama yok.

- [ ] **Step 5: Geçtiğini gör.** `node --test testler/` → PASS (12 test).

- [ ] **Step 6: Commit** — `İskelet, tarih ve süre hesabı` (iki yerde, bkz. Çalışma düzeni).

---

### Task 2: Kurallar

**Files:**
- Create: `uygulama/kurallar.js`
- Test: `testler/kurallar.test.mjs`

**Interfaces:**
- Consumes: `istanbulSimdi`, `haftaGunu`, `fazlaMesaiDakika` (Task 1)
- Produces: `satirDenetle(satir: {tarih, calisanId, neden, baslama, bitis}, baglam: {simdi: Date, calisanlar: {id, ad, aktif}[]}): { gecerli: boolean, hatalar: { tarih?, calisan?, neden?, saat?: string } }`; `NEDEN_SINIRI = 60`.

Hata metinleri (birebir):

| Alan | Durum | Metin |
|---|---|---|
| tarih | boş ya da bugünden sonra | `İleri bir tarihe kayıt girilemez.` (boşsa `Tarih seçin.`) |
| calisan | boş / listede yok | `Çalışan seçin.` |
| calisan | pasif | `Pasif çalışan seçilemez.` |
| neden | boş (boşluk dahil) | `Mesai nedenini yazın.` |
| neden | > 60 | `Mesai nedeni en fazla 60 karakter olabilir.` |
| saat | pazar dışı, biri boş | `Başlama ve bitiş saatini girin.` |
| saat | bitiş ≤ başlama | `Bitiş, başlamadan sonra olmalı.` |
| saat | bugün ve bitiş > şimdi | `Bitiş saati henüz gelmedi.` |
| saat | hafta içi ve dakika 0 | `Bu saatlerde fazla mesai yok (hafta içi 18:00'den sonrası sayılır).` |

Pazar satırında `baslama`/`bitis` dolu gelirse hata değil; `satirDenetle` geçerli sayar ve çağıran bunları `null`'a çevirir (bkz. `satirTemizle`).
- Also produces: `satirTemizle(satir): satir` — neden'i kırpar (`trim`), pazar ise saatleri `null` yapar.

- [ ] **Step 1: Failing testler** (`simdi = new Date('2026-10-14T16:00:00Z')` = İstanbul 19:00; calisanlar: `c1` aktif "Ali Veli", `c2` pasif "Şule Öztürk")
  - `gecerli_hafta_ici`: `{tarih:'2026-10-13', calisanId:'c1', neden:'Arıza', baslama:'17:00', bitis:'19:40'}` → `gecerli: true`, `hatalar: {}`
  - `ileri_tarih`: tarih `'2026-10-15'` → `hatalar.tarih === 'İleri bir tarihe kayıt girilemez.'`
  - `bugun_gelmemis_saat`: tarih `'2026-10-14'`, `18:00`–`19:30` → `hatalar.saat === 'Bitiş saati henüz gelmedi.'`; `18:00`–`19:00` → geçerli
  - `pasif_calisan`: `c2` → `'Pasif çalışan seçilemez.'`
  - `neden_61`: `'a'.repeat(61)` → `'Mesai nedeni en fazla 60 karakter olabilir.'`; `'a'.repeat(60)` geçerli
  - `bitis_once`: `21:00`–`20:00` → `'Bitiş, başlamadan sonra olmalı.'`
  - `hafta_ici_sifir`: `'2026-10-13'`, `16:00`–`17:30` → hafta içi sıfır metni
  - `pazar_saatsiz_gecerli`: `'2026-10-11'`, saatler `null` → geçerli
  - `satirTemizle_pazar`: pazar + `'10:00'`/`'12:00'` + neden `'  X '` → saatler `null`, neden `'X'`
- [ ] **Step 2:** `node --test testler/kurallar.test.mjs` → FAIL.
- [ ] **Step 3: Uygula** `satirDenetle`, `satirTemizle`. Her alan için ilk hatayı yaz; bir alanda birden fazla hata gösterilmez.
- [ ] **Step 4:** `node --test testler/` → PASS.
- [ ] **Step 5: Commit** — `Kurallar`.

---

### Task 3: Şifreleme

**Files:**
- Create: `uygulama/sifre.js`
- Test: `testler/sifre.test.mjs`

**Interfaces:**
- Produces:
  - `class SifreHatasi extends Error`
  - `TEKRAR = 600000`
  - `anahtarUret(parola: string, tuz: Uint8Array, tekrar: number): Promise<CryptoKey>` (AES-GCM 256, `extractable: false`, kullanım `['encrypt','decrypt']`)
  - `sifrele(anahtar, nesne: any): Promise<{surum:1, iv, veri}>` (JSON → UTF-8 → AES-GCM)
  - `coz(anahtar, dosya): Promise<any>` — doğrulama tutmazsa `SifreHatasi`
  - `tokenKutusuOlustur(parola, token: string, secenek?: {tekrar?: number, tuz?: Uint8Array}): Promise<{surum:1, tuz, tekrar, iv, veri}>`
  - `kutudanAnahtar(parola, kutu): Promise<CryptoKey>` (kutudaki tuz/tekrar ile)
  - `tokenCoz(anahtar, kutu): Promise<string>` — yanlış anahtarda `SifreHatasi`
  - `b64(bytes: Uint8Array): string`, `b64Coz(s): Uint8Array`

- [ ] **Step 1: Failing testler** (testlerde `tekrar: 1000`)
  - `gidis_donus`: `{a:'Çağrı Işık', n:[1,2]}` → şifrele → çöz → `deepEqual`
  - `iv_her_seferinde_farkli`: aynı nesne iki kez şifrelenince `iv` farklı
  - `yanlis_parola`: başka parolanın anahtarıyla `coz` → `SifreHatasi` fırlatır
  - `token_kutusu`: `tokenKutusuOlustur('dogru-parola-12', 'github_pat_x', {tekrar:1000})` → `kutudanAnahtar('dogru-parola-12', kutu)` → `tokenCoz` === `'github_pat_x'`; `'yanlis-parola-12'` → `SifreHatasi`
  - `anahtar_disari_alinamaz`: `crypto.subtle.exportKey('raw', anahtar)` reddedilir
  - `kutu_bicimi`: kutunun anahtarları tam olarak `['iv','surum','tekrar','tuz','veri']`, `surum === 1`, `b64Coz(tuz).length === 16`, `b64Coz(iv).length === 12`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Uygula.** Yalnızca `globalThis.crypto.subtle` (Node 22 ve tarayıcıda aynı). `b64` için `btoa`/`atob`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** — `Şifreleme`.

---

### Task 4: GitHub erişimi ve sahte API

**Files:**
- Create: `uygulama/github.js`, `testler/sahte-github.mjs`
- Test: `testler/github.test.mjs`

**Interfaces:**
- Produces:
  - `class GitHubHatasi extends Error { tur: 'yetki'|'depo-yok'|'cakisma'|'erisim'|'internet' }`
  - `class GitHubDepo { constructor({ sahip, depo, token, fetch = globalThis.fetch, zamanAsimi = 15000 }) ; depoyuDenetle(): Promise<void> ; oku(yol): Promise<{ icerik: string|null, sha: string|null }> ; yaz(yol, icerik: string, sha: string|null, mesaj: string): Promise<{ sha: string }> ; liste(klasor: string): Promise<string[]> }` — `liste` klasördeki dosya yollarını verir (klasör yoksa `[]`)
  - `sahteGitHub(): { fetch, dosyalar: Map<yol, {icerik, sha}>, sonrakiYanit(durum: number, kez?: number), istekler: {yontem, yol}[] }` — sadece testler için; `sonrakiYanit` sıradaki istekleri verilen HTTP durumuyla düşürür.
- İstek ayrıntıları: `https://api.github.com/repos/{sahip}/{depo}` ve `/contents/{yol}`; başlıklar `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`; `cache: 'no-store'`. İçerik UTF-8 ↔ base64. `PUT` gövdesi `{ message, content, sha? }`.
- Durum eşleme: ağ hatası/zaman aşımı → `internet` (zaman aşımı `erisim`); 401, 403 (rate limit değilse) → `yetki`; `depoyuDenetle` 404 → `depo-yok`; `oku` 404 → `{icerik:null, sha:null}`; 409, 422 → `cakisma`; 5xx, 403 + `x-ratelimit-remaining: 0` → `erisim`.

- [ ] **Step 1: Failing testler** (hepsi `sahteGitHub()` ile)
  - `oku_yok_bos_doner`: olmayan yol → `{icerik:null, sha:null}`
  - `yaz_oku_turkce`: `'Şule Öztürk ğüşiöç'` yaz → oku aynı; ikinci yazış eski `sha` ile → `cakisma`
  - `yeni_dosya_shasiz`: `sha:null` ile yeni dosya oluşur
  - `hata_eslemesi`: 401→`yetki`, 500→`erisim`, 409→`cakisma`, `depoyuDenetle` 404→`depo-yok`
  - `ag_hatasi`: `fetch` `TypeError` fırlatınca → `internet`
  - `basliklar`: istekte `Authorization: Bearer t` ve `X-GitHub-Api-Version` var
  - `liste_klasor`: `mesai/2026-09.json`, `mesai/2026-10.json` yazılınca `liste('mesai')` → ikisi (sıralı); `liste('yok')` → `[]`
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `GitHub erişimi`.

---

### Task 5: Şifreli kayıtlar

**Files:**
- Create: `uygulama/kayitlar.js`
- Test: `testler/kayitlar.test.mjs`

**Interfaces:**
- Consumes: `sifrele`, `coz`, `SifreHatasi` (Task 3); `GitHubDepo`, `GitHubHatasi` (Task 4); `ayAnahtari` (Task 1)
- Produces:
  - `class BozukDosyaHatasi extends Error { yol }`
  - `class KismiTasimaHatasi extends Error` — mesaj: `Satır yeni aya eklendi ama eski aydan silinemedi. Eski aydaki kopyayı silin.`
  - `yeniKimlik(onEk: 'c'|'s'): string` → `'s_'` + 8 karakter `[0-9a-z]`
  - `VARSAYILAN_AYARLAR = { bolumYazisi: '', imza: { bolumAmiri: '', puantor: '', bolumMuduru: '' } }`
  - `class Kayitlar { constructor({ depo: GitHubDepo, anahtar: CryptoKey })`
    - `calisanlar(): Promise<Calisan[]>` · `ayarlar(): Promise<Ayarlar>` · `ay(ay: 'YYYY-MM'): Promise<Satir[]>` (tarih, sonra başlama saatine göre sıralı; pazar satırı o günün başında)
    - `degistir(yol, islem: (veri) => veri, varsayilan): Promise<veri>` — oku → çöz (yoksa `varsayilan`) → `islem` → şifrele → `yaz(sha)`; `cakisma`'da baştan, toplam 3 deneme; çözülemeyen dosyada `BozukDosyaHatasi`, üzerine **yazmaz**
    - `satirlarEkle(satirlar: Omit<Satir,'id'>[]): Promise<Satir[]>` (aynı aydakiler tek yazışta; farklı aylar ayrı yazış)
    - `satirGuncelle(eski: Satir, yeni: Satir): Promise<void>` (ay aynıysa tek yazış; değiştiyse önce yeni ay ekle, sonra eski aydan sil; ikinci adım başarısızsa `KismiTasimaHatasi`)
    - `satirSil(satir: Satir): Promise<void>`
    - `calisanEkle(ad): Promise<Calisan>` · `calisanGuncelle(id, { ad?, aktif? }): Promise<void>` · `ayarlariKaydet(ayarlar): Promise<void>` }
  - Commit mesajları (GitHub'da görünen): `Mesai: 2026-10`, `Çalışanlar`, `Ayarlar` — kişi adı içermez.

- [ ] **Step 1: Failing testler** (`sahteGitHub` + `tekrar:1000` anahtar)
  - `ilk_kayit_dosya_olusur`: boş depoda `satirlarEkle([...])` → `mesai/2026-10.json` oluşur; sahte depodaki içerikte düz metin `Arıza` **geçmez** (şifreli)
  - `iki_ay_iki_dosya`: Ekim ve Kasım satırı → iki dosya, iki yazış
  - `cakisma_yeniden_dener`: `sonrakiYanit(409, 1)` → `satirlarEkle` yine başarılı, sonuçta arada eklenmiş satır **ve** yeni satır ikisi de var (arada başka anahtarla değil aynı anahtarla eklenmiş satırı sahte dosyaya önceden koy)
  - `cakisma_3_kez`: `sonrakiYanit(409, 3)` → `GitHubHatasi` `cakisma`
  - `bozuk_dosyaya_yazmaz`: dosya içeriği `'{"surum":1,"iv":"AAAA","veri":"BBBB"}'` → `BozukDosyaHatasi`, sahte depoda yazış isteği yok
  - `satirGuncelle_ay_tasima`: `2026-10-31` → `2026-11-01`: Ekim'den gider, Kasım'a gelir, `id` aynı
  - `satirGuncelle_tasima_yarim_kalirsa_uyarir`: Kasım'a yazış başarılı, Ekim'e yazışta 500 → `KismiTasimaHatasi`; satır Kasım'da var, Ekim'de de duruyor (kaybolmadı)
  - `calisan_pasife`: `calisanGuncelle(id, {aktif:false})` sonrası listede `aktif:false`
  - `ayarlar_varsayilan`: boş depoda `ayarlar()` → `VARSAYILAN_AYARLAR`
  - `yeniKimlik_bicim`: `/^s_[0-9a-z]{8}$/`
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS (`node --test testler/`).
- [ ] **Step 5: Commit** — `Şifreli kayıtlar`.

---

### Task 6: Toplamlar ve çıktı düzeni

**Files:**
- Create: `uygulama/toplamlar.js`, `uygulama/cikti.js`
- Test: `testler/toplamlar.test.mjs`, `testler/cikti.test.mjs`

**Interfaces:**
- Consumes: `fazlaMesaiDakika`, `sureYaz`, `toplamYaz`, `haftaGunu`, `tarihYaz` (Task 1)
- Produces:
  - `ayToplamlari(satirlar, calisanlar): { calisanId, ad, dakika, pazar, yazi }[]` — kaydı olmayan çalışan yok; ada göre `localeCompare(…, 'tr')`
  - `SATIR_SAYISI = 20`
  - `OLCULER` — mm cinsinden ortak ölçüler (sayfa 297×210, kenar boşlukları, başlık yüksekliği, satır yüksekliği, imza alanı, sütun genişlikleri sırasıyla TARİH, ADI SOYADI, BÖLÜMÜ, MESAİ NEDENİ, BAŞLAMA SAATİ, BİTİŞ SAATİ, F. MESAİ SAATİ, İMZA). Yazdırma CSS'i ve PDF ikisi de **sadece** bunu kullanır.
  - `ciktiSatirlari(satirlar, calisanlar, ayarlar): { tarih, ad, bolum, neden, baslama, bitis, fm }[]` — `fm`: `sureYaz` ya da `'PAZAR'`; pazarda başlama/bitiş `''`; girdi sırasını korur (`Kayitlar.ay` zaten sıralı verir)
  - `sayfalaraBol<T>(liste: T[], n = SATIR_SAYISI): (T|null)[][]` — son sayfa `null` ile 20'ye tamamlanır; boş liste → bir sayfa, 20 `null`
  - `ciktiHtml({ satirlar, calisanlar, ayarlar, tanzim: 'YYYY-MM-DD' }): string` — `<section class="cikti-sayfa">` × sayfa; her sayfada `FAZLA MESAİ ÇİZELGESİ`, `TANZİM TARİHİ: GG.AA.YYYY`, sekiz sütun başlığı, 20 satır, imza tablosu (`BÖLÜM AMİRİ`, `PUANTÖR`, `BÖLÜM MÜDÜRÜ` + isimler). Metinler HTML'e kaçışlı (`&`, `<`, `>`, `"`) girer.

- [ ] **Step 1: Failing testler**
  - `ayToplamlari_turkce_siralama`: adlar `Şule Öztürk`, `Çağrı Işık`, `Ali Veli` → sıra `Ali Veli`, `Çağrı Işık`, `Şule Öztürk`
  - `ayToplamlari_pazar_ayri`: bir kişiye 100 dk hafta içi + 1 pazar → `{dakika:100, pazar:1, yazi:'1 saat 40 dakika + 1 pazar'}`
  - `sayfalaraBol`: 0 → 1 sayfa; 20 → 1; 21 → 2 (ikincide 1 dolu 19 `null`); 45 → 3
  - `ciktiHtml_sayfa_ve_imza`: 21 satır → `cikti-sayfa` 2 kez, `PUANTÖR` 2 kez, `TANZİM TARİHİ: 14.10.2026`
  - `ciktiHtml_kacis`: neden `'<b>x</b>'` → çıktıda `&lt;b&gt;`
  - `ciktiSatirlari_pazar`: pazar satırı → `fm:'PAZAR'`, `baslama:''`
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. Yazdırma stilleri `stil.css` içinde `@media print` ve `@page { size: A4 landscape; margin: 0 }`; `.cikti-sayfa { page-break-after: always }`; ölçüler `OLCULER`'den CSS değişkeni olarak (`ciktiHtml` sayfa elementine `style="--…"` yazar). **Step 4:** PASS.
- [ ] **Step 5: Görsel kontrol.** `testler/ekran/cikti_onizleme.py`: Playwright ile 21 satırlı örnek `ciktiHtml`'i `page.pdf(landscape=True, format='A4')` yap; `pdfinfo` 2 sayfa, `pdftoppm` ile ilk sayfa PNG; PNG'yi `dokumanlar`daki kâğıt formla göz kontrolü (sütun sırası, başlık yeri, imza alanı).
- [ ] **Step 6: Commit** — `Toplamlar ve çıktı düzeni`.

---

### Task 7: PDF

**Files:**
- Create: `uygulama/pdf.js`, `kutuphane/jspdf.umd.min.js`, `kutuphane/figtree-400.ttf`, `kutuphane/figtree-600.ttf`, `kutuphane/LISANSLAR.md`
- Test: `testler/pdf.test.mjs`

**Interfaces:**
- Consumes: `ciktiSatirlari`, `sayfalaraBol`, `OLCULER`, `SATIR_SAYISI` (Task 6); `tarihYaz` (Task 1)
- Produces:
  - `pdfUret({ jsPDF, yaziTipleri: { normal: string(b64 ttf), kalin: string }, satirlar, calisanlar, ayarlar, tanzim }): Uint8Array` — saf; tarayıcıda ve Node'da çalışır
  - `pdfDosyaAdi(ay: 'YYYY-MM'): 'Fazla_Mesai_2026-10.pdf'`
  - `pdfPaylas(bytes: Uint8Array, dosyaAdi): Promise<'paylasildi'|'indirildi'|'vazgecildi'>` — `navigator.canShare({files})` varsa `navigator.share`, yoksa `<a download>`; kullanıcı vazgeçerse (`AbortError`) `'vazgecildi'` (tarayıcı-only)
  - `kutuphaneYukle(): Promise<{ jsPDF, yaziTipleri }>` — `kutuphane/` dosyalarını ilk kullanımda yükler, sonra bellekte tutar (tarayıcı-only)

- [ ] **Step 1: Kütüphaneleri getir.** `npm pack jspdf@3.0.1` → `dist/jspdf.umd.min.js` → `kutuphane/`. Figtree: `https://raw.githubusercontent.com/google/fonts/main/ofl/figtree/Figtree%5Bwght%5D.ttf` → `fontTools.varLib.instancer` ile `wght=400` ve `wght=600` → `kutuphane/figtree-400.ttf`, `figtree-600.ttf`. UI için `@fontsource/figtree@5.1.1` (400/500/600) ve `@fontsource/bricolage-grotesque@5.1.1` (700) latin + latin-ext woff2 → `kutuphane/yazitipi/`. `LISANSLAR.md`: jsPDF MIT, Figtree ve Bricolage OFL 1.1.
- [ ] **Step 2: Failing testler** (Node, `createRequire` ile UMD yüklenir)
  - `pdf_sayfa_sayisi`: 21 satır → `pdfinfo` 2 sayfa, sayfa boyutu `841.89 x 595.28 pts` (yatay A4)
  - `pdf_turkce_harfler`: ad `Çağrı Işık`, neden `Şebeke arızası İğdır` → `pdftotext` çıktısında ikisi de birebir
  - `pdf_imza_her_sayfada`: 21 satır → `pdftotext` çıktısında `PUANTÖR` 2 kez
  - `pdfDosyaAdi`: `'2026-10'` → `'Fazla_Mesai_2026-10.pdf'`
- [ ] **Step 3:** FAIL. **Step 4: Uygula** `pdfUret`: `addFileToVFS` + `addFont` (`Figtree` normal/bold), çizgiler ve metinler `OLCULER` ile; hücreye sığmayan neden ve süre `splitTextToSize` ile en fazla 2 satır. **Step 5:** PASS.
- [ ] **Step 6: Commit** — `PDF`.

---

### Task 8: Kabuk, giriş ve oturum

**Files:**
- Create: `index.html`, `stil.css`, `uygulama/baslat.js`, `uygulama/oturum.js`, `uygulama/ekranlar/giris.js`, `testler/yardimci/anahtar-uret.mjs`, `testler/ekran/conftest.py`
- Test: `testler/ekran/test_giris.py`

**Interfaces:**
- Consumes: `kutudanAnahtar`, `tokenCoz`, `SifreHatasi` (Task 3); `GitHubDepo`, `GitHubHatasi` (Task 4); `Kayitlar` (Task 5)
- Produces:
  - `oturumKaydet(anahtar: CryptoKey, simdi = Date.now()): Promise<void>` · `oturumGetir(simdi = Date.now()): Promise<CryptoKey|null>` (30 günden eskiyse siler, `null`) · `oturumSil(): Promise<void>`
  - `baslat(kok: HTMLElement): Promise<void>` — `veri/anahtar.json`'ı `cache:'no-store'` okur → `oturumGetir` → varsa `tokenCoz` (olmazsa `oturumSil`, giriş) → `depoyuDenetle` → ana ekran; yoksa giriş
  - `bildir(metin: string): void` — alttaki bildirim, 2,8 sn
  - `hataMetni(hata): string` — spec 9'un metinleri birebir:
    - `SifreHatasi` → `Parola yanlış.`
    - `internet` → `İnternet bağlantısı yok. Kayıtlar internetle açılır.`
    - `yetki` → `GitHub anahtarının süresi dolmuş. Anıl'a haber verin.`
    - `depo-yok` → `Kayıt deposuna ulaşılamıyor. Anıl'a haber verin.`
    - `cakisma` → `Kaydedilemedi, tekrar deneyin.`
    - `erisim` → `GitHub'a şu an ulaşılamıyor. Birkaç dakika sonra tekrar deneyin.`
    - `BozukDosyaHatasi` → `Bu ayın kaydı açılamadı.`
    - `KismiTasimaHatasi` → hatanın kendi mesajı
  - Sabitler: `VERI_SAHIBI = 'NigdeSuKanalizasyon'`, `VERI_DEPOSU = 'fazla-mesai-veri'` (`baslat.js`)
  - Ana ekran iskeleti: `<nav class="sekmeler">` dört sekme `Çizelge`, `Toplamlar`, `Çalışanlar`, `Ayarlar` (`data-sekme="cizelge|toplamlar|calisanlar|ayarlar"`); ekran modülleri `ekranCiz(kok, baglam)` imzasıyla bağlanır; `baglam = { kayitlar: Kayitlar, durum: { ay: 'YYYY-MM' }, bildir, hataMetni, yenile(): Promise<void> }`
- Ekran testleri düzeni (`conftest.py`): proje kökünü `http.server` ile sunar; `sahte_github` fixture'ı `page.route('https://api.github.com/**')` ile bellek içi Contents API (Task 4'teki davranışla aynı); `veri/anahtar.json` isteği `anahtar-uret.mjs` ile üretilmiş test kutusuyla yanıtlanır (`parola: 'deneme-parolasi-12'`, `tekrar: 1000`); varsayılan görünüm 390×780 dokunmatik.

- [ ] **Step 1: Failing ekran testleri** (`test_giris.py`)
  - `test_yanlis_parola`: `yanlis-parola-12` → `Parola yanlış.` görünür, ana ekran yok
  - `test_dogru_parola_ana_ekran`: doğru parola → `Çizelge` sekmesi seçili, başlıkta içinde bulunulan ayın adı
  - `test_yeniden_acinca_parola_sormaz`: giriş → sayfa yenile → doğrudan ana ekran
  - `test_30_gun_sonra_sorar`: IndexedDB'deki kaydın `zaman`ını 31 gün geriye al → yenile → giriş ekranı
  - `test_cikis`: Ayarlar → `Çıkış` → giriş ekranı; yenileyince yine giriş
  - `test_depo_yok`: sahte API depo için 404 → `Kayıt deposuna ulaşılamıyor. Anıl'a haber verin.`
  - `test_internet_yok`: `context.set_offline(True)` sonra giriş → internet metni
- [ ] **Step 2:** `python3 -m pytest testler/ekran/test_giris.py -q` → FAIL.
- [ ] **Step 3: Uygula.** Giriş ekranı: başlık `Fazla Mesai`, tek kutu etiketi `Parola` (`type=password`, `autocomplete=current-password`), düğme `Giriş yap`; anahtar üretilirken düğme `Açılıyor…` ve pasif. Yazı tipleri `kutuphane/yazitipi/`ten `@font-face`.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `Kabuk, giriş ve oturum`.

---

### Task 9: Çizelge ve mesai formu

**Files:**
- Create: `uygulama/ekranlar/cizelge.js`, `uygulama/ekranlar/mesai-formu.js`
- Modify: `stil.css`
- Test: `testler/ekran/test_cizelge.py`

**Interfaces:**
- Consumes: `baglam` (Task 8); `satirDenetle`, `satirTemizle`, `NEDEN_SINIRI` (Task 2); `fazlaMesaiDakika`, `sureYaz`, `ayAdi`, `ayKaydir`, `istanbulSimdi`, `haftaGunu` (Task 1); `ciktiHtml` (Task 6); `pdfUret`, `pdfPaylas`, `pdfDosyaAdi`, `kutuphaneYukle` (Task 7); `Kayitlar` (Task 5)
- Produces: `ekranCiz(kok, baglam)` (çizelge), `mesaiFormuAc({ baglam, satir?: Satir }): void`

Ekran ayrıntıları (spec 7.1–7.2):
- Ay çubuğu: `‹` (`aria-label="Önceki ay"`), `Ekim 2026`, `›` (`aria-label="Sonraki ay"`; içinde bulunulan aydan ileri gitmez).
- Düğmeler: `Mesai ekle`, `Yazdır`, `PDF / Gönder`.
- Boş ay: `Bu ay için kayıt yok.`
- Satır kartı/tablo satırı: `data-satir="<id>"`; dokununca form `Düzenle` başlığıyla açılır; formda `Sil` → onay `Bu satır silinsin mi?` → `Sil` / `Vazgeç`.
- Form alanları: `Tarih` (`max` = İstanbul bugünü), `Çalışanlar` (eklemede çoklu onay kutusu listesi, aktifler; düzenlemede tek seçim), `Mesai nedeni` (`maxlength=60`, `kalan/60` sayacı), `Başlama`, `Bitiş` (`type=time`); pazar seçilince saat alanları yerine `PAZAR — saat girilmez`; önizleme satırı `Fazla mesai: 1 saat 40 dakika`.
- Kaydet: düğme kayıt sürerken pasif, metni `Kaydediliyor…`; başarıda pencere kapanır, `Kaydedildi` bildirimi, liste `kayitlar.ay()` ile tazelenir. Hata: form açık kalır, girilenler durur, hata metni formun üstünde.
- `KismiTasimaHatasi` → formun üstünde hatanın mesajı, liste tazelenir.
- Yazdır: `ciktiHtml` → gizli `#yazdirma` alanına koy → `window.print()`.
- PDF / Gönder: `kutuphaneYukle` → `pdfUret` → `pdfPaylas`; `indirildi` ise `PDF indirildi` bildirimi.

- [ ] **Step 1: Failing testler**
  - `test_mesai_ekle_coklu`: iki çalışan seç, `17:00`–`19:40` → listede iki satır, ikisinde `1 saat 40 dakika`
  - `test_pazar_saat_alani_yok`: pazar tarihi seç → saat kutuları gizli, `PAZAR — saat girilmez` görünür; kaydet → satırda `PAZAR`
  - `test_kural_hatasi_gosterilir`: hafta içi `16:00`–`17:30` → `Bu saatlerde fazla mesai yok (hafta içi 18:00'den sonrası sayılır).`, kayıt isteği gitmez
  - `test_kaydet_cift_tiklama_tek_satir`: sahte API yazışları 1 sn geciktirir; `Kaydet`'e art arda iki tık → tek satır
  - `test_kayit_401_form_korunur`: yazışta 401 → formda `GitHub anahtarının süresi dolmuş. Anıl'a haber verin.`, neden kutusundaki metin duruyor, giriş ekranına dönmedi
  - `test_duzenle_ay_degistir`: `31.10` satırının tarihi `01.11` yapılır → Ekim'de yok, Kasım'a geçince var
  - `test_sil`: satırı sil → listede yok
  - `test_ileri_ay_yok`: içinde bulunulan ayda `›` pasif
  - `test_yazdir_cagirir`: `window.print` taklit edilir; `Yazdır` → çağrıldı ve `#yazdirma` içinde `FAZLA MESAİ ÇİZELGESİ`
  - `test_pdf_indir`: `navigator.canShare` yok → indirme başlar, dosya adı `Fazla_Mesai_<ay>.pdf`
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS. **Step 5:** 390 ve 1280 genişlikte ekran görüntüsü al, göz kontrolü (kart/tablo, taşma yok).
- [ ] **Step 6: Commit** — `Çizelge ve mesai formu`.

---

### Task 10: Toplamlar, Çalışanlar, Ayarlar ekranları

**Files:**
- Create: `uygulama/ekranlar/toplamlar.js`, `uygulama/ekranlar/calisanlar.js`, `uygulama/ekranlar/ayarlar.js`
- Modify: `stil.css`
- Test: `testler/ekran/test_diger_ekranlar.py`

**Interfaces:**
- Consumes: `baglam` (Task 8); `ayToplamlari` (Task 6); `Kayitlar` (Task 5); `oturumSil` (Task 8)
- Produces: her dosyada `ekranCiz(kok, baglam)`

Ekran ayrıntıları (spec 7.3–7.5):
- Toplamlar: aynı ay çubuğu (çizelgeyle ortak `baglam.durum.ay`); satır `Ad Soyad` + `yazi`; boşsa `Bu ay için kayıt yok.`
- Çalışanlar: `Çalışan ekle` → ad kutusu → `Ekle`; aynı ad varsa (büyük/küçük harf ve Türkçe `toLocaleLowerCase('tr')` ile) `Bu adda bir çalışan zaten var.`; satırda `Adını düzelt`, `Pasife al` / `Aktif yap`; pasifler altta, soluk, `Pasif` etiketi.
- Ayarlar: `Bölümü sütunu`, `Bölüm Amiri`, `Puantör`, `Bölüm Müdürü` kutuları + `Kaydet` → `Ayarlar kaydedildi`; altta `Çıkış`; en altta sürüm `s1.0`.

- [ ] **Step 1: Failing testler**
  - `test_toplamlar`: iki kişi, biri pazar dahil → `Ali Veli — 1 saat 40 dakika + 1 pazar`; kaydı olmayan çalışan listede yok
  - `test_calisan_ekle_ayni_ad`: `ali veli` → uyarı metni
  - `test_pasif_formda_secilemez`: pasife al → mesai formunun çalışan listesinde yok; eski satırda adı duruyor
  - `test_ayarlar_ciktiya_gecer`: ayarlara `Su ve Kanalizasyon` ve `Puantör` adı yaz → Yazdır içeriğinde her satırın BÖLÜMÜ hücresinde ve imza alanında görünür
  - `test_ayni_ay_sekmeler_arasi`: çizelgede ayı geri al → Toplamlar'da aynı ay
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `Toplamlar, Çalışanlar, Ayarlar`.

---

### Task 11: Telefona yükleme, araçlar ve OKU.md

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `simge-180.png`, `simge-192.png`, `simge-512.png`, `simge-512-maskable.png`, `araclar/kurulum.html`, `araclar/parola-degistir.html`, `araclar/geri-getir.ps1`, `OKU.md`
- Modify: `index.html` (manifest, simgeler, servis çalışanı kaydı)
- Test: `testler/ekran/test_kurulum_araci.py`, `testler/ekran/test_cevrimdisi.py`

**Interfaces:**
- Consumes: `tokenKutusuOlustur`, `kutudanAnahtar`, `tokenCoz`, `sifrele`, `coz` (Task 3); `GitHubDepo` (Task 4)
- Produces:
  - `sw.js`: sayfa dosyalarını önbelleğe alır (`fazla-mesai-v1`), **önce ağ, olmazsa önbellek**; `api.github.com` isteklerine ve `veri/anahtar.json`'a karışmaz.
  - `kurulum.html`: alanlar `GitHub token`, `Parola`, `Parola (tekrar)`; parola < 12 → `Parola en az 12 karakter olmalı.`; eşleşmezse `Parolalar aynı değil.`; `Oluştur` → `anahtar.json` indirir (`TEKRAR` ile). İnternete bağlanmaz.
  - `parola-degistir.html`: `Eski parola`, `Yeni parola`, `Yeni parola (tekrar)`; eski parolayla `veri/anahtar.json`'daki (dosya seçilir) token'ı çözer; veri deposundaki bütün dosyaları (`calisanlar.json`, `ayarlar.json`, `mesai/*`) okur, yeni anahtarla şifreler, geri yazar; sonunda yeni `anahtar.json`'ı indirir. Bir dosya bile çözülemezse hiçbir şey yazmadan durur.
  - `geri-getir.ps1 -Yol <yol> -Tarih <ISO tarih>`: `gh api` ile veri deposunda o tarihten önceki son commit'i bulur, dosyanın o haldeki içeriğini güncel dosyanın üzerine yazar (commit mesajı `Geri getirildi: <yol> (<tarih>)`). Önce ne yapacağını yazar ve `E/H` sorar.
  - `OKU.md`: adres, mağaza, giriş, kurallar, çıktı, token bitiş tarihi (Görev 12'de doldurulur), araçların kullanımı, "Bu klasöre şifresiz parola/token/gerçek ad konmaz" kuralı.
- Simgeler: mağazanın simge çizimiyle aynı dil (yeşil zemin, altın düğüm) + saat motifi; Pillow ile üretilir.

- [ ] **Step 1: Failing testler**
  - `test_kurulum_kisa_parola`: 11 karakter → `Parola en az 12 karakter olmalı.`
  - `test_kurulum_dosya_calisir`: üretilen `anahtar.json` ile uygulamaya o parolayla giriş yapılır (conftest'e dosyayı ver)
  - `test_parola_degistir`: iki aylık sahte veri → yeni parola → eski parola artık açmaz, yeni parola açar, satırlar aynı
  - `test_cevrimdisi_acilis`: bir kez aç → çevrimdışı → yenile → sayfa açılır ve internet metnini gösterir
  - `test_yuklenebilir`: CDP `Page.getInstallabilityErrors` boş
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS. `geri-getir.ps1` için: Görev 12'deki gerçek depoda deneme satırıyla bir kez çalıştır (Anıl'ın onayıyla).
- [ ] **Step 5:** Bütün testler: `node --test testler/` ve `python3 -m pytest testler/ekran -q` → PASS.
- [ ] **Step 6: Commit** — `Telefona yükleme, araçlar, OKU.md`.

---

### Task 12: Kurulum, yayın ve mağaza

Bu görev Anıl'ın katılımını gerektirir; her adım öncesi ne yapılacağı söylenir ve onay alınır.

**Files:**
- Create: `veri/anahtar.json`
- Modify: `OKU.md` (token bitiş tarihi), `Masaüstü\Projeler\Uygulamalar\uygulamalar.js` (Fazla Mesai linki)

- [ ] **Step 1: Depolar.** Anıl'ın bilgisayarında `gh repo create NigdeSuKanalizasyon/fazla-mesai --public` ve `gh repo create NigdeSuKanalizasyon/fazla-mesai-veri --private`. Doğrula: `gh repo view` ikisi için görünürlük doğru.
- [ ] **Step 2: Token (Anıl).** GitHub → Settings → Developer settings → Fine-grained tokens → resource owner `NigdeSuKanalizasyon`, yalnızca `fazla-mesai-veri`, Contents: Read and write, en uzun süre. Bitiş tarihini Anıl söyler, `OKU.md`'ye yazılır.
- [ ] **Step 3: anahtar.json (Anıl).** `araclar/kurulum.html`'i Anıl'ın bilgisayarında aç; Anıl token'ı ve parolayı kendisi girer; inen dosya `veri/anahtar.json` olarak klasöre konur. Parola ve token sohbete yazılmaz.
- [ ] **Step 4: Yayın.** Commit + `git push` (gh kimlik bilgisi, Uygulamalar'daki gibi komut başına `credential.helper`); `gh api -X POST repos/NigdeSuKanalizasyon/fazla-mesai/pages -f "source[branch]=main" -f "source[path]=/"`; derleme `built` olana kadar bekle; adresteki dosyalar 200.
- [ ] **Step 5: Canlı duman testi.** Anıl'ın bilgisayarında ayrı headless Chrome ile (Uygulamalar'daki gibi, kişisel profile dokunmadan): sayfa açılıyor, giriş ekranı geliyor. Parola girilmez.
- [ ] **Step 6: Gerçek deneme (Anıl).** Telefonda adres → parola → bir çalışan, bir mesai satırı → Yazdır/PDF → WhatsApp. Kâğıt formla karşılaştırma.
- [ ] **Step 7: Mağaza.** Anıl "tamam" deyince `uygulamalar.js`'te Fazla Mesai linki `https://nigdesukanalizasyon.github.io/fazla-mesai/` olur; Uygulamalar deposuna commit + push; mağazanın içinde açıldığı headless Chrome ile doğrulanır.
- [ ] **Step 8: Commit** — `Yayın`.
