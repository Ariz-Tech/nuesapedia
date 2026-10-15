import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ValueProposition from "@/components/ValueProposition";
import BrowseDepartments from "@/components/BrowseDepartments";
import RecentResources from "@/components/RecentResources";
import Testimonials from "@/components/Testimonials";
import FaqSection from "@/components/FaqSection";
import CtaBanner from "@/components/CtaBanner";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-sans antialiased text-slate-900">
      {/* 1. Header / Navigation */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <HeroSection />

        {/* 3. Value Proposition / Feature Highlights */}
        <ValueProposition />

        {/* 4. Browse Library by Department Carousel */}
        <BrowseDepartments />

        {/* 5. Recently Added Resources */}
        <RecentResources />

        {/* 6. Student Testimonials */}
        <Testimonials />

        {/* 7. Frequently Asked Questions */}
        <FaqSection />

        {/* 8. Forest Green Call-To-Action Banner */}
        <CtaBanner />
      </main>

      {/* 9. Faculty Footer */}
      <Footer />
    </div>
  );
}
