// SADECE testler içindir: verilen parola ve token ile veri/anahtar.json biçiminde token kutusu üretir.
//
//   node testler/yardimci/anahtar-uret.mjs <parola> <token> [tekrar]
//
// Kutuyu (JSON) standart çıktıya yazar. tekrar verilmezse sifre.js'in TEKRAR'ı (600.000) kullanılır;
// ekran testleri hız için 1000 verir. Gerçek kutu araclar/kurulum.html ile, Anıl'ın bilgisayarında
// üretilir: komut satırına yazılan parola işlem listesinde görünür, bu betik gerçek parolayla
// kullanılmaz.

import { tokenKutusuOlustur, TEKRAR } from '../../uygulama/sifre.js';

const KULLANIM = 'Kullanım: node testler/yardimci/anahtar-uret.mjs <parola> <token> [tekrar]';

function dur(neden) {
  process.stderr.write(`${neden}\n${KULLANIM}\n`);
  process.exit(1);
}

const argumanlar = process.argv.slice(2);
if (argumanlar.length < 2 || argumanlar.length > 3) dur('İki ya da üç bağımsız değişken gerekir.');
const [parola, token, tekrarMetni] = argumanlar;
if (parola === '' || token === '') dur('Parola ve token boş olamaz.');
let tekrar = TEKRAR;
if (tekrarMetni !== undefined) {
  if (!/^[1-9]\d*$/.test(tekrarMetni)) dur('tekrar pozitif bir tam sayı olmalı.');
  tekrar = Number(tekrarMetni);
}

const kutu = await tokenKutusuOlustur(parola, token, { tekrar });
process.stdout.write(`${JSON.stringify(kutu, null, 2)}\n`);
