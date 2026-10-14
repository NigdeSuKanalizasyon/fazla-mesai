# Veri deposundaki bir dosyayı, istenen tarihten ÖNCEKİ son haline döndürür (yanlışlıkla silme ya da bozma).
#
#   .\geri-getir.ps1 -Yol mesai/2026-10.json -Tarih 2026-10-12
#   .\geri-getir.ps1 -Yol calisanlar.json -Tarih "2026-10-12 18:30"
#
# Gerekenler: GitHub CLI (gh), "gh auth login" ile giriş (veri deposuna yazma izni olan hesap).
# Tarih: o andan önceki son kayıt alınır. Yalnız gün yazılırsa o günün 00:00'ı sayılır, yani
# o günün değişiklikleri geri alınır. Saat dilimi yazılmazsa bu bilgisayarınki kullanılır.
# Önce ne yapacağını yazar, E/H diye sorar; E denmeden hiçbir şey yazmaz.
param(
  [Parameter(Mandatory = $true)][string]$Yol,
  [Parameter(Mandatory = $true)][string]$Tarih
)
$ErrorActionPreference = 'Stop'
$Depo = 'NigdeSuKanalizasyon/fazla-mesai-veri'
$Gecmis = [Globalization.CultureInfo]::InvariantCulture

# gh api çağrısı: hata kodu varsa durur, yoksa JSON'u nesneye çevirir.
function Gh([string[]]$Arguman) {
  $ErrorActionPreference = 'Continue'   # gh'ın stderr çıktısı betiği kendiliğinden düşürmesin
  $cikti = & gh api @Arguman 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "GitHub isteği başarısız: $cikti" }
  if ($cikti.Trim()) { $cikti | ConvertFrom-Json }
}

$Yol = $Yol -replace '\\', '/'
if ($Yol -notmatch '^(calisanlar\.json|ayarlar\.json|mesai/\d{4}-\d{2}\.json)$') {
  throw "Yol geçersiz: $Yol (örnek: mesai/2026-10.json, calisanlar.json, ayarlar.json)"
}
try { $sinir = [DateTimeOffset]::Parse($Tarih, $Gecmis, 'AssumeLocal').UtcDateTime }
catch { throw "Tarih anlaşılamadı: $Tarih (örnek: 2026-10-12 ya da 2026-10-12T18:30)" }
$until = $sinir.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $Gecmis)
$yolKodlu = ($Yol -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'

# O tarihten önceki en yeni kayıt (commit)
$kayit = @(Gh "repos/$Depo/commits?path=$yolKodlu&until=$until&per_page=1")[0]
if (-not $kayit) { throw "$Yol için $Tarih tarihinden önce kayıt yok." }
$eski = Gh "repos/$Depo/contents/${yolKodlu}?ref=$($kayit.sha)"
$icerik = "$($eski.content)" -replace '\s', ''
if (-not $icerik) { throw "$Yol dosyasının o kayıttaki içeriği alınamadı." }

# Şu anki dosyanın sha'sı (dosya şu an yoksa yeniden oluşturulur)
$simdiki = $null
try { $simdiki = (Gh "repos/$Depo/contents/$yolKodlu").sha }
catch { if ("$_" -notmatch '404') { throw } }

$kisaSha = $kayit.sha.Substring(0, 7)
$mesaj = ($kayit.commit.message -split "`n")[0]
Write-Host "Dosya         : $Yol ($Depo)"
Write-Host "İstenen tarih : $Tarih"
Write-Host "Alınacak kayıt: $kisaSha, $($kayit.commit.committer.date), $mesaj"
if ($simdiki) { Write-Host 'Dosyanın şu anki içeriğinin üzerine yazılacak (şu anki hali de GitHub geçmişinde durur).' }
else { Write-Host 'Dosya şu an yok; bu kayıttaki haliyle yeniden oluşturulacak.' }
if ((Read-Host 'Devam edilsin mi? (E/H)') -ne 'E') { Write-Host 'Vazgeçildi. Hiçbir şey değişmedi.'; return }

$govde = @{ message = "Geri getirildi: $Yol ($Tarih)"; content = $icerik }
if ($simdiki) { $govde.sha = $simdiki }
$gecici = (New-TemporaryFile).FullName
try {
  [IO.File]::WriteAllText($gecici, ($govde | ConvertTo-Json -Compress))
  Gh '--method', 'PUT', "repos/$Depo/contents/$yolKodlu", '--input', $gecici | Out-Null
} finally { Remove-Item $gecici -ErrorAction SilentlyContinue }
Write-Host "Bitti: $Yol, $kisaSha kaydındaki haline döndürüldü."
