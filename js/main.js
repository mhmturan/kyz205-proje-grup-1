/* ==========================================================================
   AURUM — main.js
   AŞAMA 2: Hero giriş animasyonu · Sinematik scroll (pin + zoom) · Rezervasyon çubuğu
   --------------------------------------------------------------------------
   Bağımlılıklar: GSAP 3.12 + ScrollTrigger (index.html'de CDN ile yüklenir)
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ------------------------------------------------------------------------
     0. GÜVENLİ AÇILIŞ (fail-safe)
     GSAP yüklenemezse (CDN engeli / çevrimdışı), CSS'teki gizli başlangıç
     durumlarını kaldırıp sayfayı statik ama TAM GÖRÜNÜR bırakıyoruz.
  ------------------------------------------------------------------------ */
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hero      = document.querySelector('.hero');
  var heroUI    = document.querySelector('.hero-ui');
  var heroVideo = document.getElementById('hero-video');

  /* Hero videosu scroll'u kilitlerken sayfa yüksekliği geçici olarak
     çöker (body position:fixed). Bu bayrak açıkken ScrollTrigger'ın
     yeniden ölçüm yapması ENGELLENİR — yoksa tüm bölümler "ulaşılamaz"
     sayılıp anında açılırdı. */
  var heroLocked = false;

  /* Hero girişini dışarıdan bitirebilmek için (header linkleri kullanıyor).
     initVideoHero çalışınca kendi finish fonksiyonunu buraya yazar. */
  var skipHeroIntro = null;


  /* ========================================================================
     1. GİRİŞ (INTRO) TIMELINE — sayfa açılışı
     Metin satırları maskeden yukarı akar, rezervasyon çubuğu en son belirir.
     (Video kendi opaklık geçişini CSS'te yapar; GSAP videoya dokunmaz —
     transform'unu scrub kontrolcüsü yazıyor.)
     ======================================================================== */
  function playIntro() {
    var tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      delay: 0.15,
      /* Bitince hero öğeleri de "revealed" sayılır: will-change temizlenir ve
         CSS transition'ları (rezervasyon çubuğu hover'ları) geri açılır. */
      onComplete: function () {
        markRevealed(document.querySelectorAll('.hero [data-reveal]'));
      }
    });

    tl.to('.hero__eyebrow', { autoAlpha: 1, duration: 1.0 }, 0.2)
      /* Maskeli satır açılımı — .mask__inner CSS'te translate3d(0,110%,0) bekler.
         DİKKAT: GSAP başlangıç transform'unu computed matrix'ten PX olarak okur,
         bu yüzden tek başına yPercent:0 kaymayı temizlemez; y:0 da şart.       */
      .to('.hero__title .mask__inner', {
        yPercent: 0,
        y: 0,
        duration: 1.4,
        stagger: 0.12
      }, 0.3)
      .to('.hero__sub',    { autoAlpha: 1, y: 0, duration: 1.2 }, 0.85)
      .to('.booking-bar',  { autoAlpha: 1, y: 0, duration: 1.2 }, 1.0)
      .to('.hero__cue',    { autoAlpha: 1, duration: 1.0 }, 1.3);

    return tl;
  }


  /* ========================================================================
     2. SCROLL'A KİLİTLİ VİDEO HERO
     --------------------------------------------------------------------
     Açılışta sayfa scroll'u kilitlenir; tekerlek/dokunma/klavye hareketi
     0→1 arası bir "ilerleme" değerine dönüşür ve video o orana karşılık
     gelen kareye seek edilir. İlerleme 1'e ulaşınca kilit KALICI olarak
     açılır ve sayfa normal akışına döner (bir daha kilitlenmez).

     Rezervasyon çubuğu bilinçli olarak sönmez: video akarken de ekranda
     kalır, misafir istediği an tarih seçebilir.
     ======================================================================== */
  function initVideoHero() {
    if (!hero || !heroVideo) return;

    var tagline = hero.querySelector('.hero__tagline');
    var bar     = hero.querySelector('.hero__progress-bar');
    var cue     = hero.querySelector('.hero__cue');
    var content = hero.querySelector('.hero-ui__content');

    /* Videonun tamamı için gereken toplam tekerlek mesafesi (px).
       Küçültürsen video daha çabuk biter, büyütürsen daha ağır akar. */
    var SCRUB_DISTANCE = 3200;

    var duration = 0;
    var target = 0, current = 0;
    var rafId = 0;
    var started = false, finished = false;
    var lockedY = 0;
    var seeking = false, pendingTime = null;
    var touchY = 0;

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    /* ---- 2.1 Video hazırlığı ---- */
    function onReady() {
      duration = heroVideo.duration || 0;
      heroVideo.classList.add('is-ready');
      if (typeof wake === 'function') wake();   /* Hazır olmadan gelen girdiyi uygula */
    }
    heroVideo.addEventListener('loadeddata', onReady);
    /* Yerel/önbellekli video bu satıra gelmeden hazır olabilir; o durumda
       loadeddata hiç tetiklenmez ve video kalıcı olarak gizli kalırdı. */
    if (heroVideo.readyState >= 2) onReady();

    /* Bazı tarayıcılar indirmeyi ancak play() çağrısıyla başlatır */
    var kick = heroVideo.play();
    if (kick && typeof kick.then === 'function') {
      kick.then(function () { heroVideo.pause(); }).catch(function () {});
    }

    /* ---- 2.2 Seek kuyruğu ----
       Art arda gelen seek istekleri tarayıcıyı boğar; biri sürerken gelen
       yeni hedef bekletilir, sadece EN SON hedef uygulanır. */
    heroVideo.addEventListener('seeked', function () {
      seeking = false;
      if (pendingTime !== null) {
        var t = pendingTime;
        pendingTime = null;
        seeking = true;
        heroVideo.currentTime = t;
      }
    });
    function seekTo(t) {
      if (seeking) { pendingTime = t; return; }
      seeking = true;
      heroVideo.currentTime = t;
    }

    /* ---- 2.3 Scroll kilidi ----
       DİKKAT: Orijinal bileşen body'yi position:fixed yapıyordu. Bizim
       sayfada bu ÖLÜMCÜL: body akıştan çıkınca belge yüksekliği çöküyor,
       ScrollTrigger bunu resize sanıp bütün tetikleyicileri 0 konumunda
       ateşleyip öldürüyordu (bölüm animasyonları hiç açılmıyordu).
       Bunun yerine html'e overflow:hidden veriyoruz — belge yüksekliği
       olduğu gibi kalır, ölçüler bozulmaz; kaydırmayı zaten wheel/touch/
       klavye olaylarını preventDefault ederek durduruyoruz.            */
    function lockScroll() {
      if (heroLocked) return;
      heroLocked = true;
      lockedY = window.scrollY;
      var h = document.documentElement.style;
      h.overflow = 'hidden';
      h.overscrollBehavior = 'none';
    }
    function unlockScroll() {
      if (!heroLocked) return;
      heroLocked = false;
      var h = document.documentElement.style;
      h.overflow = '';
      h.overscrollBehavior = '';
      window.scrollTo(0, lockedY);
    }

    /* ---- 2.4 Girdi → ilerleme ---- */
    function addDelta(dy) {
      target = clamp(target + dy / SCRUB_DISTANCE, 0, 1);
      if (target > 0.001) started = true;
      wake();
    }
    function onWheel(e) { addDelta(e.deltaY); e.preventDefault(); }
    function onTouchStart(e) { touchY = e.touches[0] ? e.touches[0].clientY : 0; }
    function onTouchMove(e) {
      var y = e.touches[0] ? e.touches[0].clientY : touchY;
      addDelta(touchY - y);
      touchY = y;
      e.preventDefault();
    }
    /* Klavyeyle gezenler kilitli kalmasın */
    var KEY_DELTA = {
      ArrowDown: 140, ArrowUp: -140,
      PageDown: 700,  PageUp: -700,
      ' ': 700, Spacebar: 700,
      End: SCRUB_DISTANCE, Home: -SCRUB_DISTANCE
    };
    function onKey(e) {
      var d = KEY_DELTA[e.key];
      if (d === undefined) return;
      addDelta(d);
      e.preventDefault();
    }

    function attach() {
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('keydown', onKey);
    }
    function detach() {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    }

    /* ---- 2.5 Bitiş: kilit kalkar, sayfa serbest ---- */
    function finish() {
      if (finished) return;
      finished = true;
      detach();
      cancelAnimationFrame(rafId);
      unlockScroll();
      if (bar) bar.style.transform = 'scaleX(1)';
      /* Kilit boyunca sayfa yüksekliği çökmüştü → tüm tetikleyicileri
         doğru ölçülerle yeniden kur. */
      ScrollTrigger.refresh();
    }

    /* ---- 2.6 Kare döngüsü ----
       PERFORMANS: Döngü yalnızca girdi geldiğinde çalışır, hedefe
       yerleşince durur (boşta CPU harcamaz). Seek yalnızca kare
       değiştiğinde yapılır; stil yazımları değer değiştiğinde yapılır. */
    var FPS = 24;                 /* hero.mp4 kare hızı */
    var lastFrameIdx = -1;
    var lastT = -1, lastQ = -1, lastCue = null;
    var running = false;

    function wake() {
      if (running || finished) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    }

    function frame() {
      var diff = target - current;
      current = Math.abs(diff) < 0.0005 ? target : current + diff * 0.18;

      if (duration > 0) {
        /* Aynı kareye tekrar seek etmek decoder'ı boşuna meşgul eder */
        var idx = Math.round(current * duration * FPS);
        if (idx !== lastFrameIdx) {
          lastFrameIdx = idx;
          seekTo(Math.min(idx / FPS, duration - 0.001));
        }
      }

      heroVideo.style.transform = 'scale(' + (1 + current * 0.06) + ')';

      /* Başlık bloğu ilk %35'te bulanıklaşarak silinir.
         Rezervasyon çubuğu bu bloğun DIŞINDA olduğu için etkilenmez.
         blur() pahalıdır → yalnızca değer değişince yaz, 0'da kaldır. */
      if (content) {
        var t = 1 - clamp(current / 0.35, 0, 1);
        t = Math.round(t * 100) / 100;
        if (t !== lastT) {
          lastT = t;
          content.style.opacity = String(t);
          content.style.transform = 'translate3d(0,' + ((1 - t) * -24) + 'px,0)';
          content.style.filter = (t === 1 || t === 0) ? '' : 'blur(' + ((1 - t) * 10) + 'px)';
          content.style.visibility = t === 0 ? 'hidden' : '';
        }
      }

      if (cue && lastCue !== started) {
        lastCue = started;
        cue.style.opacity = started ? '0' : '1';
      }

      /* Mesaj son %18'de belirir */
      if (tagline) {
        var q = clamp((current - 0.82) / 0.18, 0, 1);
        q = Math.round(q * 100) / 100;
        if (q !== lastQ) {
          lastQ = q;
          tagline.style.opacity = String(q);
          tagline.style.transform = 'translate3d(0,' + ((1 - q) * 20) + 'px,0)';
          tagline.style.filter = (q === 0 || q === 1) ? '' : 'blur(' + ((1 - q) * 8) + 'px)';
        }
      }

      if (bar) bar.style.transform = 'scaleX(' + current + ')';

      if (target >= 1 && current > 0.995) { running = false; finish(); return; }

      /* Hedefe ulaşıldı → döngüyü durdur, yeni girdi gelince wake() açar */
      if (current === target && (duration > 0 || target === 0)) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    /* ---- 2.7 Başlat ----
       Hareket azaltma tercihi varsa ya da sayfa ortasından yenilendiyse
       kilit hiç kurulmaz: video son karesinde durur, sayfa serbesttir. */
    if (reduced || window.scrollY > 10) {
      heroVideo.classList.add('is-ready');
      heroVideo.addEventListener('loadeddata', function () {
        heroVideo.currentTime = (heroVideo.duration || 0) * 0.92;
      });
      if (bar) bar.style.transform = 'scaleX(1)';
      if (tagline) tagline.style.opacity = '1';
      return;
    }

    lockScroll();
    attach();
    skipHeroIntro = finish;        /* Header linkleri girişi atlayabilsin */
    wake();                        /* İlk kareyi çiz; sonra girdi bekler */
  }


  /* ========================================================================
     3. REVEAL SİSTEMİ — hero dışındaki içerik animasyonları
     --------------------------------------------------------------------
     İki mod (sonraki bölümler de aynı iki attribute'u kullanacak):
       · [data-reveal-group] → içindeki öğeler TEK timeline'da, stagger ile
       · tekil [data-reveal] → kendi tetikleyicisiyle
     Gruptaki maskeli satırlar (.mask__inner) otomatik açılır.
     ======================================================================== */

  /* Tüm reveal'lerin ortak bitiş durumu (CSS'teki başlangıcın tersi) */
  var REVEAL_END = { autoAlpha: 1, y: 0, x: 0, scale: 1 };

  function markRevealed(nodes) {
    gsap.utils.toArray(nodes).forEach(function (el) {
      el.classList.add('is-revealed');   /* will-change temizliği */
    });
  }

  /* Sayfanın en dibindeki öğelerin tetikleyicisi ASLA ateşlenmeyebilir:
     scroll o noktaya ulaşamaz (footer'ın telif satırı tam olarak buydu —
     en fazla viewport'un %88'ine kadar çıkabiliyor, eşik ise %78).
     Eşik yüzdesiyle oynamak kırılgan bir çözüm; bunun yerine her refresh'te
     "başlangıcı maksimum scroll'un ötesinde mi?" diye soruyoruz.        */
  function playIfUnreachable(self) {
    /* Hero videosu scroll'u kilitliyken sayfa yüksekliği çökmüş olur ve
       maxScroll ~0 döner; o anda her tetikleyici "ulaşılamaz" görünüp
       tüm bölümler anında açılırdı. Kilit kalkınca zaten refresh ediliyor. */
    if (heroLocked) return;

    if (self.animation && self.start > ScrollTrigger.maxScroll(window)) {
      self.animation.progress(1);
    }
  }

  function initReveals() {

    /* ---- 3.1 Gruplar: ortak timeline + stagger ---- */
    gsap.utils.toArray('[data-reveal-group]').forEach(function (group) {
      var items = group.querySelectorAll('[data-reveal]');
      var lines = group.querySelectorAll('.mask__inner');

      /* Gruba özel gecikme: data-reveal-stagger="0.15" (varsayılan 0.2) */
      var stagger = parseFloat(group.getAttribute('data-reveal-stagger'));
      if (isNaN(stagger)) stagger = 0.2;

      var tl = gsap.timeline({
        defaults: { ease: 'expo.out' },
        scrollTrigger: {
          trigger: group,
          start: 'top 78%',
          once: true,
          onRefresh: playIfUnreachable
        },
        onComplete: function () {
          markRevealed(items);
          markRevealed(lines);
        }
      });

      /* Maskeli başlık satırları — y:0 ŞART:
         GSAP, CSS'teki translate3d(0,110%,0) değerini computed matrix'ten
         PX olarak okuduğu için tek başına yPercent:0 kaymayı temizlemez. */
      if (lines.length) {
        tl.to(lines, { yPercent: 0, y: 0, duration: 1.3, stagger: 0.12 }, 0.15);
      }

      if (items.length) {
        tl.to(items, Object.assign({}, REVEAL_END, {
          duration: 1.1,
          stagger: stagger         /* Öğeler arası zarif gecikme */
        }), 0);
      }
    });

    /* ---- 3.2 Tekil öğeler (hero ve grupların dışındakiler) ---- */
    gsap.utils.toArray('[data-reveal]').filter(function (el) {
      return !el.closest('.hero')                  /* intro timeline'ın */
          && !el.closest('[data-reveal-group]')    /* grup timeline'ının */
          && !el.closest('[data-heritage-panel]'); /* panel timeline'ının */
    }).forEach(function (el) {
      gsap.to(el, Object.assign({}, REVEAL_END, {
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
          onRefresh: playIfUnreachable
        },
        onComplete: function () { el.classList.add('is-revealed'); }
      }));
    });
  }


  /* ========================================================================
     3.3 MASKELİ GÖRSEL AÇILIMI + PARALLAX  →  [data-media-reveal]
     --------------------------------------------------------------------
     · .curtain yukarı doğru toplanır (scaleY 1 → 0)
     · Görsel aynı anda 1.2 → 1 ölçeklenir: kamera geri çekiliyor hissi
     · Ayrıca bölüm ekrandan geçerken sürekli, çok hafif parallax kayması
     ======================================================================== */
  function initMediaReveals() {
    gsap.utils.toArray('[data-media-reveal]').forEach(function (frame) {
      var curtain = frame.querySelector('.curtain');
      var img     = frame.querySelector('img');

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: frame,
          start: 'top 80%',
          once: true,
          onRefresh: playIfUnreachable
        }
      });

      if (curtain) {
        /* power4.inOut → ağır, kontrollü, "lüks" bir perde hareketi */
        tl.to(curtain, { scaleY: 0, duration: 1.5, ease: 'power4.inOut' }, 0);
      }
      if (img) {
        tl.from(img, { scale: 1.2, duration: 1.9, ease: 'power3.out' }, 0);

        /* Sürekli parallax. fromTo ile AÇIK başlangıç/bitiş veriyoruz:
           scrub'lı tween'in başlangıç değerini "o anki durumdan" okuyup
           scale animasyonuyla çakışmasını böylece engelliyoruz.
           ±5%, CSS'teki %118 görsel yüksekliğinin içinde kalır.        */
        gsap.fromTo(img,
          { yPercent: -5 },
          {
            yPercent: 5,
            ease: 'none',
            scrollTrigger: {
              trigger: frame,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true
            }
          });
      }
    });
  }


  /* ========================================================================
     3.3b MİRAS PANELİ — tek timeline'da sıralı açılış
     --------------------------------------------------------------------
     0.00  panel aşağıdan belirir (y:50 → 0, opacity 0 → 1)
     0.30  görsel perdesi yukarı toplanır + görsel 1.15 → 1
     0.35  başlık satırları maskeden çıkar
     0.45  sol kolon öğeleri stagger: 0.15 ile sıralanır
     1.35  "1998'den Beri" etiketi back.out ile sıçrayarak oturur
     Panelin transform'unu yalnızca bu timeline yazar; CSS'te panele
     transform tanımlanmaz (Aşama 3-4'te öğrendiğimiz çakışma kuralı).
     ======================================================================== */
  function initHeritagePanel() {
    var panel = document.querySelector('[data-heritage-panel]');
    if (!panel) return;

    var items   = panel.querySelectorAll('[data-reveal]');
    var lines   = panel.querySelectorAll('.mask__inner');
    var curtain = panel.querySelector('.curtain');
    var img     = panel.querySelector('.heritage__media img');
    var badge   = panel.querySelector('.heritage__badge');

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: panel,
        start: 'top 80%',
        once: true,
        onRefresh: playIfUnreachable
      },
      onComplete: function () {
        markRevealed(items);
        markRevealed(lines);
      }
    });

    tl.fromTo(panel,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0);

    if (curtain) {
      tl.to(curtain, { scaleY: 0, duration: 1.3, ease: 'power4.inOut' }, 0.3);
    }
    if (img) {
      /* Perde açılırken görsel geri çekilir — derinlik hissi */
      tl.from(img, { scale: 1.15, duration: 1.7, ease: 'power3.out' }, 0.3);
    }
    if (lines.length) {
      /* y:0 ŞART — GSAP, CSS'teki %110 kaymayı px olarak okur */
      tl.to(lines, { yPercent: 0, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12 }, 0.35);
    }
    if (items.length) {
      tl.to(items, Object.assign({}, REVEAL_END, {
        duration: 1,
        ease: 'expo.out',
        stagger: 0.15
      }), 0.45);
    }
    if (badge) {
      tl.fromTo(badge,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.7)' }, 1.35);
    }
  }


  /* ========================================================================
     3.4 SÜİT DESTESİ — scroll'a bağlı yelpaze açılımı
     --------------------------------------------------------------------
     Kartlar aynı grid hücresinde üst üste durur; scrub'lı timeline
     1. kartı sola, 3. kartı sağa açar, ortadaki hafifçe öne çıkar.
     fromTo ile AÇIK başlangıç değerleri veriyoruz: scrub'lı tween'in
     başlangıcı "o anki computed transform"dan okuması hem CSS'teki deste
     açısıyla, hem de resize sonrası yeniden ölçümle çakışırdı.
     ======================================================================== */
  function initSuiteStack() {
    var stage = document.getElementById('suites-stage');
    if (!stage) return;

    var cards = gsap.utils.toArray('.suite-card', stage);
    if (cards.length < 3) return;

    var stackMM = gsap.matchMedia();

    stackMM.add({
      wide:   '(min-width: 1101px) and (prefers-reduced-motion: no-preference)',
      mid:    '(min-width: 701px) and (max-width: 1100px) and (prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 700px) and (prefers-reduced-motion: no-preference)'
    }, function (context) {

      var c = context.conditions;

      /* Açılma mesafesi kartın KENDİ genişliğinin yüzdesi (xPercent).
         NOT: Eğim (rotation) ve ölçek farkı bilinçli olarak YOK —
         üç kart da düz ve birbiriyle aynı boyutta kalıyor.

         Masaüstü/tablette mesafe sabit değil, HESAPLANIYOR: açılan dizilim
         kapsayıcıyı tam doldurur, yani soldaki kart başlıkla aynı hizada
         başlar, sağdaki kart container kenarında biter. Fonksiyon değeri
         olduğu için invalidateOnRefresh her yeniden ölçümde günceller.   */
      function fillSpread() {
        var w = cards[0].offsetWidth;
        if (!w) return 110;
        var available = stage.getBoundingClientRect().width;
        return ((available - w) / 2) / w * 100;
      }

      /* Telefonda tam doldurmak kartları neredeyse üst üste yığardı
         (üç kart sığmıyor) → sabit, okunabilir bir açılma. */
      var spreadFn = c.narrow ? function () { return 42; } : fillSpread;

      /* Galeri destesiyle aynı davranış: bölüm ekrana girince animasyon
         KENDİ oynar (scroll'a bağlı değil) ve bir daha geri sarmaz.
         scrub kaldırıldı → yukarı kaydırınca kartlar tekrar kapanmaz. */
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: 'top 78%',         /* Deste ekrana girerken oynat   */
          once: true,               /* Bir kez: geri sarmaz, tekrarlamaz */
          invalidateOnRefresh: true,/* Tetiklenmeden önceki resize'larda
                                       açılma mesafesi yeniden ölçülür  */
          onRefresh: playIfUnreachable
        }
      });

      /* Yalnızca yatay açılma: 1. kart sola, 3. kart sağa — ikisi de AYNI
         ANDA (pozisyon 0), aynı süre ve eğriyle.
         Ortadaki karta hiç dokunulmaz → üçü de aynı boyutta ve düz kalır. */
      tl.fromTo(cards[0],
          { xPercent: 0 },
          { xPercent: function () { return -spreadFn(); },
            duration: 1.4, ease: 'power3.out' }, 0)

        .fromTo(cards[2],
          { xPercent: 0 },
          { xPercent: function () { return spreadFn(); },
            duration: 1.4, ease: 'power3.out' }, 0);

      /* Koşul değişirse (ör. tablet → masaüstü) inline stiller silinir,
         kartlar CSS'teki deste açısına geri döner. */
      return function () { gsap.set(cards, { clearProps: 'all' }); };
    });
  }


  /* ========================================================================
     3.5 GALERİ DESTESİ — fotoğraflar yerlerine süzülür
     --------------------------------------------------------------------
     Fotoğraflar aşağıdan ve dışarıdan, temel açılarından biraz daha
     eğik gelip yerlerine oturur (stagger: 0.2).
     GSAP yalnızca DIŞ katmanı (.g-photo) sürer; hover dağılması iç
     katmanda CSS ile çalıştığı için iki hareket çakışmaz.
     ======================================================================== */
  function initGalleryStack() {
    var stack = document.getElementById('gallery-stack');
    if (!stack) return;

    var p1   = stack.querySelector('.g-photo--1');
    var p2   = stack.querySelector('.g-photo--2');
    var ana  = stack.querySelector('.g-photo--3');
    if (!p1 || !p2 || !ana) return;

    /* Bir görseli ANA görselin tam üstüne (merkez merkeze) taşıyan fark.
       offsetLeft/offsetTop LAYOUT değerleridir; üzerlerindeki GSAP
       transform'undan etkilenmezler. Bu yüzden her refresh'te doğru
       sonuç verirler — getBoundingClientRect kullansaydık, bir önceki
       transform hesaba karışır ve değerler kayardı.                   */
    function fark(el, eksen) {
      return eksen === 'x'
        ? (ana.offsetLeft + ana.offsetWidth  / 2) - (el.offsetLeft + el.offsetWidth  / 2)
        : (ana.offsetTop  + ana.offsetHeight / 2) - (el.offsetTop  + el.offsetHeight / 2);
    }

    var galleryMM = gsap.matchMedia();

    galleryMM.add({
      wide:   '(min-width: 701px) and (prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 700px) and (prefers-reduced-motion: no-preference)'
    }, function (context) {

      /* Dar ekranda ızgara dikey akar; "içinden çıkma" anlamsız olur →
         sade, sıralı bir belirme. */
      if (context.conditions.narrow) {
        gsap.from([p1, p2, ana], {
          opacity: 0,
          y: 40,
          duration: 1,
          stagger: 0.12,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: stack,
            start: 'top 82%',
            once: true,
            onRefresh: playIfUnreachable
          }
        });
        return;
      }

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: stack,
          start: 'top 75%',         /* Bölüm ekrana girince kendi oynar */
          once: true,               /* Bir kez: geri sarmaz, tekrarlamaz */
          invalidateOnRefresh: true,/* Tetiklenmeden önceki resize'larda
                                       konum farkları yeniden ölçülür    */
          onRefresh: playIfUnreachable
        }
      });

      /* İki görsel de AYNI ANDA (pozisyon 0), aynı süre ve eğriyle çıkar:
         biri sola-yukarı, diğeri sola-aşağı. Fark yalnızca hedef
         konumlarından geliyor, zamanlamadan değil.
         Fonksiyon değerleri (i, hedef) alır → her eleman kendi farkını
         hesaplar; tek bir tween iki görseli de simetrik sürer.          */
      tl.fromTo([p1, p2],
        { x: function (i, el) { return fark(el, 'x'); },
          y: function (i, el) { return fark(el, 'y'); },
          scale: 0.78 },
        { x: 0, y: 0, scale: 1, duration: 1.4, ease: 'power3.out' }, 0);

      /* Ana görsel (3) tamamen sabit — scroll'a bağlı parallax kaldırıldı,
         yoksa animasyon bittikten sonra da kaymaya devam ederdi. */

      /* Koşul değişirse inline stiller silinir, ızgara CSS'e döner */
      return function () { gsap.set([p1, p2, ana], { clearProps: 'all' }); };
    });
  }


  /* ========================================================================
     4. REZERVASYON ÇUBUĞU — tarih mantığı ve doğrulama
     (Gerçek rezervasyon akışı / oda listesi sonraki aşamada bağlanacak)
     ======================================================================== */
  /* Yerel saate göre YYYY-AA-GG — toISOString() UTC'ye kaydırdığı için
     gün kayması yaşanmasın diye elle biçimlendiriyoruz. */
  function toISO(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function parseISO(s) {
    var parts = s.split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }
  function addDays(d, n) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /* ========================================================================
     4.1 REZERVASYON ÇUBUĞU
     --------------------------------------------------------------------
     Üç alan tek bir kontrolcüde: destinasyon · giriş-çıkış tarihi · misafir.
     Ortak bir panel yöneticisi var (aynı anda tek panel açık kalır, yer
     yoksa panel yukarı açılır). Görünen kısımlar tetikleyici; sunucuya
     gidecek değerler gizli input'lara yazılır.
     ======================================================================== */
  function initBookingBar() {
    var form = document.getElementById('booking-form');
    if (!form) return;

    /* Aynı çubuk suitler.html'de de var: orada gönderim sayfayı terk etmez,
       listeyi yerinde günceller (bkz. 4) GÖNDERİM). */
    var onListing = !!document.getElementById('cards');

    var feedback = form.querySelector('.booking-bar__feedback');
    var timer;

    function say(message) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(function () { feedback.classList.remove('is-visible'); }, 4500);
    }

    /* ---------------------------------------------------------------
       ORTAK PANEL YÖNETİCİSİ
       --------------------------------------------------------------- */
    var openPanel = null;

    /* Paneller gövde seviyesinde ve position:fixed. Konumları buradan,
       ilgili ALANIN ekrandaki koordinatından hesaplanıp inline yazılır.
       Böylece header dahil her şeyin üstünde kalırlar. */
    var GAP = 12, EDGE = 12;

    function positionPanel(panel, field) {
      if (!field) return;
      var f = field.getBoundingClientRect();

      /* Genişlik: takvim kendi genişliğini korur, diğerleri alana uyar */
      if (!panel.classList.contains('datepicker')) {
        panel.style.width = Math.round(f.width) + 'px';
      } else {
        panel.style.width = Math.min(640, window.innerWidth - 2 * EDGE) + 'px';
      }

      var w = panel.offsetWidth;
      var h = panel.offsetHeight;

      /* Yatay: alanın soluna hizala, ekran kenarlarına sıkıştır */
      var left = Math.min(Math.max(EDGE, f.left), window.innerWidth - w - EDGE);

      /* Dikey: altta yer varsa aşağı, yoksa yukarı aç. Rezervasyon çubuğu
         ekranın alt bandında durduğu için genelde yukarı açılır. */
      var below = window.innerHeight - f.bottom;
      var above = f.top;
      var openUp = below < h + GAP + EDGE && above > below;
      panel.classList.toggle('is-above', openUp);

      var top = openUp ? Math.max(EDGE, f.top - h - GAP) : f.bottom + GAP;
      panel.style.left = Math.round(left) + 'px';
      panel.style.top  = Math.round(top) + 'px';
    }

    function show(panel, trigger, field) {
      if (openPanel && openPanel.panel !== panel) hide();
      panel.hidden = false;
      /* Bir sonraki karede panel hâlâ açıksa animasyon sınıfını ekle —
         arada kapandıysa (ör. açılır açılmaz kaydırma) is-open gizli bir
         panelde takılı kalıp sonraki açılışın geçişini bozmasın. */
      requestAnimationFrame(function () {
        if (openPanel && openPanel.panel === panel) panel.classList.add('is-open');
      });
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      openPanel = { panel: panel, trigger: trigger, field: field };
      positionPanel(panel, field);
    }

    function hide() {
      if (!openPanel) return;
      openPanel.panel.classList.remove('is-open');
      openPanel.panel.hidden = true;
      if (openPanel.trigger) openPanel.trigger.setAttribute('aria-expanded', 'false');
      openPanel = null;
    }

    function isShown(panel) { return !!openPanel && openPanel.panel === panel; }

    document.addEventListener('click', function () { hide(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPanel) {
        var t = openPanel.trigger;
        hide();
        if (t) t.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (openPanel) positionPanel(openPanel.panel, openPanel.field);
    });
    /* Sayfa kayınca panel alanından kopar → kapat */
    window.addEventListener('scroll', function () { if (openPanel) hide(); }, { passive: true });

    /* Panel ve form içindeki tıklamalar belgeye ulaşıp paneli kapatmasın */
    form.addEventListener('click', function (e) { e.stopPropagation(); });
    ['destination-panel', 'date-panel', 'guests-panel'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.addEventListener('click', function (e) { e.stopPropagation(); });
    });


    /* ===============================================================
       1) DESTİNASYON — yalnızca listeden seçilir
       --------------------------------------------------------------
       Serbest yazı YOK: alan bir seçim butonudur, tıklanınca listenin
       tamamı açılır (filtrelenmez). Seçilen değer gizli #destination
       alanında tutulur; gönderim kodu onu okumaya devam eder.
       Klavye: ↓/Enter/Boşluk açar · ↑↓ Home/End gezinir · Tab sıradaki
       seçeneğe geçer, sondan tarih alanına çıkar · Esc kapatır.
       =============================================================== */
    var DEST_PLACEHOLDER = 'Nerde Kalmak İstiyorsunuz?';

    /* value '' = kategori kısıtı yok. Yazı silinemediği için seçimi geri
       almanın yolu bu seçenek. */
    var POPULAR = [
      { label: 'Tüm Kategoriler',         value: '',                        icon: 'all' },
      { label: 'Eylül Fırsatları',        value: 'Eylül Fırsatları',        icon: 'tag' },
      { label: 'Boğaz Manzaralı Süitler', value: 'Boğaz Manzaralı Süitler', icon: 'view' },
      { label: 'Spa & Wellness',          value: 'Spa & Wellness',          icon: 'spa' },
      { label: 'Özel Havuzlu Villalar',   value: 'Özel Havuzlu Villalar',   icon: 'pool' },
      { label: 'Balayı Paketleri',        value: 'Balayı Paketleri',        icon: 'heart' }
    ];
    var ICONS = {
      all:  '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
      tag:  '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1.4 1.4 0 0 1 0 2z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
      view: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
      spa:  '<path d="M12 21c0-6 2.5-9.5 0-15-2.5 5.5 0 9 0 15z"/><path d="M12 21c-4 0-7-3-8-8 5 0 8 3 8 8z"/><path d="M12 21c4 0 7-3 8-8-5 0-8 3-8 8z"/>',
      pool: '<path d="M2 17c1.8 0 1.8 1.8 3.6 1.8S7.4 17 9.2 17s1.8 1.8 3.6 1.8S14.6 17 16.4 17s1.8 1.8 3.6 1.8"/><path d="M8 15V5.5A2.5 2.5 0 0 1 10.5 3M16 15V5.5A2.5 2.5 0 0 0 13.5 3"/><path d="M8 8.5h8"/>',
      heart:'<path d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.4 12 20 12 20z"/>'
    };
    var CHECK = '<svg class="bb-sugg__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

    var destInput   = document.getElementById('destination');           /* gizli değer */
    var destTrigger = document.getElementById('destination-trigger');
    var destDisplay = document.getElementById('destination-display');
    var destPanel   = document.getElementById('destination-panel');
    var destList    = document.getElementById('destination-list');

    function destField()   { return destTrigger.closest('.bb-field'); }
    function destOptions() { return destList.querySelectorAll('.bb-sugg__btn'); }

    /* Seçili seçenek: değeri eşleşen. '' hem "hiç seçilmedi" hem "Tüm
       Kategoriler" olabildiği için o durumda görünen etikete de bakılır. */
    function isSelected(p) {
      if (p.value !== destInput.value) return false;
      return p.value !== '' || destDisplay.textContent === p.label;
    }

    function renderOptions() {
      destList.innerHTML = POPULAR.map(function (p) {
        var sel = isSelected(p);
        return '<li role="none"><button class="bb-sugg__btn' + (sel ? ' is-selected' : '') + '" ' +
               'type="button" role="option" aria-selected="' + sel + '" ' +
               'data-value="' + p.value + '" data-label="' + p.label + '">' +
               '<span class="bb-sugg__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
               'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
               ICONS[p.icon] + '</svg></span>' +
               '<span class="bb-sugg__label">' + p.label + '</span>' + CHECK + '</button></li>';
      }).join('');
    }

    /* Değer + görünen metin tek yerden yazılır. label verilmezse değerin
       kendisi, o da yoksa yer tutucu gösterilir. */
    function setDestination(value, label) {
      destInput.value = value || '';
      var text = label || value || '';
      destDisplay.textContent = text || DEST_PLACEHOLDER;
      destDisplay.classList.toggle('is-empty', !text);
      renderOptions();
    }

    function openDest() {
      show(destPanel, destTrigger, destField());
      /* Klavyeyle hemen seçilebilsin: odak seçili (yoksa ilk) seçenekte */
      var target = destList.querySelector('.is-selected') || destOptions()[0];
      if (target) target.focus({ preventScroll: true });
    }

    function pick(btn) {
      setDestination(btn.getAttribute('data-value'), btn.getAttribute('data-label'));
      /* Liste sayfası "kullanıcı destinasyona dokundu mu?" diye bakıyor */
      destInput.setAttribute('data-touched', '1');
      hide();
      destTrigger.focus();
    }

    if (destTrigger && destPanel) {
      renderOptions();

      destTrigger.addEventListener('click', function () {
        if (isShown(destPanel)) { hide(); return; }
        openDest();
      });

      destTrigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!isShown(destPanel)) openDest();
        }
      });

      destPanel.addEventListener('click', function (e) {
        var btn = e.target.closest('.bb-sugg__btn');
        if (btn) pick(btn);
      });

      destList.addEventListener('keydown', function (e) {
        var opts = Array.prototype.slice.call(destOptions());
        var i = opts.indexOf(document.activeElement);
        if (i < 0) return;

        var next = null;
        if (e.key === 'ArrowDown') next = opts[(i + 1) % opts.length];
        if (e.key === 'ArrowUp')   next = opts[(i - 1 + opts.length) % opts.length];
        if (e.key === 'Home')      next = opts[0];
        if (e.key === 'End')       next = opts[opts.length - 1];
        if (next) { e.preventDefault(); next.focus(); return; }

        /* Panel gövde seviyesinde durduğu için Tab doğal sırayla sayfanın
           başka bir yerine kaçardı → uçlarda çubuğa geri döndür. */
        if (e.key === 'Tab') {
          if (!e.shiftKey && i === opts.length - 1) {
            e.preventDefault(); hide();
            (dateTrigger || destTrigger).focus();
          } else if (e.shiftKey && i === 0) {
            e.preventDefault(); hide(); destTrigger.focus();
          }
        }
      });
    }


    /* ===============================================================
       2) GİRİŞ – ÇIKIŞ TARİHİ (tek kutu, iki aylık aralık takvimi)
       =============================================================== */
    var dateTrigger = document.getElementById('date-trigger');
    var datePanel   = document.getElementById('date-panel');
    var monthsEl    = document.getElementById('datepicker-months');
    var dateDisplay = document.getElementById('date-display');
    var dateNights  = document.getElementById('date-nights');
    var summary     = document.getElementById('datepicker-summary');
    var inVal       = document.getElementById('check-in');
    var outVal      = document.getElementById('check-out');

    var WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];   /* Pazartesi başlangıç */
    var fmtDay   = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
    var fmtFullD = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    var fmtShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    var fmtMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
    var fmtAria  = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    var today = startOfDay(new Date());
    var from  = today;                 /* Varsayılan: bugün → yarın */
    var to    = addDays(today, 1);
    var cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    var picking = 'from';

    function sameDay(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
    function nightsBetween(a, b) { return Math.round((b - a) / 86400000); }
    function monthCount() { return window.matchMedia('(min-width: 720px)').matches ? 2 : 1; }

    function renderMonth(base) {
      var year = base.getFullYear(), month = base.getMonth();
      var first = new Date(year, month, 1);
      var lead = (first.getDay() + 6) % 7;                 /* Pazartesi = 0 */
      var days = new Date(year, month + 1, 0).getDate();
      var rangeOpen = !!(from && to);

      var html = '<div class="dp-month"><p class="dp-month__title">' +
                 fmtMonth.format(first) + '</p><div class="dp-grid">';
      WEEKDAYS.forEach(function (w) { html += '<span class="dp-wd">' + w + '</span>'; });
      for (var i = 0; i < lead; i++) html += '<span class="dp-pad"></span>';

      for (var d = 1; d <= days; d++) {
        var date = new Date(year, month, d);
        var cls = 'dp-day';
        var disabled = date < today;
        if (disabled) cls += ' is-disabled';
        if (sameDay(date, today)) cls += ' is-today';
        if (sameDay(date, from)) cls += ' is-start' + (rangeOpen ? ' is-range-open' : '');
        if (sameDay(date, to)) cls += ' is-end';
        if (from && to && date > from && date < to) cls += ' is-between';

        html += '<button type="button" class="' + cls + '" data-date="' + toISO(date) + '"' +
                (disabled ? ' disabled' : '') +
                ' aria-label="' + fmtAria.format(date) + '">' + d + '</button>';
      }
      return html + '</div></div>';
    }

    function renderCalendar() {
      var out = '';
      for (var i = 0; i < monthCount(); i++) {
        out += renderMonth(new Date(cursor.getFullYear(), cursor.getMonth() + i, 1));
      }
      monthsEl.innerHTML = out;
      renderDateSummary();
      if (isShown(datePanel)) positionPanel(datePanel, dateTrigger.closest(".bb-field"));
    }

    function renderDateSummary() {
      if (!from) {
        summary.innerHTML = '<span class="dp-sum__hint">Giriş tarihini seçin.</span>';
        return;
      }
      var html = '<span class="dp-sum__date">' + fmtShort.format(from) + '</span>' +
                 '<span class="dp-sum__arrow" aria-hidden="true">→</span>';
      if (to) {
        var n = nightsBetween(from, to);
        html += '<span class="dp-sum__date">' + fmtShort.format(to) + '</span>';
        if (n > 0) html += '<span class="dp-sum__badge">' + n + ' gece</span>';
      } else {
        html += '<span class="dp-sum__hint">çıkış tarihini seçin</span>';
      }
      summary.innerHTML = html;
    }

    /* Çubuktaki tek kutu: "26 Eylül – 8 Ekim 2026" + "12 gece" rozeti.
       Aynı yıl içindeyse yıl yalnızca sonda yazılır. */
    function syncDateField() {
      if (!from) {
        dateDisplay.textContent = 'Tarih seçin';
        dateDisplay.classList.add('is-empty');
        dateNights.hidden = true;
      } else if (!to) {
        dateDisplay.textContent = fmtFullD.format(from) + ' – …';
        dateDisplay.classList.remove('is-empty');
        dateNights.hidden = true;
      } else {
        var sameYear = from.getFullYear() === to.getFullYear();
        dateDisplay.textContent = (sameYear ? fmtDay.format(from) : fmtFullD.format(from)) +
                                  ' – ' + fmtFullD.format(to);
        dateDisplay.classList.remove('is-empty');
        var n = nightsBetween(from, to);
        dateNights.textContent = n + ' gece';
        dateNights.hidden = n <= 0;
      }
      inVal.value  = from ? toISO(from) : '';
      outVal.value = to   ? toISO(to)   : '';
    }

    function pickDate(date) {
      if (picking === 'from' || !from || date <= from) {
        from = date;
        to = null;                      /* Yeni aralık başlıyor */
        picking = 'to';
      } else {
        to = date;
        picking = 'from';
      }
      syncDateField();
      renderCalendar();
    }

    if (dateTrigger && datePanel) {
      dateTrigger.addEventListener('click', function () {
        if (isShown(datePanel)) { hide(); return; }
        picking = 'from';
        if (from) cursor = new Date(from.getFullYear(), from.getMonth(), 1);
        renderCalendar();
        show(datePanel, dateTrigger, dateTrigger.closest(".bb-field"));
      });

      datePanel.addEventListener('click', function (e) {
        var day = e.target.closest('.dp-day[data-date]');
        if (day && !day.disabled) { pickDate(parseISO(day.getAttribute('data-date'))); return; }

        var nav = e.target.closest('[data-month-step]');
        if (nav) {
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (+nav.getAttribute('data-month-step')), 1);
          renderCalendar();
          return;
        }
        if (e.target.closest('#datepicker-clear')) {
          from = null; to = null; picking = 'from';
          syncDateField(); renderCalendar();
          return;
        }
        if (e.target.closest('#datepicker-done')) hide();
      });

      window.addEventListener('resize', function () { if (isShown(datePanel)) renderCalendar(); });
      syncDateField();
      renderDateSummary();
    }


    /* ===============================================================
       3) MİSAFİR — yetişkin / çocuk sayaçları + çocuk yaşları
       =============================================================== */
    var guestTrigger = document.getElementById('guests-trigger');
    var guestPanel   = document.getElementById('guests-panel');
    var guestDisplay = document.getElementById('guests-display');
    var agesBox      = document.getElementById('guest-ages');
    var agesGrid     = document.getElementById('guest-ages-grid');
    var guestsVal    = document.getElementById('guests');
    var childAgesVal = document.getElementById('child-ages');

    var LIMITS = { adults: { min: 1, max: 8 }, children: { min: 0, max: 6 } };
    var counts = { adults: 2, children: 0 };
    var childAges = [];

    function renderAges() {
      agesBox.hidden = counts.children === 0;
      if (counts.children === 0) { agesGrid.innerHTML = ''; return; }

      var html = '';
      for (var i = 0; i < counts.children; i++) {
        var val = childAges[i];
        var opts = '<option value=""' + (val === undefined || val === '' ? ' selected' : '') + '>Yaş</option>' +
                   '<option value="0"' + (val === '0' ? ' selected' : '') + '>0 – 1</option>';
        for (var a = 2; a <= 17; a++) {
          opts += '<option value="' + a + '"' + (val === String(a) ? ' selected' : '') + '>' + a + '</option>';
        }
        html += '<div class="age-item">' +
                  '<span class="age-item__label">' + (i + 1) + '. Çocuk</span>' +
                  '<select class="age-item__select" data-child="' + i + '" ' +
                          'aria-label="' + (i + 1) + '. çocuğun yaşı">' + opts + '</select>' +
                '</div>';
      }
      agesGrid.innerHTML = html;
      if (isShown(guestPanel)) positionPanel(guestPanel, guestTrigger.closest(".bb-field"));
    }

    function guestSummary() {
      var s = counts.adults + ' Yetişkin';
      if (counts.children > 0) s += ' + ' + counts.children + ' Çocuk';
      return s;
    }

    function syncGuests() {
      guestDisplay.textContent = guestSummary();
      guestsVal.value = guestSummary();
      childAgesVal.value = childAges.slice(0, counts.children).join(',');

      /* Sayaç butonlarının sınır durumları */
      Object.keys(LIMITS).forEach(function (key) {
        var row = guestPanel.querySelector('[data-stepper="' + key + '"]');
        if (!row) return;
        row.querySelector('[data-count]').textContent = counts[key];
        row.querySelector('[data-step="-1"]').disabled = counts[key] <= LIMITS[key].min;
        row.querySelector('[data-step="1"]').disabled  = counts[key] >= LIMITS[key].max;
      });
    }

    if (guestTrigger && guestPanel) {
      guestTrigger.addEventListener('click', function () {
        if (isShown(guestPanel)) { hide(); return; }
        show(guestPanel, guestTrigger, guestTrigger.closest(".bb-field"));
      });

      guestPanel.addEventListener('click', function (e) {
        var stepBtn = e.target.closest('[data-step]');
        if (stepBtn) {
          var row = stepBtn.closest('[data-stepper]');
          var key = row.getAttribute('data-stepper');
          var next = counts[key] + (+stepBtn.getAttribute('data-step'));
          counts[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, next));
          if (key === 'children') {
            /* Yeni yuvalar '' ile DOLDURULUR. Sadece length atasaydık dizi
               "seyrek" kalır, Array.some delikleri atlar ve eksik yaş
               kontrolü hiç çalışmazdı. */
            var eski = childAges.length;
            childAges.length = counts.children;
            for (var i = eski; i < counts.children; i++) childAges[i] = '';
            renderAges();
          }
          syncGuests();
          return;
        }
        if (e.target.closest('#guests-reset')) {
          counts = { adults: 2, children: 0 };
          childAges = [];
          renderAges(); syncGuests();
          return;
        }
        if (e.target.closest('#guests-done')) hide();
      });

      guestPanel.addEventListener('change', function (e) {
        var sel = e.target.closest('.age-item__select');
        if (!sel) return;
        childAges[+sel.getAttribute('data-child')] = sel.value;
        sel.classList.toggle('is-missing', sel.value === '');
        childAgesVal.value = childAges.slice(0, counts.children).join(',');
      });

      renderAges();
      syncGuests();
    }


    /* ===============================================================
       4) GÖNDERİM
       =============================================================== */
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!inVal.value || !outVal.value) {
        say('Lütfen giriş ve çıkış tarihlerini seçin.');
        if (dateTrigger) dateTrigger.click();
        return;
      }
      if (outVal.value <= inVal.value) {
        say('Çıkış tarihi, giriş tarihinden sonra olmalı.');
        return;
      }
      /* Çocuk varsa yaşları zorunlu — fiyatlandırma buna bağlı.
         Düz döngü kullanılıyor: dizi seyrek kalırsa some/forEach delikleri
         atlar ve eksik yaş fark edilmezdi. */
      var eksik = false;
      for (var ci = 0; ci < counts.children; ci++) {
        if (childAges[ci] === undefined || childAges[ci] === '') { eksik = true; break; }
      }
      if (eksik) {
        say('Lütfen her çocuk için yaş seçin.');
        if (guestTrigger) guestTrigger.click();
        var missing = guestPanel.querySelectorAll('.age-item__select');
        Array.prototype.forEach.call(missing, function (s) {
          s.classList.toggle('is-missing', s.value === '');
        });
        return;
      }

      var nights = nightsBetween(parseISO(inVal.value), parseISO(outVal.value));
      var dest   = destInput ? destInput.value.trim() : '';

      /* Arama, sonuç sayfasına parametrelerle taşınır (suitler.html onu okur).
         Destinasyon bir kategori adıysa liste doğrudan o kategoriyle açılır. */
      var params = new URLSearchParams();

      if (onListing) {
        /* Liste sayfasında yan paneldeki filtreler (fiyat, özellik, sıralama…)
           korunur; yalnızca aramanın kendi alanları yenilenir. */
        var ARAMA = ['nerede', 'kategori', 'giris', 'cikis', 'yetiskin', 'cocuk', 'yaslar'];
        new URLSearchParams(window.location.search).forEach(function (v, k) {
          if (ARAMA.indexOf(k) === -1) params.set(k, v);
        });

        /* Listeden seçim yapılmadıysa mevcut kategori seçimi (birden fazla
           olabilir) aynen kalır; seçildiyse yeni destinasyon onun yerini
           alır, "Tüm Kategoriler" seçildiyse tüm kategoriler gösterilir. */
        var cur = new URLSearchParams(window.location.search);
        if (!destInput.hasAttribute('data-touched')) {
          /* Ana sayfadan gelen ilk arama "nerede" ile, yan panelden yapılan
             seçimler "kategori" ile yazılır — hangisi varsa korunur. */
          if (cur.get('kategori')) params.set('kategori', cur.get('kategori'));
          if (cur.get('nerede'))   params.set('nerede', cur.get('nerede'));
        } else if (dest) {
          params.set('nerede', dest);
        }
      } else if (dest) {
        params.set('nerede', dest);
      }

      params.set('giris', inVal.value);
      params.set('cikis', outVal.value);
      params.set('yetiskin', String(counts.adults));
      if (counts.children) {
        params.set('cocuk', String(counts.children));
        params.set('yaslar', childAges.slice(0, counts.children).join(','));
      }

      if (onListing) {
        /* Sayfa yenilenmez: adres güncellenir, liste popstate ile yeniden
           çizilir (js/listing.js). Geri tuşu önceki aramaya döner. */
        history.pushState(null, '', 'suitler.html?' + params.toString());
        window.dispatchEvent(new PopStateEvent('popstate'));
        say('Arama güncellendi · ' + nights + ' gece · ' + guestSummary());
        return;
      }

      say((dest ? dest + ' · ' : '') + nights + ' gece · ' + guestSummary() +
          ' — uygun süitler listeleniyor…');
      window.location.href = 'suitler.html?' + params.toString();
    });


    /* ===============================================================
       5) ADRES SATIRINDAN ÖN-DOLDURMA
       --------------------------------------------------------------
       • Detay sayfasındaki "Rezervasyonu Tamamla" seçilen süiti ve
         tarihleri taşır (ana sayfa).
       • suitler.html'de çubuk, o anki aramayla dolu açılır ki kullanıcı
         yalnızca değiştirmek istediği alana dokunsun.
       =============================================================== */
    function prefillFromURL() {
      var p = new URLSearchParams(window.location.search);

      /* ---- Destinasyon ---- */
      var ad = p.get('ad');
      var dest = ad || p.get('nerede') || '';
      var destLabel = '';
      if (!dest && window.AURUM) {
        /* Liste tek bir kategoriyle filtreliyse onun adı yazılır; birden
           fazlaysa değer boş kalır, alanda kaç tane seçili olduğu yazar. */
        var kat = (p.get('kategori') || '').split(',').filter(AURUM.gecerliSlug);
        if (kat.length === 1) dest = AURUM.kategoriAdi(kat[0]);
        else if (kat.length > 1) destLabel = kat.length + ' kategori seçili';
      }
      /* Liste sayfasında kategori kısıtı yoksa zaten hepsi gösteriliyor —
         alan da bunu söylesin (ana sayfada yer tutucu kalır). */
      if (onListing && !dest && !destLabel) destLabel = 'Tüm Kategoriler';
      if (destTrigger) {
        setDestination(dest, destLabel);
        /* Yeni arama yüklendi → kullanıcı henüz listeden seçim yapmadı */
        destInput.removeAttribute('data-touched');
      }

      /* ---- Tarihler ---- */
      var g = parseISO(p.get('giris') || '');
      var c = parseISO(p.get('cikis') || '');
      if (g && c && c > g) {
        from = g;
        to = c;
        picking = 'from';
        cursor = new Date(g.getFullYear(), g.getMonth(), 1);
        syncDateField();
        renderDateSummary();
      }

      /* ---- Misafir ---- */
      /* Parametre yoksa varsayılan (2 yetişkin) — geri tuşuyla parametresiz
         bir aramaya dönüldüğünde önceki sayılar takılı kalmasın. */
      if (guestPanel) {
        var y = parseInt(p.get('yetiskin'), 10) || 2;
        var k = parseInt(p.get('cocuk'), 10) || 0;
        counts.adults   = Math.min(LIMITS.adults.max, Math.max(LIMITS.adults.min, y));
        counts.children = Math.min(LIMITS.children.max, Math.max(0, k));

        /* Yaşlar yoksa '' ile doldurulur → gönderimde eksik yaş uyarısı çalışır */
        var yaslar = (p.get('yaslar') || '').split(',');
        childAges = [];
        for (var i = 0; i < counts.children; i++) childAges.push(yaslar[i] || '');

        renderAges();
        syncGuests();
      }

      if (ad) say(ad + ' seçildi — tarihleri onaylayıp rezervasyonu tamamlayın.');
    }
    prefillFromURL();

    /* Liste sayfasında geri/ileri tuşu veya yan paneldeki filtreler adresi
       değiştirir → çubuk da o aramayı yansıtsın. */
    if (onListing) {
      window.addEventListener('popstate', prefillFromURL);
      window.addEventListener('aurum:filters', prefillFromURL);
    }
  }


  /* ========================================================================
     4.2 DENEYİM KARTLARI — hover'da video oynat
     --------------------------------------------------------------------
     Videolar preload="none" ile durur; ilk indirme ancak play() çağrısıyla
     başlar. Dört video'yu sayfa açılışında indirmek, bu bölümün tek
     başına megabaytlarca maliyeti olurdu.
     Kapak/video opaklık geçişi CSS'te (experiences.css) — burada yalnızca
     oynatma kontrolü var.
     ======================================================================== */
  function initExperienceVideos() {
    var cards = document.querySelectorAll('.exp-card');
    if (!cards.length) return;

    var canHover = window.matchMedia('(hover: hover)').matches;

    Array.prototype.forEach.call(cards, function (card) {
      var video = card.querySelector('video');
      if (!video) return;

      function start() {
        var playing = video.play();
        /* Tarayıcı otomatik oynatmayı reddedebilir → sessizce yut */
        if (playing && typeof playing.catch === 'function') {
          playing.catch(function () {});
        }
      }
      function stop() { video.pause(); }

      if (canHover) {
        card.addEventListener('mouseenter', start);
        card.addEventListener('mouseleave', stop);
      }
      /* Klavye ile gezenler de aynı deneyimi görsün */
      card.addEventListener('focusin', start);
      card.addEventListener('focusout', stop);
    });
  }


  /* ========================================================================
     4.3 BÜLTEN FORMU
     ======================================================================== */
  function initNewsletter() {
    var form = document.getElementById('newsletter-form');
    if (!form) return;

    var input    = form.querySelector('#newsletter-email');
    var feedback = document.querySelector('.newsletter__feedback');
    var timer;

    function say(message) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(function () {
        feedback.classList.remove('is-visible');
      }, 4000);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var value = input.value.trim();
      /* Kaba ön kontrol — asıl doğrulama her zaman sunucuda yapılmalı */
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        say('Geçerli bir e-posta adresi girin.');
        input.focus();
        return;
      }

      say('Teşekkürler — kaydınız alındı.');
      form.reset();

      /* Gerçek entegrasyon: burada bülten servisine POST edilecek. */
    });
  }


  /* ========================================================================
     4.4 HEADER — yapışkan navigasyon, açılır menü, mobil menü
     --------------------------------------------------------------------
     Hero videosu scroll'u kilitlemişken bir menü linkine tıklanırsa önce
     giriş bitirilir (kilit açılır), sonra tarayıcı ankraya kayar.
     ======================================================================== */
  function initHeader() {
    var header = document.getElementById('site-header');
    if (!header) return;

    var burger     = document.getElementById('menu-toggle');
    var mobileMenu = document.getElementById('mobile-menu');
    var navLinks   = document.querySelectorAll('.nav__link[href^="#"], .nav__sublink, .mobile-menu__link[href^="#"], .mobile-menu__sublink, .brand, .header__cta, .mobile-menu__footer .btn');

    /* ---- Sayfa kaydırılınca header koyulaşır ---- */
    function onScroll() {
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---- Masaüstü açılır menü ---- */
    var dropdowns = document.querySelectorAll('.nav__item[data-dropdown]');
    function closeDropdowns(hariç) {
      Array.prototype.forEach.call(dropdowns, function (item) {
        if (item === hariç) return;
        item.classList.remove('is-open');
        var btn = item.querySelector('button');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
    Array.prototype.forEach.call(dropdowns, function (item) {
      var btn = item.querySelector('button');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !item.classList.contains('is-open');
        closeDropdowns(item);
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
      /* İşaretçisi olan cihazlarda üzerine gelince de açılsın */
      if (window.matchMedia('(hover: hover)').matches) {
        item.addEventListener('mouseenter', function () {
          closeDropdowns(item);
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        });
        item.addEventListener('mouseleave', function () {
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        });
      }
    });
    document.addEventListener('click', function () { closeDropdowns(null); });

    /* ---- Mobil menü ---- */
    function setMenu(open) {
      if (!mobileMenu || !burger) return;
      mobileMenu.classList.toggle('is-open', open);
      mobileMenu.setAttribute('aria-hidden', String(!open));
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
      burger.querySelector('.icon-open').style.display  = open ? 'none' : 'block';
      burger.querySelector('.icon-close').style.display = open ? 'block' : 'none';

      /* Sayfa kilidi: hero kendi kilidini yönetiyorsa ona dokunma */
      if (!heroLocked) {
        document.documentElement.style.overflow = open ? 'hidden' : '';
      }
    }
    if (burger) {
      burger.addEventListener('click', function () {
        setMenu(!mobileMenu.classList.contains('is-open'));
      });
    }

    /* Mobil alt menü (akordeon) */
    var mobileDropdowns = document.querySelectorAll('.mobile-menu__item[data-dropdown]');
    Array.prototype.forEach.call(mobileDropdowns, function (item) {
      var btn = item.querySelector('button');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-open');
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });

    /* ESC: açık olan her şeyi kapat */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeDropdowns(null);
      setMenu(false);
    });

    /* ---- Link tıklamaları ---- */
    Array.prototype.forEach.call(navLinks, function (link) {
      link.addEventListener('click', function () {
        /* Hero girişi sürüyorsa önce onu bitir ki ankraya kayabilelim */
        if (heroLocked && typeof skipHeroIntro === 'function') skipHeroIntro();
        closeDropdowns(null);
        setMenu(false);
      });
    });

    /* ---- Ekrandaki bölümü menüde işaretle ---- */
    var sectionMap = {};
    Array.prototype.forEach.call(
      document.querySelectorAll('.nav__link[href^="#"], .mobile-menu__link[href^="#"]'),
      function (link) {
        var id = link.getAttribute('href').slice(1);
        if (!sectionMap[id]) sectionMap[id] = [];
        sectionMap[id].push(link);
      });

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var links = sectionMap[entry.target.id];
          if (!links) return;
          links.forEach(function (l) { l.classList.toggle('is-active', entry.isIntersecting); });
        });
      }, { rootMargin: '-45% 0px -45% 0px' });   /* Ekranın orta bandı */

      Object.keys(sectionMap).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }
  }


  /* ========================================================================
     5. BAŞLAT
     ======================================================================== */
  initHeader();
  initBookingBar();
  initNewsletter();
  initReveals();

  if (!reduced) {
    playIntro();
    /* Perde inip görsel ölçeklenmesi hareket temelli olduğu için
       reduced-motion'da hiç kurulmaz (CSS de perdeyi gizler). */
    initMediaReveals();
    initHeritagePanel();
    initSuiteStack();
    initGalleryStack();
    /* Döngüsel video da bir harekettir: reduced-motion'da hiç oynatılmaz
       (CSS de kapak görselini yerinde tutar). */
    initExperienceVideos();
  }

  /* EN SONDA: diğer tüm ScrollTrigger'lar doğru sayfa yüksekliğiyle
     kurulduktan SONRA scroll kilitlenir. Sıra tersine olsaydı hepsi
     çökmüş yükseklikle ölçülürdü. */
  initVideoHero();

  /* Görseller ve fontlar yerleşince ölçüler yenilenmeli — ama hero kilitliyken
     DEĞİL (o sırada sayfa yüksekliği geçici olarak çökmüş durumda). */
  function refreshIfUnlocked() {
    if (!heroLocked) ScrollTrigger.refresh();
  }
  window.addEventListener('load', refreshIfUnlocked);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshIfUnlocked);
  }

})();
