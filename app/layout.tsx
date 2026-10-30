import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SavedResourcesProvider } from "@/context/SavedResourcesContext";
import PwaRegistration from "@/components/PwaRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
