"use client"

import * as React from "react"
import { ChevronDown, Menu, Phone, X } from "lucide-react"

/* ──────────────────────────────────────────────────────────────
   AURUM — Sticky glass header
   Tailwind + TypeScript + lucide-react. shadcn/ui ilkeleri:
   dışarıdan className ile ezilebilir, veri prop ile gelir,
   erişilebilirlik öznitelikleri elle verilir.
   ────────────────────────────────────────────────────────────── */

/** shadcn/ui'deki `cn` yardımcısının bağımlılıksız sürümü. */
function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

export interface NavItem {
  label: string
  href: string
  /** Varsa açılır alt menü olarak render edilir. */
  children?: NavItem[]
}

export interface HeaderProps {
  brand?: string
  items?: NavItem[]
  phone?: string
  ctaLabel?: string
  ctaHref?: string
  className?: string
}

/* Varsayılan menü: tek sayfa bölümlerine gider.
   Çok sayfalı bir uygulamada items prop'u ile
   { href: "/odalar" } gibi yollar verilebilir. */
const DEFAULT_ITEMS: NavItem[] = [
  { label: "Anasayfa", href: "#hero" },
  { label: "Hakkımızda", href: "#heritage" },
  { label: "Odalar", href: "#suites" },
  {
    label: "Galeri",
    href: "#gallery",
    children: [
      { label: "İç Mekan", href: "#gallery" },
      { label: "Dış Mekan", href: "#gallery" },
      { label: "Havuz", href: "#gallery" },
    ],
  },
  { label: "Sıkça Sorulan Sorular", href: "#experiences" },
  { label: "İletişim", href: "#footer" },
]

/* Tema renkleri Tailwind config'e eklenmeden çalışsın diye
   arbitrary value olarak yazıldı (altın #C9A96A, antrasit #070708). */
