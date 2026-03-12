/**
 * Evolvus Core Quantum — useApiKeys hook
 *
 * React Query CRUD hooks for /api/security/api-keys endpoints.
 * API keys are stored encrypted (AES-256-GCM) on the backend.
 *
 * Exports:
 *   useApiKeys()       — list keys for the authenticated user
 *   useAddApiKey()     — mutation: POST /api/security/api-keys
 *   useUpdateApiKey()  — mutation: PATCH /api/security/api-keys/:id
 *   useDeleteApiKey()  — mutation: DELETE /api/security/api-keys/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./query-client";

export interface RemoteApiKey {
  id: string;
  exchange: string;
  permissions: string[];
  status: "connected" | "error" | "syncing";
  label?: string;
  createdAt: string;
}

const QUERY_KEY = ["api-keys"] as const;

// ── List ──────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery<RemoteApiKey[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security/api-keys");
      if (!res.ok) throw new Error("Failed to load API keys");
      const data = (await res.json()) as { keys: RemoteApiKey[] };
      return data.keys;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

// ── Add ───────────────────────────────────────────────────

export interface AddApiKeyInput {
  exchange: string;
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  permissions: string[];
  label?: string;
}

export function useAddApiKey() {
  const qc = useQueryClient();
  return useMutation<RemoteApiKey, Error, AddApiKeyInput>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/security/api-keys", input);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to add API key");
      return body as RemoteApiKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ── Update ────────────────────────────────────────────────

export interface UpdateApiKeyInput {
  id: string;
  permissions?: string[];
  label?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
}

export function useUpdateApiKey() {
  const qc = useQueryClient();
  return useMutation<RemoteApiKey, Error, UpdateApiKeyInput>({
    mutationFn: async ({ id, ...rest }) => {
      const res = await apiRequest("PATCH", `/api/security/api-keys/${id}`, rest);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to update API key");
      return body as RemoteApiKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ── Delete ────────────────────────────────────────────────

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await apiRequest("DELETE", `/api/security/api-keys/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to delete API key");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
