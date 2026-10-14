// Kullanıcıya gösterilen hata metinleri (spec 9, birebir). Arayüz bir hatayı yalnızca
// hataMetni() ile gösterir; hata.message gösterilmez (github.js'in mesajları geliştirici içindir).
// Tek istisna KismiTasimaHatasi: onun mesajı kullanıcı için yazılmıştır.

import { SifreHatasi } from './sifre.js';
import { GitHubHatasi } from './github.js';
import { BozukDosyaHatasi, KismiTasimaHatasi } from './kayitlar.js';

const GITHUB_METINLERI = Object.freeze({
  internet: 'İnternet bağlantısı yok. Kayıtlar internetle açılır.',
  yetki: "GitHub anahtarının süresi dolmuş. Anıl'a haber verin.",
  'depo-yok': "Kayıt deposuna ulaşılamıyor. Anıl'a haber verin.",
  cakisma: 'Kaydedilemedi, tekrar deneyin.',
  erisim: "GitHub'a şu an ulaşılamıyor. Birkaç dakika sonra tekrar deneyin.",
});

// Spec'te karşılığı olmayan hatalar (programlama hatası vb.) için.
export const BEKLENMEYEN = "Beklenmeyen bir sorun oldu. Anıl'a haber verin.";

export function hataMetni(hata) {
  if (hata instanceof SifreHatasi) return 'Parola yanlış.';
  if (hata instanceof GitHubHatasi) return GITHUB_METINLERI[hata.tur] ?? BEKLENMEYEN;
  if (hata instanceof BozukDosyaHatasi) return 'Bu ayın kaydı açılamadı.';
  if (hata instanceof KismiTasimaHatasi) return hata.message;
  return BEKLENMEYEN;
}
