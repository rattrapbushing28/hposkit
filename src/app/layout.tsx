import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HPOSKit — Make Your WooCommerce Plugin HPOS-Compatible",
  description:
    "Upload a WooCommerce plugin zip to instantly scan for HPOS (High-Performance Order Storage) incompatibilities. Auto-patch common issues and download the fixed plugin in seconds.",
  keywords: ["HPOS", "HPOSKit", "WooCommerce", "plugin compatibility", "custom order tables", "WordPress"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  );
}
