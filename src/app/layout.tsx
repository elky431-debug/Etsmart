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
  title: "Etsmart - AI Copilot for Etsy",
  description: "Analyze your products' potential on Etsy with AI. Competitor detection, sales simulation, optimal pricing and intelligent verdict.",
  keywords: ["Etsy", "dropshipping", "AI analysis", "e-commerce", "AliExpress", "Alibaba", "POD"],
  authors: [{ name: "Etsmart" }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: "Etsmart - AI Copilot for Etsy",
    description: "Know BEFORE launching if a product can succeed on Etsy with AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body 
        className="antialiased bg-white"
        style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
