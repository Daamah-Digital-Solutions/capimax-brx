import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { TestingNotice } from "./TestingNotice";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Start closed on mobile, open on desktop (lg ≥ 1024px)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });
  const { isRTL } = useLanguage();

  // Auto-close on mobile resize, auto-open on desktop resize
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TestingNotice />
      <AppSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300",
        isRTL
          ? sidebarOpen ? "lg:mr-72" : "lg:mr-16"
          : sidebarOpen ? "lg:ml-72" : "lg:ml-16"
      )}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
