import type { QuickTradeWidgetRef } from "@/components/QuickTradeWidget";

export let globalQuickTradeRef: QuickTradeWidgetRef | null = null;

export function setGlobalQuickTradeRef(ref: QuickTradeWidgetRef | null) {
  globalQuickTradeRef = ref;
}
