// Tarih yardımcıları. Tarihler 'YYYY-MM-DD', aylar 'YYYY-MM' metnidir.
// Hiçbir yerde yerel saat dilimi kullanılmaz: "şimdi" Europe/Istanbul'a göre,
// gün hesapları UTC üzerinden yapılır (cihazın saat dilimi sonucu değiştirmez).

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const ISTANBUL_BICIMI = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function istanbulSimdi(simdi) {
  const parca = {};
  for (const { type, value } of ISTANBUL_BICIMI.formatToParts(simdi)) parca[type] = value;
  return {
    tarih: `${parca.year}-${parca.month}-${parca.day}`,
    saat: `${parca.hour}:${parca.minute}`,
  };
}

// Pazartesi 1 ... pazar 7.
export function haftaGunu(tarih) {
  const [y, a, g] = tarih.split('-').map(Number);
  const gun = new Date(Date.UTC(y, a - 1, g, 12)).getUTCDay();
  return gun === 0 ? 7 : gun;
}

export function ayAnahtari(tarih) {
  return tarih.slice(0, 7);
}

export function ayKaydir(ay, adim) {
  const [y, a] = ay.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1 + adim, 1));
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function ayAdi(ay) {
  const [y, a] = ay.split('-').map(Number);
  return `${AY_ADLARI[a - 1]} ${y}`;
}

export function tarihYaz(tarih) {
  const [y, a, g] = tarih.split('-');
  return `${g}.${a}.${y}`;
}
