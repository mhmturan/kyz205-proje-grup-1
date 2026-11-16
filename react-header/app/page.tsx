import Header, { type NavItem } from "@/components/ui/header"

/* ──────────────────────────────────────────────────────────────
   Kullanım örneği
   ────────────────────────────────────────────────────────────── */

export default function Page() {
  return (
    <main className="min-h-screen bg-[#070708] text-[#F4F2EE]">
      {/* 1) En sade kullanım — varsayılan AURUM menüsü, bölüm ankraları */}
      <Header />

      <section id="hero" className="grid min-h-screen place-items-center">
        <h1 className="font-serif text-5xl">Zamanın yavaşladığı yer</h1>
      </section>
      <section id="heritage" className="min-h-screen" />
      <section id="suites" className="min-h-screen" />
      <section id="gallery" className="min-h-screen" />
      <section id="experiences" className="min-h-screen" />
      <footer id="footer" className="min-h-[50vh]" />
    </main>
  )
}

/* ──────────────────────────────────────────────────────────────
   2) Çok sayfalı kullanım — linkler gerçek sayfa yollarına gider
   ────────────────────────────────────────────────────────────── */

export const cokSayfaliMenu: NavItem[] = [
  { label: "Anasayfa", href: "/" },
  { label: "Hakkımızda", href: "/hakkimizda" },
  { label: "Odalar", href: "/odalar" },
  {
    label: "Galeri",
    href: "/galeri",
    children: [
      { label: "İç Mekan", href: "/galeri/ic-mekan" },
      { label: "Dış Mekan", href: "/galeri/dis-mekan" },
      { label: "Havuz", href: "/galeri/havuz" },
    ],
  },
  { label: "Sıkça Sorulan Sorular", href: "/sss" },
  { label: "İletişim", href: "/iletisim" },
]

export function CokSayfaliOrnek() {
  return (
    <Header
      brand="AURUM"
      items={cokSayfaliMenu}
      phone="+90 212 555 01 00"
      ctaLabel="Hemen Rezervasyon Yap"
      ctaHref="/rezervasyon"
    />
  )
}
