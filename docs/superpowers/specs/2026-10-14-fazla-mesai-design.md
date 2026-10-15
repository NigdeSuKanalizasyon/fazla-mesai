# Fazla Mesai — Tasarım

**Tarih:** 14 Ekim 2026
**Durum:** Onaylandı (Anıl, 14 Ekim 2026)
**Proje klasörü:** `Masaüstü\Projeler\Fazla Mesai`

Bu belge, 14 Ekim 2026'daki konuşmada bölüm bölüm onaylanan tasarımı bir
araya toplar. Eski Fazla Mesai uygulaması (Next.js + Supabase,
`nigdesukanalizasyon.github.io/mesai-takip/`) bu işin temeli değildir; yeni
uygulama sıfırdan yazılır, eski kayıtlar taşınmaz.

---

## 1. Amaç

Su ve Kanalizasyon Müdürlüğü'nün fazla mesai çizelgesini tutmak ve kâğıt
"Fazla Mesai Çizelgesi" formunun aynısını çıktı olarak almak.

- **Hızlı ve kararlı olmalı.** Açılırken bekletmemeli, uyuyan ya da süresi
  dolan bir sunucuya bağlı olmamalı.
- **Telefondan ve bilgisayardan** aynı adresle açılmalı.
- **Uygulamalar mağazasının içinde** açılmalı. Bundan sonra yapılan her
  uygulama mağazada durur, kullanıcılar oradan girer.
- **Sadece GitHub** kullanılır. Cloudflare ya da başka bir sunucu yok.
- **Bütün kayıtlar şifreli** tutulur.

### Kullanıcılar

Sadece yetkili (puantör / amir). Personel uygulamayı kullanmaz. Yetkililer
tek bir ortak parolayla girer. Kimin neyi girdiği tutulmaz.

### Kapsam

- Çalışan listesi
- Mesai girişi (bir kerede birden fazla çalışan seçilebilir)
- Ay ay çizelge
- Kâğıt formun aynısı çıktı (yazdır)
- Kişi başı aylık toplam
- PDF indir / WhatsApp'tan gönder

### Kapsam dışı

- Personel girişi, personelin kendi mesaisini girmesi, onay adımı
- Eski uygulamadan veri taşıma
- Excel çıktısı
- Uygulama içinde "silineni geri getir" ekranı (GitHub geçmişinden elle
  geri getirilir, bkz. 9)
- Uygulama içinden parola değiştirme (bkz. 4.4)
- Kimin neyi değiştirdiği kaydı

---

## 2. Yapı

```
                       Telefon / bilgisayar (tarayıcı)
                      ┌──────────────────────────────────┐
  Uygulamalar mağazası│  fazla-mesai sayfası             │
  (içinde açılır) ───►│  - parolayla anahtar üretir      │
                      │  - kayıtları açar / şifreler     │
                      │  - kuralları uygular             │
                      │  - çıktı ve PDF'i üretir         │
                      └───────┬──────────────────┬───────┘
                              │ sayfa dosyaları  │ şifreli kayıtlar
                              ▼                  ▼  (GitHub API, token)
            ┌───────────────────────────┐  ┌───────────────────────────┐
            │ fazla-mesai (Public)      │  │ fazla-mesai-veri (Private)│
            │ GitHub Pages              │  │ sadece şifreli dosyalar   │
            │ kod + şifreli token       │  │                           │
            └───────────────────────────┘  └───────────────────────────┘
```

İki depo, ikisi de `NigdeSuKanalizasyon` hesabında:

| Depo | Görünürlük | İçinde ne var |
|---|---|---|
| `fazla-mesai` | Public | Uygulamanın kendisi (HTML, CSS, JS, simgeler, yazı tipi, PDF kütüphanesi) ve **parolayla şifrelenmiş** GitHub token'ı. Hiçbir kayıt, hiçbir kişi adı yok. GitHub Pages'ten yayınlanır. |
| `fazla-mesai-veri` | Private | Şifreli kayıt dosyaları. Başka bir şey yok. |

