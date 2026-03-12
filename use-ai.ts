/**
 * Evolvus Core Quantum — AI Hooks (Groq Integration)
 *
 * React Query hooks para todos os endpoints de IA do backend.
 * O backend usa Groq (gratuito) → Gemini → fallback local.
 *
 * Hooks disponíveis:
 *   useAIStatus()              → GET  /api/ai/status
 *   useSignalExplanation()     → GET  /api/ai/explain/:symbol
 *   useBrainWeights()          → GET  /api/ai/brain/weights
 *   useShadowAnalysis()        → GET  /api/ai/shadow/analyze
 *   useStrategyGenerate()      → POST /api/ai/strategy/generate
 *   useStrategyEvolve()        → POST /api/ai/strategy/evolve
 *   useBrainFeedback()         → POST /api/ai/brain/weights/feedback
 *   useBrainWeightsReset()     → POST /api/ai/brain/weights/reset
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

// ─── Types ────────────────────────────────────────────────────

export interface AIStatus {
  groqAvailable: boolean;
  geminiAvailable: boolean;
  localFallback: boolean;
  provider: "groq" | "gemini" | "local";
  rateLimitRemaining: number;
  cacheEnabled: boolean;
}

export interface RegimeResult {
  regime: string;
  volatility: string;
  trend: string;
  strength: number;
  confidence: number;
}

export interface AIExplanation {
  symbol: string;
  regime: string;
  signal: string;
  confidence: number;
  explanation: string;
  keyFactors: string[];
  riskWarning: string;
  source: "groq" | "gemini" | "local" | "cache";
  latencyMs: number;
  tokensUsed?: number;
}

export interface SignalExplanationResult {
  symbol: string;
  interval: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  finalScore: number;
  regime: RegimeResult;
  brainSummary: {
    total: number;
    bullish: number;
    bearish: number;
    neutral: number;
  };
  adaptiveWeightsUsed: boolean;
  explanation: AIExplanation;
}

export interface BrainWeightEntry {
  brainId: string;
  weight: number;
  sampleCount: number;
  lastUpdated: number;
}

export interface BrainWeightRanking {
  top: Array<{ brainId: string; weight: number; sampleCount: number }>;
  bottom: Array<{ brainId: string; weight: number; sampleCount: number }>;
}

export interface BrainWeightsResult {
  weights: BrainWeightEntry[];
  ranking: BrainWeightRanking;
  totalTracked: number;
  info: string;
}

export interface ShadowAnalysisResult {
  openCount: number;
  closedCount: number;
  winRate: number;
  avgReturn: number;
  advice: string;
  patterns: string[];
  riskWarnings: string[];
  source: "groq" | "local";
}

export interface StrategyGenerateParams {
  symbol: string;
  interval?: string;
  count?: number;
  initialCapital?: number;
}

export interface StrategyEvolveParams extends StrategyGenerateParams {
  populationSize?: number;
  generations?: number;
}

export interface GeneratedStrategy {
  name: string;
  score: number;
  brainScoreThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  positionSizePercent: number;
  winRate: number;
  sharpeRatio: number;
  totalReturn: number;
  maxDrawdown: number;
}

export interface StrategyLabResult {
  symbol: string;
  strategies: GeneratedStrategy[];
  champion: GeneratedStrategy;
  generatedAt: number;
}

export interface WeightFeedback {
  brainId: string;
  wasCorrect: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────

/** Status da conexão com Groq/Gemini/local */
export function useAIStatus() {
  return useQuery<AIStatus>({
    queryKey: ["/api/ai/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/status");
      return res.json() as Promise<AIStatus>;
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Pipeline completo: OHLCV → 29 microcérebros → regime → Groq explanation.
 * Respeita o rate limit do Groq com staleTime de 3 minutos.
 */
export function useSignalExplanation(
  symbol: string,
  opts?: { enabled?: boolean; interval?: string }
) {
  const enabled = opts?.enabled ?? (typeof symbol === "string" && symbol.length >= 2);
  const interval = opts?.interval ?? "1h";
  return useQuery<SignalExplanationResult>({
    queryKey: ["/api/ai/explain", symbol.toUpperCase(), interval],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/ai/explain/${encodeURIComponent(symbol.toUpperCase())}?interval=${interval}`
      );
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Erro na análise de IA");
      }
      return res.json() as Promise<SignalExplanationResult>;
    },
    enabled,
    staleTime: 3 * 60_000,
    retry: 1,
  });
}

/** Pesos adaptativos dos 29 microcérebros */
export function useBrainWeights() {
  return useQuery<BrainWeightsResult>({
    queryKey: ["/api/ai/brain/weights"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/brain/weights");
      return res.json() as Promise<BrainWeightsResult>;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Shadow Mode Coach: analisa o portfólio paper trading com IA */
export function useShadowAnalysis(enabled: boolean) {
  return useQuery<ShadowAnalysisResult>({
    queryKey: ["/api/ai/shadow/analyze"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/shadow/analyze");
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Erro na análise Shadow");
      }
      return res.json() as Promise<ShadowAnalysisResult>;
    },
    enabled,
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

/** Strategy Lab: gera N estratégias + backtesta + rankeia via IA */
export function useStrategyGenerate() {
  const qc = useQueryClient();
  return useMutation<StrategyLabResult, Error, StrategyGenerateParams>({
    mutationFn: async (params) => {
      const res = await apiRequest("POST", "/api/ai/strategy/generate", params);
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Erro no Strategy Lab");
      }
      return res.json() as Promise<StrategyLabResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/brain/weights"] });
    },
  });
}

/** Genetic Lab: algoritmo genético para evolução de estratégias */
export function useStrategyEvolve() {
  const qc = useQueryClient();
  return useMutation<StrategyLabResult, Error, StrategyEvolveParams>({
    mutationFn: async (params) => {
      const res = await apiRequest("POST", "/api/ai/strategy/evolve", params);
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Erro no Genetic Lab");
      }
      return res.json() as Promise<StrategyLabResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/brain/weights"] });
    },
  });
}

/** Registra acerto/erro por microcérebro após fechar uma operação */
export function useBrainFeedback() {
  const qc = useQueryClient();
  return useMutation<void, Error, WeightFeedback[]>({
    mutationFn: async (feedbacks) => {
      await apiRequest("POST", "/api/ai/brain/weights/feedback", { feedbacks });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/brain/weights"] });
    },
  });
}

/** Reseta todos os pesos dos microcérebros para neutro (1.0) */
export function useBrainWeightsReset() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiRequest("POST", "/api/ai/brain/weights/reset", {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/brain/weights"] });
    },
  });
}
