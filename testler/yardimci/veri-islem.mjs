// SADECE testler içindir: veri dosyalarını bir token kutusunun anahtarıyla şifreler ya da çözer.
//
//   node testler/yardimci/veri-islem.mjs sifrele <parola>   (stdin: { kutu, dosyalar: { yol: nesne } })
//   node testler/yardimci/veri-islem.mjs coz <parola>       (stdin: { kutu, dosyalar: { yol: "şifreli dosya metni" } })
//
// Sonuç (stdout): { yol: "şifreli dosya metni" } ya da { yol: nesne }. Parola yanlışsa ya da
// bir dosya açılmazsa çıkış kodu 1, hata stderr'e yazılır. Parola komut satırına yazıldığı için
// gerçek parolayla kullanılmaz.

import { kutudanAnahtar, sifrele, coz } from '../../uygulama/sifre.js';

const [komut, parola] = process.argv.slice(2);
if (!['sifrele', 'coz'].includes(komut) || !parola) {
  process.stderr.write('Kullanım: node testler/yardimci/veri-islem.mjs sifrele|coz <parola>  (JSON stdin\'den)\n');
  process.exit(1);
}

let girdi = '';
for await (const parca of process.stdin) girdi += parca;
const { kutu, dosyalar } = JSON.parse(girdi);

try {
  const anahtar = await kutudanAnahtar(parola, kutu);
  const sonuc = {};
  for (const [yol, deger] of Object.entries(dosyalar)) {
    sonuc[yol] = komut === 'sifrele'
      ? JSON.stringify(await sifrele(anahtar, deger))
      : await coz(anahtar, JSON.parse(deger));
  }
  process.stdout.write(JSON.stringify(sonuc));
} catch (hata) {
  process.stderr.write(`${hata.name}: ${hata.message}\n`);
  process.exit(1);
}
