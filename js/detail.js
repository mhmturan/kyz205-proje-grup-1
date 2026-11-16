/* ==========================================================================
   AURUM — detail.js
   suit-detay.html: seçilen süiti çizer · fiyat özeti · galeri · benzerler
   --------------------------------------------------------------------------
   URL parametreleri:
     suit     → js/data.js içindeki kayıt id'si (zorunlu)
     giris,cikis,yetiskin,cocuk → rezervasyon çubuğundan taşınan arama

   Tarih seçiliyse kart gerçek toplamı ve kazancı gösterir; seçili değilse
   gecelik fiyatı gösterip kullanıcıyı tarih seçmeye yönlendirir.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.getElementById('detail-root');
  if (!root) return;                          /* Yalnızca detay sayfasında çalışır */


  /* ========================================================================
     1. YARDIMCILAR
     ======================================================================== */
  var fmtTL    = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  var fmtTarih = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

  function parseISO(str) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Tekrar eden ikonlar tek yerde */
  var ICON = {
    tick: '<path d="m4 12.5 5 5 11-11"/>',
    area: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 3.5v17M3.5 8h17"/>',
    guest:'<path d="M17 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="10" cy="7" r="3.2"/>',
    bed:  '<path d="M3 18v-9M3 13h18v5M21 18v-3"/><path d="M6.5 10.5h4a1.5 1.5 0 0 1 1.5 1.5v1H5v-1a1.5 1.5 0 0 1 1.5-1.5z"/>',
    view: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>'
  };

  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }


  /* ========================================================================
     2. PARAMETRELER
     ======================================================================== */
  var p = new URLSearchParams(window.location.search);
  var suit = AURUM.suitBul(p.get('suit'));

  /* Geçersiz id → "bulunamadı" ekranı, gerisi hiç çizilmez */
  if (!suit) {
    document.getElementById('notfound').hidden = false;
    return;
  }

  var arama = {
    giris: p.get('giris') || '',
    cikis: p.get('cikis') || '',
    yetiskin: parseInt(p.get('yetiskin'), 10) || 2,
    cocuk: parseInt(p.get('cocuk'), 10) || 0
  };
  var gIn  = parseISO(arama.giris);
  var gOut = parseISO(arama.cikis);
  var gece = (gIn && gOut && gOut > gIn) ? Math.round((gOut - gIn) / 86400000) : 0;

  /* Aramayı bir sonraki adıma (rezervasyon formuna) aynen taşıyan sorgu */
  function aramaQS() {
    var q = new URLSearchParams();
    q.set('suit', suit.id);
    q.set('ad', suit.ad);
    if (arama.giris) { q.set('giris', arama.giris); q.set('cikis', arama.cikis); }
    if (arama.yetiskin !== 2) q.set('yetiskin', String(arama.yetiskin));
    if (arama.cocuk) q.set('cocuk', String(arama.cocuk));
    return q.toString();
  }

  root.hidden = false;


  /* ========================================================================
     3. BAŞLIK VE META
     ======================================================================== */
  document.title = suit.ad + ' — AURUM';
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', suit.aciklama);

  document.getElementById('crumb-name').textContent = suit.ad;
  document.getElementById('title').textContent = suit.ad;

  document.getElementById('badges').innerHTML = suit.kategoriler.map(function (k) {
    /* Rozet, aynı kategoriyle filtrelenmiş listeye döner */
    return '<a class="badge" href="suitler.html?kategori=' + k + '">' +
           esc(AURUM.kategoriAdi(k)) + '</a>';
  }).join('');

  document.getElementById('meta').innerHTML =
    '<span>' + svg(ICON.area)  + esc(suit.m2) + ' m²</span>' +
    '<span>' + svg(ICON.guest) + esc(suit.kapasite) + ' kişiye kadar</span>' +
    '<span>' + svg(ICON.bed)   + esc(suit.yatak) + '</span>' +
    '<span>' + svg(ICON.view)  + esc(suit.manzara) + ' manzarası</span>';

  document.getElementById('score').innerHTML =
    '<span class="score__badge">' + suit.puan.toFixed(1) + '</span>' +
    '<span>' + suit.yorum + ' değerlendirme</span>';

  document.getElementById('about').textContent = suit.uzun;

  document.getElementById('features').innerHTML = suit.ozellikler.map(function (o) {
    return '<li class="tick">' + svg(ICON.tick) + '<span>' + esc(o) + '</span></li>';
  }).join('');

  document.getElementById('included').innerHTML = suit.dahil.map(function (d) {
    return '<li class="tick">' + svg(ICON.tick) + '<span>' + esc(d) + '</span></li>';
  }).join('');

  document.getElementById('policy').innerHTML = AURUM.POLITIKA.map(function (k) {
    return '<li>' + esc(k) + '</li>';
  }).join('');


  /* ========================================================================
     4. GALERİ
     --------------------------------------------------------------------
     Sol büyük + sağda iki küçük. Dördüncü ve sonrası "+N fotoğraf"
     rozetiyle ikinci küçük görselin üzerinde toplanır.
     ======================================================================== */
  var foto = suit.galeri && suit.galeri.length ? suit.galeri : [suit.gorsel];

  function shot(index, sinif, extra) {
    return '<button class="shot ' + sinif + '" type="button" data-shot="' + index + '" ' +
             'aria-label="' + esc(suit.ad) + ' fotoğraf ' + (index + 1) + '">' +
             '<img src="' + foto[index] + '" alt="' + esc(suit.ad) + '" ' +
             (index === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">' +
             (extra || '') +
           '</button>';
  }

  var galeriHTML = shot(0, 'shot--main') + '<div class="detail-gallery__side">';
  if (foto[1]) galeriHTML += shot(1, 'shot--side');
  if (foto[2]) {
    var kalan = foto.length - 3;
    galeriHTML += shot(2, 'shot--side',
      kalan > 0 ? '<span class="shot__more">+' + kalan + ' fotoğraf</span>' : '');
  }
  galeriHTML += '</div>';
  document.getElementById('gallery').innerHTML = galeriHTML;


  /* ========================================================================
     5. REZERVASYON KARTI
     ======================================================================== */
  var gecelik = AURUM.indirimliFiyat(suit);
  var kazanc  = (suit.fiyat - gecelik) * (gece || 1);

  var rows = gece
    ? '<div class="book-row"><span>Giriş</span><b>' + fmtTarih.format(gIn) + '</b></div>' +
      '<div class="book-row"><span>Çıkış</span><b>' + fmtTarih.format(gOut) + '</b></div>' +
      '<div class="book-row"><span>Misafir</span><b>' + arama.yetiskin + ' Yetişkin' +
        (arama.cocuk ? ', ' + arama.cocuk + ' Çocuk' : '') + '</b></div>'
    : '<div class="book-row"><span>Tarih</span><b>Henüz seçilmedi</b></div>' +
      '<div class="book-row"><span>Misafir</span><b>' + arama.yetiskin + ' Yetişkin' +
        (arama.cocuk ? ', ' + arama.cocuk + ' Çocuk' : '') + '</b></div>';

  var totals = gece
    ? '<div class="total-row"><span>' + fmtTL.format(gecelik) + ' ₺ × ' + gece + ' gece</span>' +
        '<span>' + fmtTL.format(gecelik * gece) + ' ₺</span></div>' +
      '<div class="total-row total-row--save"><span>Erken rezervasyon kazancınız</span>' +
        '<span>−' + fmtTL.format(kazanc) + ' ₺</span></div>' +
      '<div class="total-row total-row--sum"><span>Toplam</span>' +
        '<b>' + fmtTL.format(gecelik * gece) + ' ₺</b></div>'
    : '<div class="total-row"><span>Toplam, tarih seçildikten sonra hesaplanır.</span></div>';

  document.getElementById('book-card').innerHTML =
    '<span class="book-card__discount">%' + suit.indirim + ' Erken Rezervasyon</span>' +
    '<p class="book-card__old">' + fmtTL.format(suit.fiyat) + ' ₺</p>' +
    '<p class="book-card__price">' + fmtTL.format(gecelik) + ' ₺ <small>/ gece</small></p>' +

    '<div class="book-card__rows">' + rows + '</div>' +
    '<div class="book-card__totals">' + totals + '</div>' +

    '<a class="btn btn--gold btn--block" href="index.html?' + esc(aramaQS()) + '#booking-form">' +
      (gece ? 'Rezervasyonu Tamamla' : 'Tarih Seç ve Rezerve Et') +
      '<span class="btn__icon" aria-hidden="true">&#8594;</span>' +
    '</a>' +

    '<p class="book-card__note">Ücretsiz iptal · Ön ödeme yok<br>' +
      '<a class="book-card__change" href="suitler.html">Başka süitlere göz at</a></p>';


  /* ========================================================================
     6. BENZER SÜİTLER — aynı kategoriden en fazla 3 kayıt
     ======================================================================== */
  var benzer = AURUM.SUITLER.filter(function (s) {
    if (s.id === suit.id) return false;
    for (var i = 0; i < s.kategoriler.length; i++) {
      if (suit.kategoriler.indexOf(s.kategoriler[i]) > -1) return true;
    }
    return false;
  }).slice(0, 3);

  if (benzer.length) {
    /* Arama bilgisi benzer süitlerin bağlantısında da korunur */
    var tasiyici = arama.giris ? '&giris=' + arama.giris + '&cikis=' + arama.cikis : '';

    document.getElementById('similar-grid').innerHTML = benzer.map(function (s) {
      var f = AURUM.indirimliFiyat(s);
      return '<a class="mini" href="suit-detay.html?suit=' + s.id + tasiyici + '">' +
               '<div class="mini__media"><img src="' + s.gorsel + '" alt="' + esc(s.ad) +
                 '" loading="lazy" decoding="async"></div>' +
               '<div class="mini__body">' +
                 '<h3 class="mini__name">' + esc(s.ad) + '</h3>' +
                 '<p class="mini__meta">' + s.m2 + ' m² · ' + s.kapasite + ' kişi · ' +
                   esc(s.manzara) + ' manzarası</p>' +
                 '<p class="mini__price"><s>' + fmtTL.format(s.fiyat) + ' ₺</s>' +
                   fmtTL.format(f) + ' ₺ </p>' +
               '</div>' +
             '</a>';
    }).join('');
    document.getElementById('similar').hidden = false;
  }


  /* ========================================================================
     7. TAM EKRAN GÖRSEL KUTUSU
     ======================================================================== */
  var lb      = document.getElementById('lightbox');
  var lbImg   = document.getElementById('lb-image');
  var lbCount = document.getElementById('lb-count');
  var aktif   = 0;
  var sonOdak = null;

  function goster(i) {
    aktif = (i + foto.length) % foto.length;     /* Uçlarda başa/sona sarar */
    lbImg.src = foto[aktif];
    lbImg.alt = suit.ad + ' — fotoğraf ' + (aktif + 1);
    lbCount.textContent = (aktif + 1) + ' / ' + foto.length;
  }

  function ac(i) {
    sonOdak = document.activeElement;
    goster(i);
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';     /* Arka plan kaymasın */
    document.getElementById('lb-close').focus();
  }

  function kapat() {
    lb.classList.remove('is-open');
    lb.hidden = true;
    document.body.style.overflow = '';
    if (sonOdak) sonOdak.focus();
  }

  document.getElementById('gallery').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-shot]');
    if (btn) ac(+btn.getAttribute('data-shot'));
  });

  document.getElementById('lb-close').addEventListener('click', kapat);
  document.getElementById('lb-prev').addEventListener('click', function () { goster(aktif - 1); });
  document.getElementById('lb-next').addEventListener('click', function () { goster(aktif + 1); });

  /* Görselin dışına tıklama kapatır; görselin kendisi kapatmaz */
  lb.addEventListener('click', function (e) {
    if (e.target === lb) kapat();
  });

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape')     kapat();
    if (e.key === 'ArrowLeft')  goster(aktif - 1);
    if (e.key === 'ArrowRight') goster(aktif + 1);
  });

})();
