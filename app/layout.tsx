import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";
import PWARegister from "@/components/PWARegister";


export const metadata: Metadata = {
  title: {
    default: "Royal College — Admin",
    template: "%s | Royal College",
  },

  description:
    "Royal College of Arts and Science administration system",

  applicationName:
    "Royal College",

  manifest: "/manifest.json",

  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Royal College",
  },

  formatDetection: {
    telephone: false,
  },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}