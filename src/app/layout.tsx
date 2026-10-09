import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BrandThemeProvider from "@/components/BrandThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DarkFlow Manager | Multi-Brand Dark Kitchen Hub",
  description: "Sistema inteligente para la gestión integrada de marcas, pedidos POS, cocinas, reparto y Hub Ejecutivo Móvil.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DarkFlow Hub",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/Logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-100 bg-slate-950`}
      >
        <BrandThemeProvider>
          {children}
        </BrandThemeProvider>
      </body>
    </html>
  );
}