- **Adres:** `https://nigdesukanalizasyon.github.io/fazla-mesai/`
- Mağazayla aynı adreste (`nigdesukanalizasyon.github.io`) olduğu için
  mağazanın içinde sorunsuz açılır, ayrıca izin gerekmez.
- Sunucu kodu yok. Bütün iş tarayıcıda yapılır. Sayfa GitHub Pages'ten,
  kayıtlar GitHub API'sinden gelir.
- Dış kaynak yok: yazı tipi, PDF kütüphanesi ve diğer her şey `fazla-mesai`
  deposunun içinde durur. Başka bir siteden (CDN) bir şey yüklenmez; o site
  kapansa uygulama etkilenmez.
- Derleme (build) adımı yok. Depodaki dosyalar olduğu gibi yayınlanır.

---

## 3. GitHub erişimi

- **Token:** Fine-grained personal access token.
  - Resource owner: `NigdeSuKanalizasyon`
  - Repository access: sadece `fazla-mesai-veri`
  - Permissions → Contents: **Read and write**. Başka izin yok.
  - Süre: GitHub'ın izin verdiği en uzun süre. Bitiş tarihi `OKU.md`'ye yazılır.
- Token `fazla-mesai` deposunda **şifreli** durur (`veri/anahtar.json`).
  Parolayı bilmeyen kullanamaz.
- Okuma: `GET /repos/NigdeSuKanalizasyon/fazla-mesai-veri/contents/{yol}`
  (önbelleksiz). Yazma: aynı adrese `PUT`, dosyanın son `sha` değeriyle.
- GitHub API sınırı token başına saatte 5.000 istek; bu kullanım için çok fazla.

---

## 4. Şifreleme ve giriş

### 4.1 Anahtar

- Parola → **PBKDF2-SHA256**, 600.000 tekrar, 16 baytlık sabit tuz (salt) →
  256 bitlik **AES-GCM** anahtarı.
- Tuz ve tekrar sayısı `fazla-mesai` deposundaki `veri/anahtar.json`'da açık
  durur (gizli değildir, olması gerekmez).
- Bütün işler tarayıcının kendi şifreleme aracıyla (Web Crypto) yapılır, ek
  kütüphane yok.

### 4.2 Şifreli dosya biçimi

Her şifreli dosya şu JSON'dur:

```json
{ "surum": 1, "iv": "<12 bayt, base64>", "veri": "<AES-GCM şifreli metin, base64>" }
```

- Her yazışta yeni, rastgele `iv` üretilir.
- `anahtar.json` ayrıca `tuz` ve `tekrar` alanlarını taşır; `veri` alanında
  şifreli token durur.

### 4.3 Giriş

1. Ekranda tek kutu: **Parola**.
2. Parolayla anahtar üretilir, `anahtar.json`'daki token çözülmeye çalışılır.
3. Çözülemezse (AES-GCM doğrulaması tutmaz): **"Parola yanlış."**
4. Çözülürse giriş tamam. Token ve anahtar sadece bellekte tutulur.

**Bu cihazda açık kalsın:**

- Anahtar, **dışarı çıkarılamaz** (non-extractable) olarak üretilir ve
  tarayıcının IndexedDB'sine kaydedilir. Tarayıcı anahtarı kullanabilir ama
  JavaScript bile onu okuyup dışarı veremez. Parola saklanmaz.
- Kayıtla birlikte giriş zamanı tutulur. **30 gün** sonra parola yeniden
  sorulur.
- **Çıkış** düğmesi anahtarı siler.
- Depolama anahtarlarının hepsi `fazla-mesai.` ile başlar. Aynı adresteki
  diğer uygulamalarla (mağaza, eski mesai-takip) karışmaz.

### 4.4 Parola değiştirme

Uygulamanın içinde yok. Gerekçe: parola değişince `fazla-mesai` deposundaki
`anahtar.json` da değişmeli. Bunu uygulamaya yaptırmak, token'a uygulama
kodunu değiştirme yetkisi vermek demek; parolayı bilen biri uygulamanın
kodunu da değiştirebilir hale gelir.

