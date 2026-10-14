// Satır denetimi. Bir alanda birden fazla kural bozulsa da yalnızca ilk hata yazılır.
// Boş saat (null, undefined, '' ya da 'SS:DD' biçiminde olmayan değer) "girilmemiş" sayılır.
import { istanbulSimdi, haftaGunu } from './tarih.js';
import { fazlaMesaiDakika } from './sure.js';

export const NEDEN_SINIRI = 60;

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;
const SAAT_BICIMI = /^([01]\d|2[0-3]):[0-5]\d$/;

function gercekTarihMi(tarih) {
  if (typeof tarih !== 'string' || !TARIH_BICIMI.test(tarih)) return false;
  const [y, a, g] = tarih.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g, 12));
  return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g;
}

function pazarMi(tarih) {
  return gercekTarihMi(tarih) && haftaGunu(tarih) === 7;
}

function saatDegeri(saat) {
  return typeof saat === 'string' && SAAT_BICIMI.test(saat) ? saat : null;
}

function tarihHatasi(tarih, bugun) {
  if (!gercekTarihMi(tarih)) return 'Tarih seçin.';
  if (tarih > bugun) return 'İleri bir tarihe kayıt girilemez.';
  return null;
}

function calisanHatasi(calisanId, calisanlar) {
  const calisan = calisanlar.find((c) => c.id === calisanId);
  if (!calisan) return 'Çalışan seçin.';
  if (!calisan.aktif) return 'Pasif çalışan seçilemez.';
  return null;
}

function nedenHatasi(neden) {
  const metin = String(neden ?? '').trim();
  if (metin === '') return 'Mesai nedenini yazın.';
  if (metin.length > NEDEN_SINIRI) return `Mesai nedeni en fazla ${NEDEN_SINIRI} karakter olabilir.`;
  return null;
}

function saatHatasi(tarih, baslamaHam, bitisHam, simdi) {
  if (!gercekTarihMi(tarih)) return null; // gün bilinmiyor; önce tarih düzelsin
  const gun = haftaGunu(tarih);
  if (gun === 7) return null; // pazar saatsizdir; gelen saatler satirTemizle'de atılır
  const baslama = saatDegeri(baslamaHam);
  const bitis = saatDegeri(bitisHam);
  if (baslama === null || bitis === null) return 'Başlama ve bitiş saatini girin.';
  if (bitis <= baslama) return 'Bitiş, başlamadan sonra olmalı.';
  if (tarih === simdi.tarih && bitis > simdi.saat) return 'Bitiş saati henüz gelmedi.';
  if (gun <= 5 && fazlaMesaiDakika(tarih, baslama, bitis) === 0) {
    return "Bu saatlerde fazla mesai yok (hafta içi 18:00'den sonrası sayılır).";
  }
  return null;
}

export function satirDenetle(satir, baglam) {
  const simdi = istanbulSimdi(baglam.simdi);
  const hatalar = {};
  const sonuclar = {
    tarih: tarihHatasi(satir.tarih, simdi.tarih),
    calisan: calisanHatasi(satir.calisanId, baglam.calisanlar),
    neden: nedenHatasi(satir.neden),
    saat: saatHatasi(satir.tarih, satir.baslama, satir.bitis, simdi),
  };
  for (const [alan, hata] of Object.entries(sonuclar)) {
    if (hata !== null) hatalar[alan] = hata;
  }
  return { gecerli: Object.keys(hatalar).length === 0, hatalar };
}

// Kaydetmeden önce satırı normalleştirir: nedeni kırpar, pazar günü saatleri atar,
// boş saat metnini ('' → null) null yapar. Girdiyi değiştirmez.
export function satirTemizle(satir) {
  const temiz = { ...satir, neden: String(satir.neden ?? '').trim() };
  if (pazarMi(satir.tarih)) {
    temiz.baslama = null;
    temiz.bitis = null;
  } else {
    if (temiz.baslama === '') temiz.baslama = null;
    if (temiz.bitis === '') temiz.bitis = null;
  }
  return temiz;
}
