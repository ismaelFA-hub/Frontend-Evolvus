/**
 * Evolvus Core Quantum — usePaperTrading hook
 *
 * React Query hooks for the paper trading system.
 * Positions are backed by real-time prices from the priceService.
 *
 * Usage:
 *   const { positions, summary, openPosition, closePosition, reset } = usePaperTrading();
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./query-client";

export interface PaperPosition {
  id: string;
  pair: string;
  symbol: string;
  direction: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  closePrice?: number;
  paperPnl: number;
  paperPnlPercent: number;
  status: "open" | "closed";
  category: "scalp" | "swing" | "position";
  strategyName?: string;
  openedAt: string;
  closedAt?: string;
}

export interface PaperPortfolioSummary {
  virtualBalance: number;
  initialBalance: number;
  totalPnl: number;
  totalPnlPct: number;
  openPositions: number;
}

interface PositionsResponse {
  positions: PaperPosition[];
  summary: PaperPortfolioSummary;
}

const QUERY_KEY = ["paper-positions"] as const;

/** Fetch all paper positions for the authenticated user (polls every 5 s for live PnL). */
export function usePaperTrading() {
  const qc = useQueryClient();

  const query = useQuery<PositionsResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/paper/positions");
      if (!res.ok) throw new Error("Failed to load paper positions");
      return res.json() as Promise<PositionsResponse>;
    },
    refetchInterval: 5_000, // poll every 5 s to get live PnL updates
    staleTime: 4_000,
    retry: 1,
  });

  const openMutation = useMutation<PaperPosition, Error, {
    symbol: string;
    direction: "long" | "short";
    sizeUSDT: number;
    category?: "scalp" | "swing" | "position";
    strategyName?: string;
  }>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/paper/open", input);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to open position");
      return body as PaperPosition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const closeMutation = useMutation<PaperPosition, Error, string>({
    mutationFn: async (positionId) => {
      const res = await apiRequest("DELETE", `/api/paper/close/${positionId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to close position");
      return body as PaperPosition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const resetMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/paper/reset");
      if (!res.ok) throw new Error("Failed to reset portfolio");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    positions: query.data?.positions ?? [],
    summary: query.data?.summary,
    isLoading: query.isLoading,
    error: query.error,
    openPosition: openMutation.mutate,
    openPositionAsync: openMutation.mutateAsync,
    isOpening: openMutation.isPending,
    closePosition: closeMutation.mutate,
    isClosing: closeMutation.isPending,
    resetPortfolio: resetMutation.mutate,
    isResetting: resetMutation.isPending,
  };
}
