import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PokedexHeader } from "@/components/pokedex/pokedex-header";
import { getLocale } from "@/lib/i18n/locale";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pokédex — Gen I–IX",
  description: "Pokédex con todas las generaciones · Full-generation Pokédex powered by PokéAPI",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider locale={locale}>
          <PokedexHeader />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
