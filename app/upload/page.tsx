"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResourceUploadPortal from "@/components/ResourceUploadPortal";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/upload");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-sm text-slate-500">Loading contribution portal...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Student Profile</span>
          </Link>
        </div>

        <ResourceUploadPortal
          userDepartment={user.department}
          userLevel={user.level}
          onSuccess={() => {
            router.push("/profile");
          }}
          onViewSubmissions={() => {
            router.push("/profile");
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
