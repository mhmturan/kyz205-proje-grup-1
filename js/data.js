/* ==========================================================================
   AURUM — data.js
   Süit / paket kataloğu · TEK DOĞRULUK KAYNAĞI
   --------------------------------------------------------------------------
   suitler.html (liste) ve suit-detay.html (detay) aynı diziyi okur; ana
   sayfadaki üç kart da buradaki kayıtlara bağlanır. Böylece bir süitin adı,
   fiyatı veya özelliği tek yerde değişir.

   Gerçek projede bu dosyanın yerini bir API yanıtı alır — alan adları
   kasıtlı olarak sunucudan gelecek şekle benzetildi.
   ========================================================================== */

(function (global) {
  'use strict';

  var KATEGORILER = [
    { slug: 'eylul-firsatlari', label: 'Eylül Fırsatları' },
    { slug: 'bogaz-manzarali',  label: 'Boğaz Manzaralı Süitler' },
    { slug: 'spa-wellness',     label: 'Spa & Wellness' },
    { slug: 'ozel-havuzlu',     label: 'Özel Havuzlu Villalar' },
    { slug: 'balayi',           label: 'Balayı Paketleri' }
  ];

  var MANZARALAR = ['Boğaz', 'Deniz', 'Bahçe', 'Şehir'];
  var OZELLIKLER = ['Özel Havuz', 'Jakuzi', 'Şömine', 'Teras', 'Spa Erişimi', 'Kahvaltı Dahil'];

  /* Tüm süitler için ortak koşullar — detay sayfasında listelenir */
  var POLITIKA = [
    'Girişten 7 gün öncesine kadar ücretsiz iptal.',
    'Giriş 15:00, çıkış 12:00. Geç çıkış müsaitliğe göre ücretsiz sağlanır.',
    '6 yaşına kadar çocuklar ebeveyn odasında ücretsiz konaklar.',
    'Evcil hayvan kabul edilmez.',
    'Ödeme girişte alınır; erken rezervasyon indirimi ön ödeme gerektirmez.'
  ];

  /* fiyat  : indirimsiz gecelik liste fiyatı (TL)
     indirim: erken rezervasyon yüzdesi
     galeri : detay sayfasındaki görsel şeridi (ilki büyük gösterilir)      */
  var SUITLER = [
    {
      id: 'executive-suite',
      ad: 'Executive Suite',
      kategoriler: ['bogaz-manzarali', 'eylul-firsatlari'],
      gorsel: 'assets/img/suite-01.png',
      galeri: ['assets/img/suite-01.png', 'assets/img/gallery-01.png',
               'assets/img/gallery-02.png', 'assets/img/exp-03-dining.png'],
      m2: 68, kapasite: 2, yatak: '1 King Size', manzara: 'Boğaz',
      ozellikler: ['Jakuzi', 'Teras', 'Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Karşılama ikramı', 'Ücretsiz otopark', 'Hızlı Wi-Fi'],
      puan: 9.4, yorum: 218, fiyat: 14999, indirim: 25,
      aciklama: 'Zeminden tavana pencerelerle Boğaz\'a açılan, el yapımı mobilyalarla döşenmiş imza süiti.',
      uzun: 'Otelin en çok tercih edilen süiti; salonu ve yatak odası Boğaz\'a bakan iki ayrı cepheye yerleşiyor. ' +
            'Zeminden tavana uzanan pencereler gün boyu doğal ışık alırken, akşamları karşı kıyının ışıkları odanın ' +
            'tek dekorasyonu hâline geliyor. Banyoda ıslak hacimden ayrılmış bir jakuzi ve ısıtmalı mermer zemin var. ' +
            'Küçük terası iki kişilik kahvaltı için hazırlanıyor.'
    },
    {
      id: 'deluxe-suite',
      ad: 'Deluxe Suite',
      kategoriler: ['bogaz-manzarali'],
      gorsel: 'assets/img/suite-02.png',
      galeri: ['assets/img/suite-02.png', 'assets/img/gallery-03.png',
               'assets/img/heritage-placeholder.png', 'assets/img/exp-01-heritage.png'],
      m2: 92, kapasite: 3, yatak: '1 King Size + 1 Tek Kişilik', manzara: 'Boğaz',
      ozellikler: ['Şömine', 'Teras', 'Spa Erişimi', 'Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Sınırsız spa erişimi', 'Akşam kanepe servisi', 'Ücretsiz otopark'],
      puan: 9.6, yorum: 143, fiyat: 24999, indirim: 20,
      aciklama: 'İki cepheden panoramik manzara, şömineli oturma salonu ve 20 m² özel teras.',
      uzun: 'Deluxe Suite, binanın köşe aksında yer aldığı için hem Boğaz\'a hem tarihi yarımadaya bakıyor. ' +
            'Oturma salonundaki çalışır durumdaki şömine kış aylarında yakılıyor; yazın ise 20 m² terasa açılan ' +
            'kemerli kapılar tamamen katlanarak salonu dış mekâna bağlıyor. Üçüncü misafir için ayrılan tek kişilik ' +
            'yatak, paravanla ayrılmış nişte konumlanıyor.'
    },
    {
      id: 'royal-villa',
      ad: 'Royal Villa',
      kategoriler: ['ozel-havuzlu'],
      gorsel: 'assets/img/suite-03.png',
      galeri: ['assets/img/suite-03.png', 'assets/img/exp-02-boat.png',
               'assets/img/gallery-01.png', 'assets/img/exp-04-event.png'],
      m2: 140, kapasite: 5, yatak: '2 King Size + 1 Çekyat', manzara: 'Deniz',
      ozellikler: ['Özel Havuz', 'Şömine', 'Teras', 'Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Özel havuz bakımı', 'Butler servisi', 'Limuzin transferi'],
      puan: 9.7, yorum: 74, fiyat: 39999, indirim: 18,
      aciklama: 'Denize sıfır konumda, 40 m² ısıtmalı özel havuzu ve ayrı yaşam alanı olan aile villası.',
      uzun: 'Bahçenin en uç noktasında, diğer villalardan çitlerle ayrılmış tamamen bağımsız bir yapı. ' +
            'İki yatak odası, ayrı bir yaşam alanı ve tam donanımlı bir mutfağı var. 40 m² ısıtmalı havuz ' +
            'nisan–kasım arası kullanılabiliyor; havuz başındaki gölgelikli oturma alanı akşam yemeği için ' +
            'kurulabiliyor. Villaya özel bir butler tüm konaklama boyunca hizmet veriyor.'
    },
    {
      id: 'garden-terrace',
      ad: 'Garden Terrace Suite',
      kategoriler: ['eylul-firsatlari'],
      gorsel: 'assets/img/suite-02.png',
      galeri: ['assets/img/suite-02.png', 'assets/img/exp-01-heritage.png',
               'assets/img/gallery-02.png'],
      m2: 52, kapasite: 2, yatak: '1 Queen Size', manzara: 'Bahçe',
      ozellikler: ['Teras', 'Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Bahçe kahvaltı servisi', 'Hızlı Wi-Fi'],
      puan: 9.0, yorum: 312, fiyat: 8900, indirim: 30,
      aciklama: 'Asırlık çınarlara bakan özel terasıyla sessizliği arayanlar için sakin bir sığınak.',
      uzun: 'Bahçe katındaki bu süit, doğrudan çınarların altına açılan özel bir terasa sahip. ' +
            'Trafik gürültüsünün hiç ulaşmadığı iç bahçeye baktığı için otelin en sessiz odası kabul ediliyor. ' +
            'Kahvaltı, istendiğinde terasta servis ediliyor.'
    },
    {
      id: 'thermal-spa-suite',
      ad: 'Thermal Spa Suite',
      kategoriler: ['spa-wellness', 'eylul-firsatlari'],
      gorsel: 'assets/img/gallery-02.png',
      galeri: ['assets/img/gallery-02.png', 'assets/img/gallery-03.png',
               'assets/img/exp-03-dining.png'],
      m2: 61, kapasite: 2, yatak: '1 King Size', manzara: 'Bahçe',
      ozellikler: ['Jakuzi', 'Spa Erişimi', 'Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Sınırsız termal havuz', 'Günlük 30 dk masaj', 'Detoks menüsü'],
      puan: 9.3, yorum: 187, fiyat: 12400, indirim: 25,
      aciklama: 'Odaya bağlı özel buhar odası ve sınırsız termal havuz erişimi içeren wellness süiti.',
      uzun: 'Spa katındaki tek konaklama birimi. Odadan doğrudan termal havuz alanına geçilebiliyor; ' +
            'ayrıca odanın kendi buhar odası ve iki kişilik jakuzisi bulunuyor. Konaklama boyunca her gün ' +
            '30 dakikalık masaj ve isteğe bağlı detoks menüsü pakete dahil.'
    },
    {
      id: 'wellness-retreat',
      ad: 'Wellness Retreat Villa',
      kategoriler: ['spa-wellness', 'ozel-havuzlu'],
      gorsel: 'assets/img/exp-01-heritage.png',
      galeri: ['assets/img/exp-01-heritage.png', 'assets/img/gallery-01.png',
               'assets/img/heritage-placeholder.png'],
      m2: 110, kapasite: 4, yatak: '2 Queen Size', manzara: 'Bahçe',
      ozellikler: ['Özel Havuz', 'Jakuzi', 'Spa Erişimi', 'Teras'],
      dahil: ['Kişiye özel beslenme planı', 'Günlük yoga seansı', 'Özel terapist', 'Sınırsız spa erişimi'],
      puan: 9.5, yorum: 96, fiyat: 24500, indirim: 15,
      aciklama: 'Kendi ısıtmalı havuzu, yoga terası ve özel terapistiyle üç günlük arınma programına uygun villa.',
      uzun: 'Üç gece ve üzeri konaklamalarda villaya bir wellness programı tanımlanıyor: giriş günü ölçüm ve ' +
            'görüşme, sonrasında kişiye özel beslenme planı, günlük yoga ve nefes seansları. Villanın kendi ' +
            'ısıtmalı havuzu, jakuzisi ve üstü açık yoga terası var.'
    },
    {
      id: 'marina-pool-loft',
      ad: 'Marina Pool Loft',
      kategoriler: ['ozel-havuzlu', 'eylul-firsatlari'],
      gorsel: 'assets/img/exp-02-boat.png',
      galeri: ['assets/img/exp-02-boat.png', 'assets/img/gallery-03.png',
               'assets/img/suite-03.png'],
      m2: 95, kapasite: 4, yatak: '1 King Size + 2 Tek Kişilik', manzara: 'Deniz',
      ozellikler: ['Özel Havuz', 'Teras'],
      dahil: ['Serpme kahvaltı', 'Marina tekne transferi', 'Çatı havuzu'],
      puan: 9.1, yorum: 128, fiyat: 17600, indirim: 28,
      aciklama: 'Marinanın hemen üzerinde, çift katlı yerleşimi ve çatı havuzuyla dikkat çeken loft.',
      uzun: 'Alt katta yaşam alanı ve mutfak, üst katta yatak odaları; en üstte ise yalnızca bu loft\'a ait ' +
            'bir çatı havuzu var. Marinaya inen özel merdiven sayesinde tekne turlarına odadan doğrudan ' +
            'geçilebiliyor.'
    },
    {
      id: 'honeymoon-suite',
      ad: 'Honeymoon Gold Suite',
      kategoriler: ['balayi', 'bogaz-manzarali'],
      gorsel: 'assets/img/gallery-03.png',
      galeri: ['assets/img/gallery-03.png', 'assets/img/suite-01.png',
               'assets/img/exp-03-dining.png'],
      m2: 72, kapasite: 2, yatak: '1 King Size', manzara: 'Boğaz',
      ozellikler: ['Jakuzi', 'Şömine', 'Kahvaltı Dahil'],
      dahil: ['Karşılama şampanyası', 'Mum ışığında akşam yemeği', 'Oda içi jakuzi', 'Geç çıkış'],
      puan: 9.8, yorum: 205, fiyat: 21400, indirim: 22,
      aciklama: 'Karşılama şampanyası, oda içi jakuzi ve mum ışığında özel akşam yemeği dahil balayı süiti.',
      uzun: 'Balayı çiftleri için hazırlanan süit, girişte şampanya ve çiçek düzenlemesiyle karşılıyor. ' +
            'Konaklama boyunca bir gece, Boğaz\'a bakan terasta yalnızca çifte servis edilen mum ışığında ' +
            'akşam yemeği düzenleniyor. Çıkış saati ücretsiz olarak 16:00\'ya uzatılıyor.'
    },
    {
      id: 'romance-villa',
      ad: 'Romance Pool Villa',
      kategoriler: ['balayi', 'ozel-havuzlu'],
      gorsel: 'assets/img/exp-03-dining.png',
      galeri: ['assets/img/exp-03-dining.png', 'assets/img/suite-03.png',
               'assets/img/gallery-01.png'],
      m2: 102, kapasite: 2, yatak: '1 King Size', manzara: 'Deniz',
      ozellikler: ['Özel Havuz', 'Jakuzi', 'Teras', 'Spa Erişimi'],
      dahil: ['Karşılama şampanyası', 'Çift masajı', 'Özel havuz', 'Gün batımı tekne turu'],
      puan: 9.6, yorum: 88, fiyat: 26800, indirim: 20,
      aciklama: 'Tamamen izole bahçesi ve gün batımına bakan özel havuzuyla iki kişilik villa.',
      uzun: 'Yalnızca iki kişi için tasarlanmış, etrafı yüksek çitlerle çevrili bağımsız villa. ' +
            'Havuz batı cephesine baktığı için gün batımı doğrudan sudan izleniyor. Konaklamaya bir çift ' +
            'masajı ve bir gün batımı tekne turu dahil.'
    },
    {
      id: 'city-deluxe',
      ad: 'City Deluxe Room',
      kategoriler: ['eylul-firsatlari'],
      gorsel: 'assets/img/exp-04-event.png',
      galeri: ['assets/img/exp-04-event.png', 'assets/img/gallery-02.png',
               'assets/img/heritage-placeholder.png'],
      m2: 38, kapasite: 2, yatak: '1 Queen Size', manzara: 'Şehir',
      ozellikler: ['Kahvaltı Dahil'],
      dahil: ['Serpme kahvaltı', 'Hızlı Wi-Fi', 'Çalışma masası'],
      puan: 8.7, yorum: 431, fiyat: 5400, indirim: 35,
      aciklama: 'Tarihi yarımadaya bakan, kısa şehir molaları için tasarlanmış kompakt ve zarif oda.',
      uzun: 'Kısa konaklamalar düşünülerek tasarlandı: geniş bir çalışma masası, hızlı internet ve ' +
            'sessiz bir cephe. Tarihi yarımada manzarası, odanın tek büyük penceresinden bütün olarak ' +
            'görülüyor.'
    }
  ];


  /* ---- Ortak yardımcılar (her iki sayfa da kullanır) ---- */

  function kategoriAdi(slug) {
    for (var i = 0; i < KATEGORILER.length; i++) {
      if (KATEGORILER[i].slug === slug) return KATEGORILER[i].label;
    }
    return slug;
  }

  function gecerliSlug(slug) {
    for (var i = 0; i < KATEGORILER.length; i++) {
      if (KATEGORILER[i].slug === slug) return true;
    }
    return false;
  }

  /* Serbest metni kategoriye çevirir: "Spa & Wellness" → 'spa-wellness' */
  function slugBul(metin) {
    var q = (metin || '').trim().toLocaleLowerCase('tr');
    if (!q) return null;
    for (var i = 0; i < KATEGORILER.length; i++) {
      if (KATEGORILER[i].label.toLocaleLowerCase('tr') === q) return KATEGORILER[i].slug;
    }
    return null;
  }

  function suitBul(id) {
    for (var i = 0; i < SUITLER.length; i++) {
      if (SUITLER[i].id === id) return SUITLER[i];
    }
    return null;
  }

  /* İndirimli gecelik fiyat — 50 TL'ye yuvarlanır (fiyat etiketi temiz dursun) */
  function indirimliFiyat(s) {
    return Math.round(s.fiyat * (100 - s.indirim) / 100 / 50) * 50;
  }

  global.AURUM = {
    KATEGORILER: KATEGORILER,
    MANZARALAR: MANZARALAR,
    OZELLIKLER: OZELLIKLER,
    POLITIKA: POLITIKA,
    SUITLER: SUITLER,
    kategoriAdi: kategoriAdi,
    gecerliSlug: gecerliSlug,
    slugBul: slugBul,
    suitBul: suitBul,
    indirimliFiyat: indirimliFiyat
  };

})(window);
