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

export const metadata: Metadata = {
  title: "The NUESA Library — Digital Faculty Library | FUOYE Engineering",
  description:
    "Everything you need to study engineering. Access course materials, textbooks, past questions, videos, and offline downloaded documents for FUOYE engineering courses all in one place.",
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
