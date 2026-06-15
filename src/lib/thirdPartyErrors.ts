export const THIRD_PARTY_EXTENSION_ERROR_PATTERNS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "MetaMask",
  "inpage.js",
  "contentscript",
  "Failed to connect to MetaMask",
  "ethereum",
  "web3",
];

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.message}\n${value.stack ?? ""}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const isThirdPartyExtensionError = (input: unknown, filename?: string): boolean => {
  const haystack = `${filename ?? ""}\n${stringifyUnknown(input)}`.toLowerCase();
  return THIRD_PARTY_EXTENSION_ERROR_PATTERNS.some((pattern) =>
    haystack.includes(pattern.toLowerCase())
  );
};

export const installThirdPartyErrorGuards = (): void => {
  // Avoid installing twice (React strict mode / hot reload).
  const w = window as any;
  if (w.__thirdPartyErrorGuardsInstalled) return;
  w.__thirdPartyErrorGuardsInstalled = true;

  // Suppress unhandled promise rejections from extensions
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isThirdPartyExtensionError(event.reason)) {
        console.debug("[Extension Error Suppressed]", event.reason);
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    },
    { capture: true }
  );

  // Suppress synchronous errors from extensions
  window.addEventListener(
    "error",
    (event) => {
      const maybeError = (event as ErrorEvent).error ?? (event as ErrorEvent).message;
      const filename = (event as ErrorEvent).filename;

      if (isThirdPartyExtensionError(maybeError, filename)) {
        console.debug("[Extension Error Suppressed]", maybeError);
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    },
    true
  );

  // Override console.error to suppress extension noise (optional logging)
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const combined = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
    if (isThirdPartyExtensionError(combined) || isThirdPartyExtensionError(args[0])) {
      console.debug("[Extension Console Error Suppressed]", ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
};
