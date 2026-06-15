import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Reinvestment {
  id: string;
  user_id: string;
  source_amount: number;
  discount_percentage: number;
  discount_amount: number;
  net_investment_value: number;
  investment_id: string | null;
  property_id: string;
  property_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReinvestmentInput {
  source_amount: number;
  property_id: string;
  property_name: string;
  discount_percentage?: number;
}

export function useReinvestments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reinvestments, isLoading } = useQuery({
    queryKey: ["reinvestments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("reinvestments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Reinvestment[];
    },
    enabled: !!user?.id,
  });

  const createReinvestment = useMutation({
    mutationFn: async (input: CreateReinvestmentInput) => {
      if (!user?.id) throw new Error("User not authenticated");

      const discountPercentage = input.discount_percentage ?? 5;
      const discountAmount = (input.source_amount * discountPercentage) / 100;
      const netInvestmentValue = input.source_amount + discountAmount;

      const { data, error } = await supabase
        .from("reinvestments")
        .insert({
          user_id: user.id,
          source_amount: input.source_amount,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          net_investment_value: netInvestmentValue,
          property_id: input.property_id,
          property_name: input.property_name,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reinvestments"] });
      toast.success("Reinvestment request created successfully!");
    },
    onError: (error) => {
      console.error("Error creating reinvestment:", error);
      toast.error("Failed to create reinvestment request");
    },
  });

  const totalReinvested = reinvestments?.reduce(
    (sum, r) => sum + (r.status === "completed" ? r.source_amount : 0),
    0
  ) ?? 0;

  const totalBonus = reinvestments?.reduce(
    (sum, r) => sum + (r.status === "completed" ? r.discount_amount : 0),
    0
  ) ?? 0;

  const pendingReinvestments = reinvestments?.filter(r => r.status === "pending") ?? [];

  return {
    reinvestments,
    isLoading,
    createReinvestment,
    totalReinvested,
    totalBonus,
    pendingReinvestments,
  };
}
