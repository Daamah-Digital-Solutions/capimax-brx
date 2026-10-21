import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { installThirdPartyErrorGuards } from "@/lib/thirdPartyErrors";
import { installErrorReporter } from "@/lib/errorReporter";
import { initTheme } from "@/lib/theme";
import "./index.css";

installThirdPartyErrorGuards();
installErrorReporter();
initTheme();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

