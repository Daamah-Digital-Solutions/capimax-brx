import { MainLayout } from "@/components/layout/MainLayout";
import { HeroSection } from "@/components/home/HeroSection";
import { GlobalOwnershipSection } from "@/components/home/GlobalOwnershipSection";
import { FeaturedProperties } from "@/components/home/FeaturedProperties";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { WhyCapimaxBrixSection } from "@/components/home/WhyCapimaxBrixSection";
import { AssetTypesSection } from "@/components/home/AssetTypesSection";
import { ReturnsSection } from "@/components/home/ReturnsSection";
import { OwnerDeveloperSection } from "@/components/home/OwnerDeveloperSection";
import { LiquidityProviderSection } from "@/components/home/LiquidityProviderSection";
import { TrustSection } from "@/components/home/TrustSection";
import { CTASection } from "@/components/home/CTASection";
import { PronovaNovaSection } from "@/components/home/PronovaNovaSection";
import { NotificationsSection } from "@/components/home/NotificationsSection";
import { PlatformDisclaimer } from "@/components/home/PlatformDisclaimer";
import { Footer } from "@/components/home/Footer";

const Index = () => {
  return (
    <MainLayout>
      <HeroSection />
      <GlobalOwnershipSection />
      <FeaturedProperties />
      <AssetTypesSection />
      <ReturnsSection />
      <WhyCapimaxBrixSection />
      <NotificationsSection />
      <PronovaNovaSection />
      <OwnerDeveloperSection />
      <LiquidityProviderSection />
      <TrustSection />
      <CTASection />
      <PlatformDisclaimer />
      <Footer />
    </MainLayout>
  );
};

export default Index;
