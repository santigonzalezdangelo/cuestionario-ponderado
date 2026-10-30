import type { Metadata, Viewport } from "next";
import { Creepster, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const creepster = Creepster({
  variable: "--font-creepster",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Votá el mejor disfraz 🎃",
  description: "Elegí tus 3 disfraces favoritos de la fiesta de Halloween",
};

export const viewport: Viewport = {
  themeColor: "#0f0a17",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${creepster.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
