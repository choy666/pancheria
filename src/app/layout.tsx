import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono, Poppins } from "next/font/google";
import { ConditionalAnalytics } from "@/components/conditional-analytics";
import { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografías de marca del flujo público (tema claro de `(public)`):
// Anton para títulos/precios y Poppins para texto. Se cargan como variables
// y el scope `[data-theme='light']` las aplica vía `--font-heading`/`--font-sans`.
const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panchería - Sistema de gestión",
  description: "Sistema de gestión de stock y ventas para panchería",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${poppins.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConditionalAnalytics />
      </body>
    </html>
  );
}
