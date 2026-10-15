# Fazla Mesai — OKU

Anıl için kısa kullanım ve bakım notu.

## Bu ne?

Su ve Kanalizasyon Müdürlüğü'nün fazla mesai çizelgesini tutan web uygulaması. Kâğıt "Fazla Mesai Çizelgesi" formunun aynısını yazdırır.

Adresi: **https://nigdesukanalizasyon.github.io/fazla-mesai/**

Sunucu yok. Sayfa GitHub Pages'ten, kayıtlar GitHub'dan gelir. Sadece yetkili kişiler (puantör, amir) kullanır.

## Personel nasıl açar?

- Uygulamalar mağazasında **Fazla Mesai**'ye dokunur.
- Ya da adresi doğrudan tarayıcıda açar. Telefonda tarayıcı menüsünden "Ana ekrana ekle" (Android'de "Uygulamayı yükle") ile uygulama gibi yüklenir.
- İnternet yoksa sayfa yine açılır ama "İnternet bağlantısı yok. Kayıtlar internetle açılır." yazar. Kayıtlar internetsiz açılmaz.

## Giriş

- Tek kutu var: **Parola**. Ortak parolayı yazınca içeri girilir.
- Aynı cihazda **30 gün** parola sorulmaz. Sonra yeniden sorulur.
- iPhone'da (Safari) uygulama 7 gün kadar hiç açılmazsa Safari bu girişi silebilir, parola erken sorulur. Bunu önlemek için iPhone'da uygulamayı ana ekrana ekle (Paylaş → Ana Ekrana Ekle).
- Ayarlar ekranındaki **Çıkış** bu cihazdaki girişi kapatır.
- Parola unutulursa kayıtlar hiçbir şekilde açılamaz. Parolayı güvenli bir yerde sakla.

## Mesai kuralları

- **Hafta içi:** sadece 17:30'dan sonrası sayılır. 17:00–19:40 → 2 saat 10 dakika. 17:30'da ya da daha önce biten satır kaydedilmez. (15 Ekim 2026'ya kadar sınır 18:00'di; kural bütün kayıtlara uygulanır.)
- **Cumartesi:** başlama ile bitiş arasının tamamı sayılır.
- **Pazar:** saat girilmez, satırda "PAZAR" yazar. Aylık toplamda saat değil gün sayılır.
- Gece yarısını aşan mesai yok. İleri tarih ve gelmemiş saat girilemez.
- Mesai nedeni zorunlu, en fazla 60 karakter.
- Resmi tatil için ayrı kural yok; hangi güne denk geliyorsa o günün kuralı.

## Yazdırma, PDF, WhatsApp

Çizelge ekranının üstündeki düğmeler:

- **Yazdır:** yatay A4, sayfada 20 satır. Başlık ve imza alanı her sayfada vardır. Tarayıcının kendi yazdırma menüsü (Ctrl+P) çizelgeyi basmaz; her zaman bu düğmeyi kullan.
- **PDF / Gönder:** telefonda ve tablette paylaşma menüsü açılır; WhatsApp'ı seçersen PDF dosya olarak gider. Bilgisayarda paylaşma menüsü açılmaz, PDF iner (adı `Fazla_Mesai_2026-10.pdf` gibi). İnternet yavaşsa telefon menüyü açmayabilir; o zaman altta "PDF hazır." ve **Gönder** düğmesi çıkar, ona dokununca menü açılır.

## Kayıtlar nerede?

İki depo var, ikisi de `NigdeSuKanalizasyon` hesabında:

| Depo | Kim görür | İçinde ne var |
|---|---|---|
| `fazla-mesai` | herkes | Uygulamanın kendisi ve **şifreli** token (`veri/anahtar.json`). Kayıt yok. |
| `fazla-mesai-veri` | sadece sen | Şifreli kayıt dosyaları: `calisanlar.json`, `ayarlar.json`, `mesai/2026-10.json` gibi. |

Token, uygulamanın veri deposuna yazabilmesi için GitHub'dan aldığın gizli anahtardır. Hem token hem kayıtlar ortak parolayla şifrelidir; parolayı bilmeyen göremez.

GitHub anahtarının bitiş tarihi: süresiz (No expiration), 15 Ekim 2026'da oluşturuldu. Kendiliğinden bitmediği için, sızdığından şüphelenirsen hemen aşağıdaki “Biri ayrılırsa ya da parola başkasına geçerse” bölümündeki adımları uygula.

Süresi dolunca uygulama "GitHub anahtarının süresi dolmuş. Anıl'a haber verin." der. Dolmadan önce yenile: GitHub'da aynı ayarlarla yeni token oluştur, sonra aşağıdaki **kurulum** aracındaki "Token'ı yeniliyorum" bölümünü kullan.

## Biri ayrılırsa ya da parola başkasına geçerse

Parolayı değiştirmek tek başına yetmez: eski `anahtar.json` herkese açık deponun geçmişinde durur, eski parolayı bilen biri oradan eski token'ı çözebilir. Bu yüzden token da değişir. Sırayla, çalışma saatleri dışında:

1. GitHub'da aynı ayarlarla **yeni bir token** oluştur.
2. **`parola-degistir.html`** ile parolayı değiştir (yeni parola). İnen `anahtar.json`'ı henüz yayınlama.
3. **`kurulum.html`**'de "Token'ı yeniliyorum" bölümünü aç: 2. adımda inen `anahtar.json`'ı seç, **yeni token**'ı ve **yeni parolayı** yaz, **Oluştur**'a bas. İnen dosyayı `veri` klasörüne koy ve yayınla.
4. GitHub ayarlarında (Settings → Developer settings → Fine-grained tokens) **eski token'ı sil** (Revoke).

2. adımdan yayına kadar uygulama kayıtları açamaz. Yeni parolayı yetkililere söyle.

## Kayıtların yedeği

`fazla-mesai-veri` deposunun bir kopyasını kendi bilgisayarında tut. Bir kere:

```powershell
gh repo clone NigdeSuKanalizasyon/fazla-mesai-veri
```

Sonra arada bir o klasörde `git pull` yaz. Dosyalar şifrelidir; açmak için o tarihteki parola gerekir.

## Aynı adresteki diğer uygulamalar

`nigdesukanalizasyon.github.io` adresindeki her uygulama (örneğin mağaza) bu uygulamanın tarayıcıda sakladığı girişe ulaşabilir; o adreste çalışan kötü bir kod kayıtları da açabilir. Bu yüzden bu adreste başka sitelerden kod (script) yükleyen bir uygulama yayınlama. Eski `mesai-takip` sitesi 15 Ekim 2026'da kapatıldı; yerinde kod içermeyen bir "taşındı" sayfası duruyor.

## Araçlar

`araclar` klasöründe üç araç var. Kurulum ve parola aracı birer web sayfasıdır; dosyaya çift tıklayınca **açılmaz**, bir internet adresinden açılır. İki yol var:

- Yayındaki adresten: `https://nigdesukanalizasyon.github.io/fazla-mesai/araclar/kurulum.html` (parola aracı için `parola-degistir.html`).
- Kendi bilgisayarından (ilk kurulumda site henüz yayında olmadığı için bu yol gerekir): PowerShell'de proje klasörüne gir, `python -m http.server 8000` yaz, tarayıcıda `http://localhost:8000/araclar/kurulum.html` aç. İşin bitince PowerShell'de Ctrl+C ile durdur.

**1. `kurulum.html`** — ilk kurulumda bir kere. GitHub token'ını ve ortak parolayı (en az 12 karakter, iki kez) yazarsın, **Oluştur**'a basarsın; `anahtar.json` iner. Bu sayfa internete bağlanmaz, token ve parola bilgisayarından çıkmaz. İnen dosyayı `veri` klasörüne koyarsın. Token'ı yenilerken "Token'ı yeniliyorum" bölümünden eski `anahtar.json`'ı seç ve **aynı parolayı** yaz; yoksa kayıtlar açılmaz.

**2. `parola-degistir.html`** — ortak parolayı değiştirmek için. Eski parola, yeni parola (en az 12 karakter) ve yeni parolanın tekrarı istenir. Araç önce bütün kayıt dosyalarını eski parolayla okur; biri bile açılmazsa hiçbir şey yazmaz. Sonra hepsini yeni parolayla şifreleyip veri deposuna yazar ve yeni `anahtar.json`'ı indirir. O dosyayı `veri` klasörüne koyup yayınlayana kadar uygulama kayıtları açamaz; bu yüzden çalışma saatleri dışında yap. Yazarken bir sorun çıkarsa (yanıt gelmese bile bir yazış uygulanmış olabilir) araç dokunduğu bütün dosyaları yeniden okur, yeni parolayla kalanları eski haline döndürür ve hepsini bir daha okuyup denetler. Hepsinin eski halinde olduğunu doğrulayamazsa hangi dosyaların kaldığını ve `geri-getir.ps1` için kullanacağın tarihi ekrana yazar; bu durumda yeni `anahtar.json` verilmez. Token'ın süresi dolmuşsa önce token'ı yenile.

**3. `geri-getir.ps1`** — yanlışlıkla silinen ya da bozulan bir kayıt dosyasını eski haline döndürür. GitHub her yazışın eski halini saklar. Gereken: `gh` programı kurulu ve `gh auth login` ile girilmiş olmalı. PowerShell'de proje klasöründe:

```powershell
.\araclar\geri-getir.ps1 -Yol mesai/2026-10.json -Tarih 2026-10-12
```

Araç o tarihten önceki son hali bulur, ne yapacağını yazar ve **E/H** diye sorar. E dersen dosyanın şu anki içeriğinin üzerine o hali yazar. Dosya yolu `calisanlar.json`, `ayarlar.json` ya da `mesai/YYYY-MM.json` olabilir.

Dikkat: parola değiştiyse, değişiklikten önceki bir tarihe döndürülen dosya eski parolayla şifrelidir; uygulama onu açamaz ("Bu ayın kaydı açılamadı."). Parola değişikliğinden önceki bir tarihe döndürme. Betik çalışmazsa şunu dene: `powershell -ExecutionPolicy Bypass -File .\araclar\geri-getir.ps1 -Yol ... -Tarih ...`

## Bu klasöre ne konmaz

Bu klasöre şifresiz parola, şifresiz token ya da gerçek kişi adı konmaz.

Klasördeki tek gizli şey `veri/anahtar.json`'dır ve o da şifrelidir. Testlerde uydurma adlar kullanılır. Klasörün tamamı herkese açık yayınlandığı için bu kural önemlidir.

## Güncelleme nasıl yayınlanır?

Claude değişikliği kaydeder (commit) ve `gh` ile `fazla-mesai` deposuna gönderir. GitHub Pages 1–2 dakikada yeni sürümü yayınlar. İnternet varken uygulama her açılışta en yeni dosyaları alır; yani yayından sonra uygulamayı kapatıp yeniden açmak yeter. İnternet çok yavaşsa (3 saniyede yanıt gelmezse) uygulama beklemez, telefondaki kopyayla açılır; yeni sürüm bir sonraki açılışta gelir.

Uygulamaya yeni bir dosya eklenirse `sw.js` içindeki dosya listesine de eklenir (testler bunu denetler); böylece uygulama internetsiz de açılır.
