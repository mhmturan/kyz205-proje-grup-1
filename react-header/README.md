# AURUM — React/Tailwind Header

Bu klasör **statik siteden bağımsızdır**. `index.html` bu dosyaları kullanmaz;
siteye entegre edilmiş sürüm `css/header.css` + `index.html` + `js/main.js`
içindedir. Burası, aynı header'ın React projesine taşınabilir hâlidir.

## Gereksinimler

```bash
npm install lucide-react
```

Tailwind CSS kurulu olmalı. Tema renkleri (altın `#C9A96A`, antrasit `#070708`)
bilinçli olarak **arbitrary value** yazıldı; `tailwind.config` düzenlemeden
çalışır. İstersen tema tokenlarına taşıyabilirsin:

```js
// tailwind.config.ts
theme: { extend: { colors: {
  gold:   { DEFAULT: "#C9A96A", light: "#E3CB96", dark: "#6E5624" },
  ink:    { DEFAULT: "#070708", soft: "#101116" },
} } }
```

Serif başlık için `font-serif` kullanılıyor; Playfair Display bağlamak için:

```css
/* globals.css */
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Inter:wght@300;400;500;600&display=swap");
:root { --font-serif: "Playfair Display", serif; }
```

```js
// tailwind.config.ts
theme: { extend: { fontFamily: { serif: ["Playfair Display", "serif"], sans: ["Inter", "sans-serif"] } } }
```

## Dosyalar

| Dosya | İçerik |
|---|---|
| `components/ui/header.tsx` | Header bileşeni (`Header`, `NavItem`, `HeaderProps`) |
| `app/page.tsx` | İki kullanım örneği: tek sayfa (ankra) ve çok sayfalı (yol) |

## Özellikler

- `sticky top-0 z-50` + `backdrop-blur-md`, kaydırınca koyulaşan cam zemin
- Marka + logo, `/` bağlantısı
- Galeri için açılır menü (hover + tıklama, `aria-expanded` / `aria-haspopup`)
- Altın gradyan CTA, hover'da gradyan kayması
- `lg` altında hamburger + sağdan kayan tam ekran mobil menü, akordeon alt menü
- ESC ile kapanma, `focus-visible` altın halka, mobil menü açıkken sayfa kilidi

## Bir uygulama notu

Mobil menü açıkken sayfa kilidi `body` yerine **`html`** üzerinden veriliyor
(`document.documentElement.style.overflow`). `body`'yi `position: fixed` yapan
yaygın çözüm belge yüksekliğini çökertiyor; scroll tabanlı animasyon kullanan
bir sayfada (GSAP ScrollTrigger gibi) bu, tüm tetikleyicilerin yanlış ölçümle
sıfırlanmasına yol açıyor. Aynı hatayı bu projenin statik sürümünde yaşayıp
düzelttik.
