// Çizelge (ana ekran). GEÇİCİ: Görev 8'in kabuğu için yalnızca ay başlığı; Görev 9 bu dosyanın
// yerine ay çubuğunu (‹ Ekim 2026 ›), düğmeleri ve satırları koyar.

import { ayAdi } from '../tarih.js';

export function ekranCiz(kok, baglam) {
  const cubuk = document.createElement('header');
  cubuk.className = 'ay-cubugu';
  const baslik = document.createElement('h1');
  baslik.className = 'ay-adi';
  baslik.textContent = ayAdi(baglam.durum.ay);
  cubuk.append(baslik);
  kok.replaceChildren(cubuk);
}
