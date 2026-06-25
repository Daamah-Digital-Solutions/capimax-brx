import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import FundedProperties from "./pages/FundedProperties";
import PropertyDetail from "./pages/PropertyDetail";
import Dashboard from "./pages/Dashboard";
import SecondaryMarket from "./pages/SecondaryMarket";
import Auth from "./pages/Auth";
import RegisterRole from "./pages/RegisterRole";
import NotFound from "./pages/NotFound";
import Portfolio from "./pages/Portfolio";
import Wallet from "./pages/Wallet";
import Distributions from "./pages/Distributions";
import Installments from "./pages/Installments";
import OwnerDashboard from "./pages/OwnerDashboard";
import OwnerReports from "./pages/OwnerReports";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import OwnerDocuments from "./pages/OwnerDocuments";
import OwnerWallet from "./pages/OwnerWallet";
import Messages from "./pages/Messages";
import Cards from "./pages/Cards";
import Notifications from "./pages/Notifications";
import Support from "./pages/Support";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import Fees from "./pages/Fees";
import ExitMechanism from "./pages/ExitMechanism";
import Compliance from "./pages/Compliance";
import Settings from "./pages/Settings";
import SubmitProperty from "./pages/SubmitProperty";
import StrategicPartners from "./pages/StrategicPartners";
import Listings from "./pages/Listings";
import BrokerReports from "./pages/BrokerReports";
import Referrals from "./pages/Referrals";
import Commissions from "./pages/Commissions";
import PublicReports from "./pages/PublicReports";
import PublicAnalytics from "./pages/PublicAnalytics";
import Checkout from "./pages/Checkout";
import Partners from "./pages/Partners";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import Disclaimer from "./pages/Disclaimer";
import Disclosure from "./pages/Disclosure";
import PlatformRules from "./pages/PlatformRules";
import WhitePaper from "./pages/WhitePaper";
import VerifyCertificate from "./pages/VerifyCertificate";
import LiquidityProvider from "./pages/LiquidityProvider";
import FamilyInvestment from "./pages/FamilyInvestment";
import LPMarket from "./pages/LPMarket";
import Reinvestment from "./pages/Reinvestment";
import Regulation from "./pages/Regulation";
import FAQ from "./pages/FAQ";
import ProductCategory from "./pages/ProductCategory";
import Products from "./pages/Products";
import AuditLog from "./pages/AuditLog";
import ExitsHub from "./pages/ExitsHub";
import InstitutionalPackages from "./pages/InstitutionalPackages";
import DeveloperHub from "./pages/DeveloperHub";
import InvestorRelations from "./pages/InvestorRelations";
import ReferralCapture from "./pages/ReferralCapture";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PWAInstallPrompt />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductCategory />} />
          <Route path="/funded-properties" element={<FundedProperties />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/reinvestment" element={<Reinvestment />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/distributions" element={<Distributions />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/secondary-market" element={<SecondaryMarket />} />
          <Route path="/public-reports" element={<PublicReports />} />
          <Route path="/public-analytics" element={<PublicAnalytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/support" element={<Support />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/register" element={<RegisterRole />} />
          {/* Broker referral landing (Phase 12 Wave A): stash code → registration. */}
          <Route path="/ref/:code" element={<ReferralCapture />} />
          <Route path="/my-assets" element={<OwnerDashboard />} />
          <Route path="/owner-reports" element={<OwnerReports />} />
          <Route path="/owner-wallet" element={<OwnerWallet />} />
          <Route path="/owner-documents" element={<OwnerDocuments />} />
          {/* Owner-only nav item — honest "Coming soon" placeholder (no messaging backend yet). */}
          <Route path="/messages" element={<Messages />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/asset-validation" element={<OwnerReports />} />
          <Route path="/submit-property" element={<SubmitProperty />} />
          {/* The broker hub now lives in the real Listings/Referrals/Commissions pages.
              Redirect the orphan /broker-dashboard (kept off-nav) to Listings — no dead
              route, no 404 for old links/notifications that pointed here. */}
          <Route path="/broker-dashboard" element={<Navigate to="/listings" replace />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/commissions" element={<Commissions />} />
          {/* Broker-only nav item — real commission/per-property reports (was a broken link). */}
          <Route path="/broker-reports" element={<BrokerReports />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/exit-mechanism" element={<ExitMechanism />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/regulation" element={<Regulation />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/strategic-partners" element={<StrategicPartners />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/disclosure" element={<Disclosure />} />
          <Route path="/platform-rules" element={<PlatformRules />} />
          <Route path="/white-paper" element={<WhitePaper />} />
          <Route path="/verify/:code" element={<VerifyCertificate />} />
          <Route path="/liquidity-provider" element={<LiquidityProvider />} />
          <Route path="/family-investment" element={<FamilyInvestment />} />
          <Route path="/lp-market" element={<LPMarket />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/exits-hub" element={<ExitsHub />} />
          <Route path="/institutional" element={<InstitutionalPackages />} />
          <Route path="/developers" element={<DeveloperHub />} />
          <Route path="/investor-relations" element={<InvestorRelations />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

