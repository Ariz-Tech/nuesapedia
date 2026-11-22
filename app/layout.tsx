import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SavedResourcesProvider } from "@/context/SavedResourcesContext";
import PwaRegistration from "@/components/PwaRegistration";

const geistSans = localFont({
  src: "./fonts/Geist-Latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const plusJakarta = localFont({
  src: "./fonts/PlusJakartaSans-Latin.woff2",
  variable: "--font-jakarta",
  weight: "600 800",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0C3B2E",
};

function resolveMetadataBase(): URL {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw);
    } catch {
      // Fall through to canonical default
    }
  }
  return new URL("https://nuesalibrary.fuoye.edu.ng");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "The NUESA Library — Digital Faculty Library | FUOYE Engineering",
    template: "%s | The NUESA Library",
  },
  description:
    "Everything you need to study engineering. Access verified lecture notes, past questions, textbooks, video tutorials, and offline study documents for FUOYE Faculty of Engineering.",
  openGraph: {
    type: "website",
    siteName: "The NUESA Library",
    title: "The NUESA Library — Digital Faculty Library | FUOYE Engineering",
    description:
      "Centralized digital engineering library for FUOYE Faculty of Engineering students — lecture notes, past questions, video tutorials, and offline study vault.",
    images: [{ url: "/icons/icon.svg", alt: "The NUESA Library" }],
  },
  twitter: {
    card: "summary",
    title: "The NUESA Library — Digital Faculty Library | FUOYE Engineering",
    description:
      "Access verified lecture notes, past questions, and video tutorials for FUOYE Engineering.",
    images: ["/icons/icon.svg"],
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The NUESA Library",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAFAFA] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
        <AuthProvider>
          <SavedResourcesProvider>
            <PwaRegistration />
            {children}
          </SavedResourcesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
