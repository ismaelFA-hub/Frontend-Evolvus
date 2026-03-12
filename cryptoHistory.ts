/**
 * Crypto Search / View History
 *
 * Persists up to MAX_HISTORY recently searched or viewed crypto assets
 * in AsyncStorage so users can quickly return to their most-used coins.
 *
 * Storage key: CRYPTO_HISTORY_KEY
 * Format: JSON array of HistoryEntry[], newest-first
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const CRYPTO_HISTORY_KEY = "@evolvus:cryptoHistory";
export const MAX_HISTORY = 20;

export interface HistoryEntry {
  symbol: string;
  name: string;
  id: string;
  viewedAt: number; // Unix ms timestamp
}

/**
 * Load the current history list (newest first).
 * Returns an empty array on any error.
 */
export async function getCryptoHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CRYPTO_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Record that the user searched/viewed a crypto asset.
 * - Removes any previous entry for the same symbol.
 * - Prepends the new entry.
 * - Trims to MAX_HISTORY.
 */
export async function addCryptoHistory(
  entry: Omit<HistoryEntry, "viewedAt">
): Promise<void> {
  try {
    const current = await getCryptoHistory();
    const deduped = current.filter((e) => e.symbol !== entry.symbol);
    const updated: HistoryEntry[] = [
      { ...entry, viewedAt: Date.now() },
      ...deduped,
    ].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(CRYPTO_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail — history is a non-critical feature
  }
}

/**
 * Remove a single entry from the history by symbol.
 */
export async function removeCryptoHistory(symbol: string): Promise<void> {
  try {
    const current = await getCryptoHistory();
    const updated = current.filter((e) => e.symbol !== symbol);
    await AsyncStorage.setItem(CRYPTO_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

/**
 * Clear the entire history.
 */
export async function clearCryptoHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRYPTO_HISTORY_KEY);
  } catch {
    // Silently fail
  }
}
