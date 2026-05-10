import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import PWARegister from "@/components/PWARegister";
import SplashScreen from "@/components/SplashScreen";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "High Fly Pigeons",
  description: "High Fly Pigeons — Love for the Loft",
  manifest: "/manifest.json",
  themeColor: "#1b5e20",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "High Fly",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SplashScreen />
        <LanguageProvider>{children}</LanguageProvider>
        <PWARegister />
      </body>
    </html>
  );
}
