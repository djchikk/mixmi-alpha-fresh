import type { Metadata } from "next";
import { Inter as Geist, Roboto_Mono as Geist_Mono, Sora, Unbounded } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "sonner";
// No Crate component needed for alpha version

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: "mixmi - Discover • Mix • Create",
  description: "Discover music from around the world. Mix tracks, trade samples, and connect with creators globally.",
  metadataBase: new URL('https://www.mixmi.app'),
  openGraph: {
    title: "mixmi",
    description: "Discover music from around the world. Mix tracks, trade samples, and connect with creators globally.",
    url: "https://www.mixmi.app",
    siteName: "mixmi",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "mixmi - Discover music from around the world",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mixmi",
    description: "Discover music from around the world. Mix tracks, trade samples, and connect with creators globally.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${unbounded.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
