import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import { PokedexHeader } from "@/components/pokedex/pokedex-header";
import { getLocale } from "@/lib/i18n/locale";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Pixel display face — used sparingly for device readouts and the brand mark.
const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pokedex-battle.onrender.com"),
  title: "Pokédex — Gen I–IX",
  description: "Pokédex con todas las generaciones · Full-generation Pokédex powered by PokéAPI",
  openGraph: {
    title: "Pokédex — Gen I–IX",
    description: "Pokédex con todas las generaciones · Full-generation Pokédex powered by PokéAPI",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <head>
        {/* Warms the DNS+TLS handshake before the grid's hundreds of artwork requests. */}
        <link rel="preconnect" href="https://raw.githubusercontent.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable} antialiased`}
      >
        <I18nProvider locale={locale}>
          <PokedexHeader />
          <main className="mx-auto max-w-7xl px-3 py-5 sm:px-5">
            {/* The content lives on the device's LCD screen. */}
            <div className="screen screen-scanlines animate-boot rounded-[26px] p-4 sm:p-6">
              {children}
            </div>
          </main>
          <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-center">
            <p className="readout text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Data · PokéAPI
            </p>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
