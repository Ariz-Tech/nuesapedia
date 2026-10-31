import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ValueProposition from "@/components/ValueProposition";
import BrowseDepartments from "@/components/BrowseDepartments";
import RecentResources, { type RecentResourceItem } from "@/components/RecentResources";
import Testimonials from "@/components/Testimonials";
import FaqSection from "@/components/FaqSection";
import CtaBanner from "@/components/CtaBanner";
import Footer from "@/components/Footer";
import { getApprovedResourcesPaginated } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialRecent: RecentResourceItem[] | undefined = undefined;
  try {
    const res = await getApprovedResourcesPaginated({ limit: 4, page: 1 });
    initialRecent = res.resources.map((r) => ({
      id: r.id,
      title: r.title,
      courseCode: r.courseCode,
      department: r.department,
      level: r.level,
      type: r.type,
      medium: r.medium,
      fileSize: r.fileSize,
      youtubeUrl: r.youtubeUrl,
      thumbnailUrl: r.thumbnailUrl,
    }));
  } catch {
    initialRecent = undefined;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-sans antialiased text-slate-900">
      <Navbar />

      <main className="flex-1">
        <HeroSection />
        <ValueProposition />
        <BrowseDepartments />
        <RecentResources initialResources={initialRecent} />
        <Testimonials />
        <FaqSection />
        <CtaBanner />
      </main>

      <Footer />
    </div>
  );
}
