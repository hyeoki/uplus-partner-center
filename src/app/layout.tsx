import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "U+ 초정밀측위 파트너센터",
  description: "U+ 초정밀측위 서비스 파트너 관리 센터",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${manrope.variable} ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
