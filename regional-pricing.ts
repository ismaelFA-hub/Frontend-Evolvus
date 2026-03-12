export type RegionCurrency = "BRL" | "USD";

export interface RegionalPrice {
  currency: RegionCurrency;
  symbol: string;
  free: string;
  pro: string;
  premium: string;
  enterprise: string;
}

const BRL_PRICES: RegionalPrice = {
  currency: "BRL",
  symbol: "R$",
  free: "R$ 0/mês",
  pro: "R$ 197/mês",
  premium: "R$ 497/mês",
  enterprise: "R$ 3.997/mês",
};

const USD_PRICES: RegionalPrice = {
  currency: "USD",
  symbol: "$",
  free: "$0/mo",
  pro: "$79/mo",
  premium: "$197/mo",
  enterprise: "$997/mo",
};

export function detectRegionCurrency(): RegionCurrency {
  try {
    const locale = typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : "";
    if (locale.includes("pt") || locale.includes("BR")) return "BRL";
  } catch {
  }
  return "USD";
}

export function useRegionalPricing(): RegionalPrice {
  const currency = detectRegionCurrency();
  return currency === "BRL" ? BRL_PRICES : USD_PRICES;
}

export function formatRegionalPrice(amount: number, currency: RegionCurrency): string {
  if (currency === "BRL") {
    return `R$ ${amount.toLocaleString("pt-BR")}/mês`;
  }
  return `$${amount}/mo`;
}
