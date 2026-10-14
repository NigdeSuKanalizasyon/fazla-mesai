// Aylık kişi toplamları. DOM yok; Node'da test edilir.
import { fazlaMesaiDakika, toplamYaz } from './sure.js';
import { haftaGunu } from './tarih.js';

// Verilen ayın satırlarından kişi başına toplam:
//   { calisanId, ad, dakika, pazar, yazi }  (yazi: "12 saat 40 dakika + 2 pazar")
// - Kaydı olmayan çalışan listeye girmez.
// - Pazar günleri süreye değil ayrı "pazar" sayısına yazılır.
// - Sıra: ada göre, Türkçe harf sırasıyla (Ç, Ş, İ ... yerinde).
// - Çalışan listesinde olmayan bir kimliğin satırı yutulmaz: adı boş gelir.
export function ayToplamlari(satirlar, calisanlar) {
  const adlar = new Map(calisanlar.map((c) => [c.id, c.ad]));
  const kisiler = new Map();

  for (const s of satirlar) {
    let kisi = kisiler.get(s.calisanId);
    if (!kisi) {
      kisi = { calisanId: s.calisanId, ad: adlar.get(s.calisanId) ?? '', dakika: 0, pazar: 0 };
      kisiler.set(s.calisanId, kisi);
    }
    if (haftaGunu(s.tarih) === 7) kisi.pazar += 1;
    else kisi.dakika += fazlaMesaiDakika(s.tarih, s.baslama, s.bitis);
  }

  return [...kisiler.values()]
    .map((k) => ({ ...k, yazi: toplamYaz(k.dakika, k.pazar) }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}