Bunun yerine Anıl'ın bilgisayarında çalışan bir araç (`araclar/parola-degistir`)
olur: eski ve yeni parola sorulur, bütün veri dosyaları ve `anahtar.json`
yeni parolayla yeniden şifrelenip iki depoya da gönderilir.

### 4.5 Güvenlik notları

- Güvenlik parolanın gücüne bağlıdır. `anahtar.json` herkese açık olduğu
  için zayıf bir parola deneme-yanılmayla bulunabilir. **Ortak parola en az
  12 karakter olmalı ve tahmin edilememeli.** Kurulum aracı daha kısasını
  kabul etmez.
- Parola unutulursa kayıtlar **hiçbir şekilde** açılamaz.
- Parola ve token sohbete yazılmaz. Kurulumda Anıl bunları kendi
  bilgisayarında açılan kurulum aracına kendisi girer (bkz. 11).

---

## 5. Kayıtlar

### 5.1 Dosyalar (`fazla-mesai-veri` deposu)

| Yol | İçerik (çözülmüş hali) |
|---|---|
| `calisanlar.json` | Çalışan listesi |
| `ayarlar.json` | Bölüm yazısı, imza isimleri |
| `mesai/2026-10.json` | O ayın satırları (her ay ayrı dosya) |

Dosya adlarında kişi bilgisi yoktur; adlar dosyaların şifreli içeriğindedir.

### 5.2 Çözülmüş içerik

```json
// calisanlar.json
{ "calisanlar": [ { "id": "c_k3x9", "ad": "Ad Soyad", "aktif": true } ] }

// ayarlar.json
{ "imza": { "bolumAmiri": "", "puantor": "", "bolumMuduru": "" } }
// (s1.0'ın yazdığı "bolumYazisi" alanı dosyada kalabilir; kullanılmaz)

// mesai/2026-10.json
{ "satirlar": [
  { "id": "s_8f2a", "tarih": "2026-10-14", "calisanId": "c_k3x9",
    "neden": "Ana hat arızası", "baslama": "17:00", "bitis": "19:40" },
  { "id": "s_91bc", "tarih": "2026-10-12", "calisanId": "c_k3x9",
    "neden": "Pompa değişimi", "baslama": null, "bitis": null }
] }
```

- Ayarların hepsi ilk kurulumda boştur; Ayarlar ekranından doldurulur.
- Fazla mesai süresi **saklanmaz**, her seferinde tek bir fonksiyonla
  (`fazlaMesaiDakika`) hesaplanır. Böylece kural tek yerde durur.
- Satırda çalışanın adı değil kimliği (`calisanId`) durur. Ad düzeltilince
  eski satırlarda da düzelmiş hali görünür.
- Çalışan silinmez, **pasife alınır** (`aktif: false`). Böylece eski
  satırlar her zaman bir ada bağlı kalır.
- Kimlikler rastgele üretilir (`c_` / `s_` + rastgele harf ve rakam).

### 5.3 Aynı anda kaydetme

