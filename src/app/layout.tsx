import type { Metadata } from "next";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const sora = Sora({ 
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Etsmart - Copilote IA pour Etsy",
  description: "Analysez le potentiel de vos produits sur Etsy avec l'IA. Détection concurrents, simulation de ventes, prix optimal et verdict intelligent.",
  keywords: ["Etsy", "dropshipping", "analyse IA", "e-commerce", "AliExpress", "Alibaba", "POD"],
  authors: [{ name: "Etsmart" }],
  openGraph: {
    title: "Etsmart - Copilote IA pour Etsy",
    description: "Sachez AVANT de lancer si un produit peut réussir sur Etsy grâce à l'IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${sora.variable} ${dmSans.variable}`}>
      <body 
        className="antialiased bg-mesh noise"
        style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
