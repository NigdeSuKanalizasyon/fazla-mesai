// Fazla mesai süresi (dakika) ve yazıya dökme. Yuvarlama yoktur.
import { haftaGunu } from './tarih.js';

const HAFTA_ICI_BASLANGIC = 17 * 60 + 30; // hafta içi fazla mesai 17:30'dan sonra sayılır (15.10.2026'ya kadar 18:00'di)

function dakikayaCevir(saat) {
  const [s, d] = saat.split(':').map(Number);
  return s * 60 + d;
}

// Hafta içi: yalnızca 17:30 sonrası. Cumartesi: tamamı. Pazar: saatsiz, 0.
export function fazlaMesaiDakika(tarih, baslama, bitis) {
  const gun = haftaGunu(tarih);
  if (gun === 7 || baslama == null || bitis == null) return 0;
  let bas = dakikayaCevir(baslama);
  if (gun <= 5) bas = Math.max(bas, HAFTA_ICI_BASLANGIC);
  return Math.max(0, dakikayaCevir(bitis) - bas);
}

export function sureYaz(dakika) {
  const saat = Math.floor(dakika / 60);
  const kalan = dakika % 60;
  if (saat === 0) return `${kalan} dakika`;
  if (kalan === 0) return `${saat} saat`;
  return `${saat} saat ${kalan} dakika`;
}

// Örn. "12 saat 40 dakika + 2 pazar". Süre sıfırsa ve pazar varsa yalnızca "1 pazar".
export function toplamYaz(dakika, pazar) {
  if (pazar === 0) return sureYaz(dakika);
  if (dakika === 0) return `${pazar} pazar`;
  return `${sureYaz(dakika)} + ${pazar} pazar`;
}
