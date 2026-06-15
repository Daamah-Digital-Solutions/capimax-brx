import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  kycApi,
  walletsApi,
  type ApiError,
  type KycStatus,
  type Wallet as ApiWallet,
} from "@/integrations/api/client";

// Phase 4: the wallet / KYC / transactions hub now talks to the Django API
// (SPEC §3.2 / §3.4) instead of Supabase. The hook's PUBLIC interface and the
// shapes it returns are unchanged so WalletSection renders exactly as before.
type Wallet = ApiWallet;

interface WalletTransaction {
  id: string;
  tx_hash: string;
  tx_type: string;
  amount: number | null;
  token_symbol: string | null;
  status: string;
  block_number: number | null;
  created_at: string;
}

export function useUserWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setKycStatus(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    fetchWalletData();

    // Keep the wallet view fresh in-session: refetch KYC/wallet/transactions when
    // the tab/window regains focus, so a just-completed invest/mint (new tx, newly
    // auto-created wallet) appears without a manual reload.
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchWalletData();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchWalletData() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // KYC status (server always returns a record; "pending" when none).
      const kyc = await kycApi.me();
      setKycStatus(kyc);

      // Wallet — null when not created yet (KYC approval auto-creates it).
      const walletData = await walletsApi.me();
      setWallet(walletData);

      // Transactions — only when a wallet exists. No Supabase realtime; the
      // Django read is a refresh-on-mount / refresh-on-action model.
      if (walletData) {
        const txData = await walletsApi.transactions(walletData.id);
        setTransactions((txData as WalletTransaction[]) || []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching wallet data:", err);
      setError("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  }

  async function createWallet() {
    if (!user) {
      setError("Please log in to create a wallet");
      return { success: false };
    }

    try {
      const created = await walletsApi.create();
      await fetchWalletData();
      return { success: true, wallet: created };
    } catch (err) {
      const message = (err as ApiError)?.message || "Failed to create wallet";
      console.error("Error creating wallet:", err);
      setError(message);
      return { success: false };
    }
  }

  async function submitKyc(personalInfo: Record<string, unknown> = {}) {
    if (!user) {
      setError("Please log in to submit KYC");
      return { success: false };
    }

    try {
      const kyc = await kycApi.submit(personalInfo);
      setKycStatus(kyc);
      await fetchWalletData();
      return { success: true };
    } catch (err) {
      const message = (err as ApiError)?.message || "Failed to submit KYC";
      console.error("Error submitting KYC:", err);
      setError(message);
      return { success: false };
    }
  }

  // Explorer mapping. FIX (Phase 4 #9): our custodial wallets store the network as
  // "bsc-testnet" but the old map only had a "bsc" key, so every link fell back to
  // Etherscan. Map "bsc-testnet" to the BSC Testnet explorer and default to it.
  function getExplorerUrl(address: string, network: string = "bsc-testnet"): string {
    const explorers: Record<string, string> = {
      ethereum: "https://etherscan.io/address/",
      polygon: "https://polygonscan.com/address/",
      bsc: "https://bscscan.com/address/",
      "bsc-testnet": "https://testnet.bscscan.com/address/",
    };
    return `${explorers[network] || explorers["bsc-testnet"]}${address}`;
  }

  function getTxExplorerUrl(txHash: string, network: string = "bsc-testnet"): string {
    const explorers: Record<string, string> = {
      ethereum: "https://etherscan.io/tx/",
      polygon: "https://polygonscan.com/tx/",
      bsc: "https://bscscan.com/tx/",
      "bsc-testnet": "https://testnet.bscscan.com/tx/",
    };
    return `${explorers[network] || explorers["bsc-testnet"]}${txHash}`;
  }

  return {
    wallet,
    kycStatus,
    transactions,
    loading,
    error,
    createWallet,
    submitKyc,
    refreshData: fetchWalletData,
    getExplorerUrl,
    getTxExplorerUrl,
  };
}
