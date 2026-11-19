import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { walletsApi, type CardWaitlistStatus, type CardWaitlistType } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

/** BRX Visa cards are "Coming soon": the investor's place on the card waitlist. */
export function useCardWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const status = useQuery<CardWaitlistStatus>({
    queryKey: ["card-waitlist", user?.id ?? null],
    queryFn: () => walletsApi.cardWaitlist(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const join = useMutation({
    mutationFn: (type: CardWaitlistType) => walletsApi.joinCardWaitlist(type),
    onSuccess: (data) => qc.setQueryData(["card-waitlist", user?.id ?? null], data),
  });
  return {
    signedIn: !!user,
    joined: !!status.data?.joined,
    cardType: status.data?.card_type ?? null,
    joinedAt: status.data?.joined_at ?? null,
    join: join.mutateAsync,
    joining: join.isPending,
  };
}
