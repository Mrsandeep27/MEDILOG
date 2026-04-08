import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediFamily - Family Health Record Manager",
  description:
    "India's first offline-first, AI-powered family health record manager. Scan prescriptions, track medicines, and share records with doctors.",
  keywords: [
    "MediFamily", "health records", "medical records", "family health",
    "prescription scanner", "medicine tracker", "health app India",
    "offline health app", "AI prescription", "digital health records",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediFamily",
  },
  openGraph: {
    title: "MediFamily - Family Health Record Manager",
    description: "India's first offline-first, AI-powered family health record manager. Scan prescriptions, track medicines, and share records with doctors.",
    url: "https://medifamily.in",
    siteName: "MediFamily",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "MediFamily - Family Health Record Manager",
    description: "Offline-first AI health record manager for Indian families",
  },
  metadataBase: new URL("https://medifamily.in"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