const LINK_BASE =
  "relative inline-flex items-center gap-1.5 py-2 text-[11px] font-medium uppercase tracking-[0.26em] " +
  "text-white/70 transition-colors hover:text-white focus-visible:text-white " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A96A] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[#070708]"

export function Header({
  brand = "AURUM",
  items = DEFAULT_ITEMS,
  phone = "+90 212 555 01 00",
  ctaLabel = "Hemen Rezervasyon Yap",
  ctaHref = "#booking-form",
  className,
}: HeaderProps) {
  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)

  /* Kaydırınca header koyulaşır */
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* ESC: açık olan her şeyi kapat */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setMobileOpen(false)
      setOpenMenu(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* Mobil menü açıkken arka plan kaymasın.
     body yerine html'e veriliyor: body'yi akıştan çıkarmak
     belge yüksekliğini çökertir ve scroll tabanlı animasyonları bozar. */
  React.useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : ""
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-500",
          scrolled
            ? "border-[#C9A96A]/35 bg-[#070708]/90 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]"
            : "border-white/5 bg-[#070708]/45",
          className,
        )}
      >
        <div className="mx-auto flex min-h-[88px] w-full max-w-[1440px] items-center justify-between gap-6 px-5 md:px-10 lg:px-20">
          {/* Marka */}
          <a
            href="/"
            aria-label={`${brand} — ana sayfa`}
            className="group inline-flex flex-none items-center gap-3"
          >
            <span className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#C9A96A]/35 text-[#C9A96A] transition-colors group-hover:bg-[#C9A96A] group-hover:text-[#0A0A0B]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
                   strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M12 3 21 21H3z" />
                <path d="M8.5 15h7" />
              </svg>
            </span>
            <span className="font-serif text-lg leading-none tracking-[0.24em] text-[#F4F2EE]">
              {brand}
            </span>
          </a>

          {/* Masaüstü menü */}
          <nav aria-label="Ana menü" className="hidden lg:block">
            <ul className="flex items-center gap-4 xl:gap-9">
              {items.map((item) =>
                item.children ? (
                  <li
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setOpenMenu(item.label)}
                    onMouseLeave={() => setOpenMenu(null)}
                  >
                    <button
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={openMenu === item.label}
                      aria-controls={`menu-${item.label}`}
                      onClick={() =>
                        setOpenMenu((cur) => (cur === item.label ? null : item.label))
                      }
                      className={LINK_BASE}
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          openMenu === item.label && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    <div
                      id={`menu-${item.label}`}
                      className={cn(
                        "absolute left-1/2 top-[calc(100%+0.5rem)] min-w-[190px] -translate-x-1/2 rounded-xl",
                        "border border-[#C9A96A]/30 bg-[#101116]/95 p-2 backdrop-blur-lg",
                        "shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)] transition duration-200",
                        openMenu === item.label
                          ? "pointer-events-auto translate-y-0 opacity-100"
                          : "pointer-events-none -translate-y-1.5 opacity-0",
                      )}
                    >
                      {item.children.map((child) => (
                        <a
                          key={child.label}
                          href={child.href}
                          className="block rounded-md px-3.5 py-2.5 text-[13px] tracking-wide text-white/70 transition-colors hover:bg-[#C9A96A]/10 hover:text-[#E3CB96]"
                        >
                          {child.label}
                        </a>
                      ))}
                    </div>
                  </li>
                ) : (
                  <li key={item.label}>
                    <a href={item.href} className={cn(LINK_BASE, "group")}>
                      {item.label}
                      <span className="absolute bottom-0 left-0 h-px w-full origin-right scale-x-0 bg-[#C9A96A] transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
                    </a>
                  </li>
                ),
              )}
            </ul>
          </nav>

          {/* Sağ taraf */}
          <div className="flex flex-none items-center gap-3">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="hidden items-center gap-2 text-[13px] text-white/70 transition-colors hover:text-[#E3CB96] lg:inline-flex"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              <span>{phone}</span>
            </a>

            <a
              href={ctaHref}
              className="hidden items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#6E5624] via-[#C9A96A] to-[#6E5624] bg-[length:200%_auto] px-6 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-[#0A0A0B] shadow-[0_12px_40px_-12px_rgba(201,169,106,0.35)] transition-[background-position,box-shadow] duration-500 hover:bg-right hover:shadow-[0_18px_50px_-12px_rgba(201,169,106,0.5)] lg:inline-flex"
            >
              {ctaLabel}
              <span aria-hidden="true">→</span>
            </a>

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
              className="grid h-[42px] w-[42px] place-items-center rounded-md border border-white/10 text-[#F4F2EE] transition-colors hover:border-[#C9A96A]/35 hover:text-[#E3CB96] lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobil menü — sağdan kayar */}
      <div
        id="mobile-menu"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-0 z-[60] flex flex-col bg-[#070708]/97 px-5 pb-10 pt-28 backdrop-blur-xl",
          "transition-transform duration-500 [transition-timing-function:cubic-bezier(0.76,0,0.24,1)] lg:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <ul className="flex flex-col overflow-y-auto">
          {items.map((item) =>
            item.children ? (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu((cur) => (cur === item.label ? null : item.label))
                  }
                  aria-expanded={openMenu === item.label}
                  className="flex w-full items-center justify-between border-b border-white/[0.08] py-4 font-serif text-xl text-[#F4F2EE] transition-colors hover:text-[#E3CB96]"
                >
                  {item.label}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openMenu === item.label && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-500",
                    openMenu === item.label ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    {item.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="block border-b border-white/[0.04] py-3 pl-4 text-sm tracking-wide text-white/45 transition-colors hover:text-[#E3CB96]"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                </div>
              </li>
            ) : (
              <li key={item.label}>
                <a
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block border-b border-white/[0.08] py-4 font-serif text-xl text-[#F4F2EE] transition-colors hover:text-[#E3CB96]"
                >
                  {item.label}
                </a>
              </li>
            ),
          )}
        </ul>

        <div className="mt-auto flex flex-col gap-4 pt-10">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-2 text-sm text-white/70"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span>{phone}</span>
          </a>
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6E5624] via-[#C9A96A] to-[#6E5624] bg-[length:200%_auto] px-6 py-4 text-[13px] font-medium uppercase tracking-[0.08em] text-[#0A0A0B] transition-[background-position] duration-500 hover:bg-right"
          >
            {ctaLabel}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </>
  )
}

export default Header
