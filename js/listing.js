/* ==========================================================================
   AURUM — listing.js
   suitler.html: süit/paket verisi · filtreler · sıralama · URL senkronu
   --------------------------------------------------------------------------
   Kategoriler, ana sayfadaki rezervasyon çubuğunun "popüler aramalar"
   listesiyle birebir aynıdır (js/main.js · POPULAR).

   URL parametreleri (paylaşılabilir/geri tuşuyla çalışır):
     kategori, kisi, manzara, ozellik   → virgülle ayrılmış
     maxfiyat, sirala                   → tek değer
     giris, cikis, yetiskin, cocuk      → rezervasyon çubuğundan gelir
   ========================================================================== */

(function () {
  'use strict';

  var cardsEl = document.getElementById('cards');
  if (!cardsEl) return;                       /* Bu dosya yalnızca liste sayfasında çalışır */


  /* ========================================================================
     1. VERİ — js/data.js (tek doğruluk kaynağı)
     ======================================================================== */
  var KATEGORILER = AURUM.KATEGORILER;
  var MANZARALAR  = AURUM.MANZARALAR;
  var OZELLIKLER  = AURUM.OZELLIKLER;
  var SUITLER     = AURUM.SUITLER;


  /* ========================================================================
     2. DURUM
     ======================================================================== */
  var state = {
    kategori: [],
    kisi: [],            /* '2' | '3' | '4' (4 = 4 ve üzeri) */
    manzara: [],
    ozellik: [],
    maxfiyat: null,      /* null = sınır yok */
    sirala: 'onerilen'
  };

  /* Rezervasyon çubuğundan taşınan arama bilgisi (yalnızca gösterim + toplam) */
  var arama = { giris: '', cikis: '', yetiskin: 2, cocuk: 0, yaslar: '', gece: 0 };

  var PRICE_MAX = 30000;   /* Kaydıracın üst ucu = "sınır yok" */

  var fmtTL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });


  /* ========================================================================
     3. YARDIMCILAR
     ======================================================================== */
  /* Kategori adı/slug dönüşümleri ve fiyat hesabı ortak katmandan gelir */
  var kategoriAdi    = AURUM.kategoriAdi;
  var gecerliSlug    = AURUM.gecerliSlug;
  var slugBul        = AURUM.slugBul;
  var indirimliFiyat = AURUM.indirimliFiyat;

  function parseISO(str) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }


  /* ========================================================================
     4. URL ↔ DURUM
     ======================================================================== */
  function durumuURLdenOku() {
    var p = new URLSearchParams(window.location.search);

    function liste(ad) {
      var v = p.get(ad);
      return v ? v.split(',').filter(Boolean) : [];
    }

    /* Bilinmeyen slug'lar yok sayılır — elle yazılmış URL listeyi bozmasın */
    state.kategori = liste('kategori').filter(gecerliSlug);
    state.kisi     = liste('kisi');
    state.manzara  = liste('manzara');
    state.ozellik  = liste('ozellik');

    var mf = parseInt(p.get('maxfiyat'), 10);
    state.maxfiyat = isFinite(mf) && mf > 0 && mf < PRICE_MAX ? mf : null;

    /* Parametre yoksa varsayılana döner — geri tuşuyla sırasız bir
       aramaya dönülünce önceki sıralama takılı kalmasın */
    state.sirala = p.get('sirala') || 'onerilen';

    /* Ana sayfadaki çubuk serbest metin de gönderebilir: ?nerede=Spa & Wellness */
    var nerede = slugBul(p.get('nerede'));
    if (nerede && state.kategori.indexOf(nerede) === -1) state.kategori.push(nerede);

    /* Arama özeti */
    arama.giris = p.get('giris') || '';
    arama.cikis = p.get('cikis') || '';
    arama.yetiskin = parseInt(p.get('yetiskin'), 10) || 2;
    arama.cocuk = parseInt(p.get('cocuk'), 10) || 0;
    arama.yaslar = p.get('yaslar') || '';

    var g = parseISO(arama.giris), c = parseISO(arama.cikis);
    arama.gece = (g && c && c > g) ? Math.round((c - g) / 86400000) : 0;
  }

  function URLyiYaz(pushState) {
    var p = new URLSearchParams();

    if (state.kategori.length) p.set('kategori', state.kategori.join(','));
    if (state.kisi.length)     p.set('kisi', state.kisi.join(','));
    if (state.manzara.length)  p.set('manzara', state.manzara.join(','));
    if (state.ozellik.length)  p.set('ozellik', state.ozellik.join(','));
    if (state.maxfiyat)        p.set('maxfiyat', String(state.maxfiyat));
    if (state.sirala !== 'onerilen') p.set('sirala', state.sirala);

    /* Arama bilgisi korunur — "Aramayı Değiştir" dışında kaybolmasın */
    if (arama.giris) p.set('giris', arama.giris);
    if (arama.cikis) p.set('cikis', arama.cikis);
    if (arama.yetiskin !== 2) p.set('yetiskin', String(arama.yetiskin));
    if (arama.cocuk) p.set('cocuk', String(arama.cocuk));
    if (arama.yaslar) p.set('yaslar', arama.yaslar);

    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    if (pushState) history.pushState(null, '', url);
    else history.replaceState(null, '', url);

    /* Arama çubuğu (js/main.js) destinasyonu yeni kategoriyle eşitler */
    window.dispatchEvent(new Event('aurum:filters'));
  }


  /* ========================================================================
     5. FİLTRELEME + SIRALAMA
     ======================================================================== */
  function filtrele() {
    return SUITLER.filter(function (s) {
      if (state.kategori.length) {
        var eslesti = false;
        for (var i = 0; i < state.kategori.length; i++) {
          if (s.kategoriler.indexOf(state.kategori[i]) > -1) { eslesti = true; break; }
        }
        if (!eslesti) return false;
      }

      if (state.kisi.length) {
        /* '4' seçilirse 4 ve üzeri kapasiteler de uyar */
        var kisiUydu = state.kisi.some(function (k) {
          return k === '4' ? s.kapasite >= 4 : s.kapasite === +k;
        });
        if (!kisiUydu) return false;
      }

      if (state.manzara.length && state.manzara.indexOf(s.manzara) === -1) return false;

      /* Özelliklerde "hepsini içermeli" mantığı — daraltıcı filtre beklenir */
      for (var j = 0; j < state.ozellik.length; j++) {
        if (s.ozellikler.indexOf(state.ozellik[j]) === -1) return false;
      }

      if (state.maxfiyat && indirimliFiyat(s) > state.maxfiyat) return false;

      return true;
    });
  }

  function sirala(liste) {
    var kopya = liste.slice();
    switch (state.sirala) {
      case 'fiyat-artan':  kopya.sort(function (a, b) { return indirimliFiyat(a) - indirimliFiyat(b); }); break;
      case 'fiyat-azalan': kopya.sort(function (a, b) { return indirimliFiyat(b) - indirimliFiyat(a); }); break;
      case 'puan':         kopya.sort(function (a, b) { return b.puan - a.puan; }); break;
      case 'indirim':      kopya.sort(function (a, b) { return b.indirim - a.indirim; }); break;
      /* Önerilen: önce misafir puanı, indirim yalnızca ince ayar yapar
         (indirim katsayısı büyük olsaydı düşük puanlı ucuz oda başa geçerdi). */
      default: kopya.sort(function (a, b) {
        return (b.puan * 10 + b.indirim * 0.3) - (a.puan * 10 + a.indirim * 0.3);
      });
    }
    return kopya;
  }


  /* ========================================================================
     6. ÇİZİM
     ======================================================================== */

  /* ---- 6.1 Filtre kutucukları ---- */
  function onayKutusu(grup, deger, etiket, adet) {
    var id = 'f-' + grup + '-' + deger.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    var secili = state[grup].indexOf(deger) > -1 ? ' checked' : '';
    return '<label class="check" for="' + id + '">' +
             '<input type="checkbox" id="' + id + '" data-group="' + grup + '" ' +
                    'value="' + esc(deger) + '"' + secili + '>' +
             '<span>' + esc(etiket) + '</span>' +
             (adet != null ? '<span class="check__count">' + adet + '</span>' : '') +
           '</label>';
  }

  /* Bir seçenek işaretlenirse kaç sonuç kalır? — o gruptaki diğer seçimler
     yok sayılarak hesaplanır (klasik "facet count" davranışı). */
  function adet(grup, deger) {
    var yedek = state[grup];
    state[grup] = [deger];
    var n = filtrele().length;
    state[grup] = yedek;
    return n;
  }

  function filtreleriCiz() {
    document.getElementById('f-category').innerHTML = KATEGORILER.map(function (k) {
      return onayKutusu('kategori', k.slug, k.label, adet('kategori', k.slug));
    }).join('');

    document.getElementById('f-capacity').innerHTML =
      onayKutusu('kisi', '2', '2 Kişi', adet('kisi', '2')) +
      onayKutusu('kisi', '3', '3 Kişi', adet('kisi', '3')) +
      onayKutusu('kisi', '4', '4 Kişi ve üzeri', adet('kisi', '4'));

    document.getElementById('f-view').innerHTML = MANZARALAR.map(function (m) {
      return onayKutusu('manzara', m, m + ' Manzarası', adet('manzara', m));
    }).join('');

    document.getElementById('f-feature').innerHTML = OZELLIKLER.map(function (o) {
      return onayKutusu('ozellik', o, o, adet('ozellik', o));
    }).join('');

    var priceInput = document.getElementById('f-price');
    priceInput.value = state.maxfiyat || PRICE_MAX;
    fiyatEtiketi();

    document.getElementById('sort-select').value = state.sirala;
  }

  function fiyatEtiketi() {
    var out = document.getElementById('price-out');
    out.textContent = state.maxfiyat
      ? 'En fazla ' + fmtTL.format(state.maxfiyat) + ' ₺'
      : 'Üst sınır yok';
  }

  /* ---- 6.2 Aktif filtre rozetleri ---- */
  function rozetleriCiz() {
    var kap = document.getElementById('active-chips');
    var parca = [];

    state.kategori.forEach(function (s) { parca.push(rozet('kategori', s, kategoriAdi(s))); });
    state.kisi.forEach(function (k) { parca.push(rozet('kisi', k, k === '4' ? '4+ Kişi' : k + ' Kişi')); });
    state.manzara.forEach(function (m) { parca.push(rozet('manzara', m, m + ' Manzarası')); });
    state.ozellik.forEach(function (o) { parca.push(rozet('ozellik', o, o)); });
    if (state.maxfiyat) parca.push(rozet('maxfiyat', '', 'En fazla ' + fmtTL.format(state.maxfiyat) + ' ₺'));

    kap.innerHTML = parca.join('');
    kap.hidden = parca.length === 0;
  }

  function rozet(grup, deger, etiket) {
    return '<button class="chip" type="button" data-chip="' + grup + '" data-value="' + esc(deger) + '">' +
             esc(etiket) + '<span class="chip__x" aria-hidden="true">&times;</span>' +
             '<span class="sr-only">filtresini kaldır</span>' +
           '</button>';
  }

  /* ---- 6.3 Kartlar ---- */
  function kartHTML(s) {
    var yeni = indirimliFiyat(s);
    var toplam = arama.gece ? yeni * arama.gece : 0;

    /* Kart tıklaması detay sayfasına gider; arama bilgisi de taşınır. */
    var link = 'suit-detay.html?suit=' + encodeURIComponent(s.id) +
               (arama.giris ? '&giris=' + arama.giris + '&cikis=' + arama.cikis : '') +
               (arama.yetiskin !== 2 ? '&yetiskin=' + arama.yetiskin : '') +
               (arama.cocuk ? '&cocuk=' + arama.cocuk : '');

    return '' +
      '<article class="rcard">' +
        '<div class="rcard__media">' +
          '<img src="' + s.gorsel + '" alt="' + esc(s.ad) + '" loading="lazy" decoding="async">' +
          '<span class="rcard__tag">' + esc(kategoriAdi(s.kategoriler[0])) + '</span>' +
        '</div>' +

        '<div class="rcard__body">' +
          '<div>' +
            '<h3 class="rcard__name">' + esc(s.ad) + '</h3>' +
            '<p class="rcard__meta">' + s.m2 + ' m² · ' + s.kapasite + ' kişi · ' +
              esc(s.manzara) + ' manzarası</p>' +
            '<p class="rcard__desc">' + esc(s.aciklama) + '</p>' +

            '<div class="rcard__features">' +
              s.ozellikler.map(function (o) {
                return '<span class="feature">' + esc(o) + '</span>';
              }).join('') +
            '</div>' +

            '<p class="rcard__score">' +
              '<span class="score__badge">' + s.puan.toFixed(1) + '</span>' +
              '<span>' + s.yorum + ' değerlendirme</span>' +
            '</p>' +
          '</div>' +

          '<div class="rcard__price">' +
            '<span class="price__discount">%' + s.indirim + ' Erken Rezervasyon</span>' +
            '<span class="price__old">' + fmtTL.format(s.fiyat) + ' ₺</span>' +
            '<span class="price__new">' + fmtTL.format(yeni) + ' ₺</span>' +
            '<span class="price__unit">gecelik</span>' +
            (toplam ? '<span class="price__total">' + arama.gece + ' gece · ' +
                      fmtTL.format(toplam) + ' ₺</span>' : '') +
            '<a class="btn btn--gold rcard__cta" href="' + link + '">İncele</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function sonuclariCiz() {
    var liste = sirala(filtrele());

    cardsEl.innerHTML = liste.map(kartHTML).join('');
    document.getElementById('empty').hidden = liste.length > 0;

    var sayac = document.getElementById('result-count');
    sayac.innerHTML = liste.length
      ? SUITLER.length + ' süit içinden <b>' + liste.length + '</b> sonuç görüntüleniyor.'
      : 'Sonuç bulunamadı.';
  }

  function ciz() {
    filtreleriCiz();
    rozetleriCiz();
    sonuclariCiz();
  }


  /* ========================================================================
     7. OLAYLAR
     ======================================================================== */
  document.querySelector('.filters').addEventListener('change', function (e) {
    var box = e.target.closest('input[type="checkbox"][data-group]');
    if (!box) return;

    var grup = box.getAttribute('data-group');
    var deger = box.value;
    var i = state[grup].indexOf(deger);

    if (box.checked && i === -1) state[grup].push(deger);
    else if (!box.checked && i > -1) state[grup].splice(i, 1);

    URLyiYaz(true);
    ciz();
  });

  var priceInput = document.getElementById('f-price');
  /* input: etiket anlık güncellenir · change: liste yeniden çizilir
     (sürüklerken her piksel için yeniden render etmemek için ayrıldı) */
  priceInput.addEventListener('input', function () {
    var v = +priceInput.value;
    state.maxfiyat = v >= PRICE_MAX ? null : v;
    fiyatEtiketi();
  });
  priceInput.addEventListener('change', function () {
    URLyiYaz(true);
    ciz();
  });

  document.getElementById('sort-select').addEventListener('change', function (e) {
    state.sirala = e.target.value;
    URLyiYaz(true);
    sonuclariCiz();
  });

  document.getElementById('active-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;

    var grup = chip.getAttribute('data-chip');
    if (grup === 'maxfiyat') {
      state.maxfiyat = null;
    } else {
      var i = state[grup].indexOf(chip.getAttribute('data-value'));
      if (i > -1) state[grup].splice(i, 1);
    }
    URLyiYaz(true);
    ciz();
  });

  function temizle() {
    state.kategori = []; state.kisi = []; state.manzara = []; state.ozellik = [];
    state.maxfiyat = null; state.sirala = 'onerilen';
    URLyiYaz(true);
    ciz();
  }
  document.getElementById('filters-reset').addEventListener('click', temizle);
  document.getElementById('empty-reset').addEventListener('click', temizle);

  /* Geri/ileri tuşu: URL tek doğruluk kaynağı olduğu için durumu yeniden kur */
  window.addEventListener('popstate', function () {
    durumuURLdenOku();
    ciz();
  });


  /* ========================================================================
     8. BAŞLAT
     ======================================================================== */
  durumuURLdenOku();
  ciz();

})();