- Her değişiklik bir işlem olarak yazılır ("şu satırı ekle", "şu satırı
  sil"). Kaydetmeden önce dosya GitHub'dan yeniden okunur, işlem uygulanır,
  dosyanın okunduğu andaki `sha` ile yazılır.
- Arada başka biri yazdıysa GitHub reddeder (409). Uygulama dosyayı yeniden
  okur, aynı işlemi tekrar uygular, yeniden yazar. En fazla 3 deneme; yine
  olmazsa "Kaydedilemedi, tekrar deneyin" der ve kullanıcının girdiğini
  formda tutar.
- **Satırın tarihi başka aya taşınırsa:** önce yeni ayın dosyasına eklenir,
  sonra eski ayın dosyasından silinir. İkinci adım başarısız olursa satır
  iki ayda birden görünür ve ekranda bunu söyleyen bir uyarı çıkar.

---

## 6. Kurallar

Bunlar eski uygulamadaki kuralların aynısıdır, Anıl 14 Ekim 2026'da
"aynen" dedi.

| # | Kural |
|---|---|
| 1 | **Hafta içi:** sadece 18:00'den sonrası fazla mesai. 17:00–19:40 → 1 saat 40 dakika. |
| 2 | **Cumartesi:** başlama ile bitiş arasının tamamı. |
| 3 | **Pazar:** saat girilmez; satırda "PAZAR" yazar; aylık toplamda saat değil **gün** olarak sayılır. |
| 4 | Gece yarısını aşan mesai yok: bitiş, başlamadan sonra olmalı. |
| 5 | İleri tarih girilemez. Bugünün tarihinde bitiş saati şu andan sonra olamaz. Saat dilimi Europe/Istanbul. |
| 6 | Resmi tatil için ayrı kural yok; hangi güne denk geliyorsa o günün kuralı. |

Ek kurallar:

- **Mesai nedeni** zorunlu, en fazla 60 karakter (kâğıttaki sütuna sığsın).
- **Çalışan** zorunlu; pasif çalışan seçilemez.
- **Yeni kural (Anıl 14 Ekim 2026'da onayladı):** Hafta içi 18:00'den önce biten
  satırın fazla mesaisi 0 olur. Böyle bir satır kaydedilmez:
  "Bu saatlerde fazla mesai yok (hafta içi 18:00'den sonrası sayılır)."
- Kurala uymayan satır kaydedilmez; nedeni ilgili kutunun altında yazar.

### Süre yazımı

- Dakika olarak hesaplanır; yuvarlama yok.
- 100 → "1 saat 40 dakika", 60 → "1 saat", 40 → "40 dakika".
- Pazar satırı → "PAZAR".
- Aylık toplam → "12 saat 40 dakika + 2 pazar" (pazar yoksa sadece süre).

---

## 7. Ekranlar

Altta dört sekme: **Çizelge, Mesailer, Çalışanlar, Ayarlar.**
Mağazadaki diğer uygulamalarla aynı görünüm dili: aynı yeşil ve altın
renkler, aynı yazı tipleri.

### 7.1 Çizelge (ana ekran)

- Üstte ay seçimi: **‹ Ekim 2026 ›**. Açılışta içinde bulunulan ay.
- O ayın satırları tarih sırasıyla (aynı gün içinde başlama saatine göre):
  tarih, ad soyad, mesai nedeni, başlama, bitiş, süre.
- Telefonda her satır bir kart; bilgisayarda tablo.
- Satıra dokununca **Düzenle** penceresi açılır; orada **Sil** de vardır
  (sorarak).
- Üstte üç düğme: **Mesai ekle**, **Yazdır**, **PDF / Gönder**.
- Ay boşsa: "Bu ay için kayıt yok." ve **Mesai ekle** düğmesi.

### 7.2 Mesai ekle / düzenle

- **Tarih:** bugün gelir, değiştirilebilir.
- **Çalışanlar:** aktif çalışanlar arasından **bir ya da birden fazla**
  seçilir (eklemede). Her seçilen için ayrı satır açılır. Düzenlemede tek
  çalışan.
- **Mesai nedeni:** en fazla 60 karakter, kalan karakter sayısı görünür.
- **Başlama / bitiş:** saat kutuları. Pazar seçilince kutular kalkar,
  "PAZAR — saat girilmez" yazar.
- **Süre önizlemesi:** yazdıkça altta "1 saat 40 dakika".
- **Kaydet** → kayıt bitince pencere kapanır, satır listede görünür,
  "Kaydedildi" bildirimi.

### 7.3 Mesailer (aylık toplamlar)

- Seçili ay için her çalışanın toplamı, ada göre sıralı:
  "Ad Soyad — 12 saat 40 dakika + 2 pazar".
- O ay kaydı olmayan çalışan listede görünmez.

### 7.4 Çalışanlar

- Liste: aktifler üstte, pasifler altta soluk.
- **Ekle**, **Adını düzelt**, **Pasife al / Aktif yap**.
- Aynı adda ikinci çalışan eklenirken uyarır.

### 7.5 Ayarlar

- **İmza isimleri:** Bölüm Amiri, Puantör, Bölüm Müdürü.
- **Çıkış**.
- Uygulama sürümü (küçük, en altta).

---

## 8. Çıktı

### 8.1 Görünüm (kâğıt formun aynısı)

- **Yatay A4.**
- Başlık: **FAZLA MESAİ ÇİZELGESİ**; sağ üstte **TANZİM TARİHİ:** çıktının
  alındığı gün (GG.AA.YYYY).
- Sütunlar: **TARİH | ADI SOYADI | BÖLÜMÜ | MESAİ NEDENİ | BAŞLAMA SAATİ |
  BİTİŞ SAATİ | F. MESAİ SAATİ | İMZA**
- BÖLÜMÜ: her satırda sabit "Su ve Kanalizasyon" (ayarlanmaz; s1.1).
- F. MESAİ SAATİ: "1 saat 40 dakika" (gerekirse iki satıra bölünür);
  pazar satırında "PAZAR", başlama ve bitiş boş.
- İMZA: boş.
- **Sayfa başına 20 satır.** Ay daha uzunsa yeni sayfa; başlık ve imza alanı
  her sayfada tekrar eder. Son sayfanın boş satırları da çizilir (kâğıttaki gibi).
- Alt: **BÖLÜM AMİRİ | PUANTÖR | BÖLÜM MÜDÜRÜ** kutuları; altlarında
  ayarlardaki isimler.

### 8.2 Yazdır

Aynı düzen ekranda yazdırma için hazırlanır, tarayıcının yazdır penceresi
açılır (`@page { size: A4 landscape }`).

### 8.3 PDF indir / Gönder

- PDF tarayıcının içinde, depoda duran bir PDF kütüphanesiyle (jsPDF) üretilir.
  Türkçe harfler için yazı tipi PDF'e gömülür.
- Dosya adı: `Fazla_Mesai_2026-10.pdf`.
- **Gönder:** telefonda paylaş menüsü açılır (Web Share API), WhatsApp
  seçilince PDF dosya olarak gider. Dosya paylaşımı olmayan tarayıcıda
  (çoğu bilgisayar) PDF iner.
- PDF ile yazdırma çıktısı aynı ölçülerde olmalı.

---

## 9. Sorunlar ve hata mesajları

| Durum | Ne olur |
|---|---|
| Parola yanlış | "Parola yanlış." Kutu temizlenir. |
| İnternet yok | "İnternet bağlantısı yok. Kayıtlar internetle açılır." Kayıt yapılmaz. |
| Token süresi dolmuş / geçersiz (401) | "GitHub anahtarının süresi dolmuş. Anıl'a haber verin." |
| Veri deposu bulunamadı (404, depo) | "Kayıt deposuna ulaşılamıyor. Anıl'a haber verin." |
| Aynı anda kaydetme (409) | Kendiliğinden yeniden dener (5.3); olmazsa "Kaydedilemedi, tekrar deneyin." |
| GitHub kesintisi (5xx) / zaman aşımı | "GitHub'a şu an ulaşılamıyor. Birkaç dakika sonra tekrar deneyin." Form içeriği korunur. |
| Şifreli dosya çözülemiyor (bozuk) | "Bu ayın kaydı açılamadı." Dosyaya dokunulmaz, üzerine yazılmaz. |
| Ayın dosyası yok (404, dosya) | Hata değil: ay boştur. İlk kayıtta dosya oluşturulur. |

**Yanlışlıkla silme ya da bozma:** GitHub her yazışın eski halini commit
geçmişinde tutar. Anıl'ın bilgisayarındaki araçla (`araclar/geri-getir`) bir
dosya istenen tarihteki haline döndürülebilir.

**Uygulama dosyaları:** Servis çalışanı (service worker) sayfa dosyalarını
cihazda saklar; uygulama hızlı açılır, telefona yüklenebilir. Kayıtlar
saklanmaz, her açılışta GitHub'dan gelir.

---

## 10. Mağaza

- Uygulamalar mağazasındaki `uygulamalar.js` dosyasında Fazla Mesai'nin
  linki yeni adrese çevrilir: `https://nigdesukanalizasyon.github.io/fazla-mesai/`.
- Yeni uygulama hazır ve Anıl'ın telefonunda denenmiş olmadan link değişmez.
- Eski `mesai-takip` sitesinin kapatılması ayrı bir karar; bu işin parçası değil.

---

## 11. Kurulum (bir kere)

1. Claude, `gh` ile iki depoyu açar: `fazla-mesai` (Public),
   `fazla-mesai-veri` (Private).
2. Anıl, GitHub'da fine-grained token'ı oluşturur (3'teki ayarlarla). Token
   ekranı tarayıcıda yapılır; `gh` ile oluşturulamaz.
3. Anıl, bilgisayarında **kurulum aracını** açar (`araclar/kurulum.html`,
   internetsiz çalışan yerel bir sayfa). Token'ı yapıştırır, ortak parolayı
   iki kez girer (en az 12 karakter). Araç `anahtar.json` dosyasını üretir ve
   klasöre kaydeder. Parola ve token sohbete yazılmaz.
4. Claude `anahtar.json`'ı `fazla-mesai` deposuna gönderir, Pages'i açar.
5. İlk girişte boş çalışan listesi ve varsayılan ayarlar oluşturulur.

---

## 12. Test

Otomatik (Claude, her değişiklikte):

- **Süre hesabı:** hafta içi 18:00 öncesi / sonrası / kesişen, cumartesi,
  pazar, gece yarısı, bugünün gelecek saati, ileri tarih, 60 karakter sınırı.
- **Şifreleme:** şifrele → çöz aynı veriyi verir; yanlış parola çözemez;
  her yazışta `iv` farklı.
- **Aynı anda kaydetme:** sahte GitHub ile 409 senaryosu; iki işlemin
  ikisi de kayıtta.
- **Aya taşıma:** satırın tarihi başka aya değişince iki dosya doğru güncellenir.
- **Çıktı:** 0, 1, 20, 21 ve 45 satırlı aylar; sayfa sayısı, imza alanı her
  sayfada; PDF ile yazdırma düzeni aynı.
- **Ekranlar:** telefon ve bilgisayar genişliğinde ekran görüntüsü.

Gerçek ortamda (Anıl):

- Telefondan mağaza üzerinden açma, giriş, mesai ekleme.
- WhatsApp'tan PDF gönderme.
- İlk çıktıyı yazıcıdan basıp kâğıt formla karşılaştırma.

---

## 13. Klasör düzeni ve yayın

```
Masaüstü\Projeler\Fazla Mesai\     = fazla-mesai deposu (Public)
├── index.html            uygulama sayfası
├── uygulama\             JS modülleri (sifre, github, kurallar, kayitlar, ekranlar, cikti)
├── kutuphane\            jsPDF ve yazı tipi (dışarıdan yüklenmez)
├── veri\anahtar.json     şifreli token + tuz (kurulumda üretilir)
├── manifest.webmanifest, sw.js, simge-*.png
├── araclar\              kurulum.html, parola-degistir, geri-getir
├── testler\
├── docs\                 bu belge ve plan
└── OKU.md                Anıl için kısa kullanım ve bakım notu
```

- Klasörün tamamı `fazla-mesai` deposudur ve olduğu gibi yayınlanır. Böylece
  kodun, araçların ve belgelerin yedeği de GitHub'da durur.
- **Kural:** Bu klasöre şifresiz parola, şifresiz token ya da gerçek kişi adı
  hiçbir zaman konmaz. Klasördeki tek gizli şey `veri\anahtar.json`'dır ve o
  da şifrelidir. Testlerde uydurma adlar kullanılır.
- Yayın: Claude değişikliği commit edip `gh` ile gönderir; GitHub Pages 1–2
  dakikada yeni sürümü yayınlar. Servis çalışanı yeni sürümü bir sonraki
  açılışta alır.
