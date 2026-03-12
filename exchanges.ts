export interface Exchange {
  id: string;
  label: string;
  color: string;
  domain: string;
}

export const ALL_EXCHANGES: Exchange[] = [
  { id: "binance",   label: "Binance",      color: "#F3BA2F", domain: "binance.com"    },
  { id: "bybit",     label: "Bybit",        color: "#F7A600", domain: "bybit.com"      },
  { id: "okx",       label: "OKX",          color: "#2D6AE0", domain: "okx.com"        },
  { id: "coinbase",  label: "Coinbase",     color: "#0052FF", domain: "coinbase.com"   },
  { id: "kraken",    label: "Kraken",       color: "#5741D9", domain: "kraken.com"     },
  { id: "kucoin",    label: "KuCoin",       color: "#00A775", domain: "kucoin.com"     },
  { id: "gateio",    label: "Gate.io",      color: "#E5B34B", domain: "gate.io"        },
  { id: "mexc",      label: "MEXC",         color: "#0E72FC", domain: "mexc.com"       },
  { id: "htx",       label: "HTX",          color: "#2EE7C4", domain: "htx.com"        },
  { id: "bitget",    label: "Bitget",       color: "#00C8FF", domain: "bitget.com"     },
  { id: "phemex",    label: "Phemex",       color: "#0E8AFF", domain: "phemex.com"     },
  { id: "bingx",     label: "BingX",        color: "#1F8EFA", domain: "bingx.com"      },
  { id: "deribit",   label: "Deribit",      color: "#43C3B7", domain: "deribit.com"    },
  { id: "bitstamp",  label: "Bitstamp",     color: "#47A747", domain: "bitstamp.net"   },
  { id: "gemini",    label: "Gemini",       color: "#00DCFA", domain: "gemini.com"     },
  { id: "bitfinex",  label: "Bitfinex",     color: "#16B157", domain: "bitfinex.com"   },
  { id: "poloniex",  label: "Poloniex",     color: "#009D60", domain: "poloniex.com"   },
  { id: "bitmex",    label: "BitMEX",       color: "#E6245A", domain: "bitmex.com"     },
  { id: "pionex",    label: "Pionex",       color: "#0090F1", domain: "pionex.com"     },
  { id: "woox",      label: "WOO X",        color: "#B3A3FF", domain: "woo.org"        },
  { id: "cryptocom", label: "Crypto.com",   color: "#002D74", domain: "crypto.com"     },
  { id: "xt",        label: "XT.com",       color: "#0ABFBC", domain: "xt.com"         },
  { id: "coinex",    label: "CoinEx",       color: "#00A0E9", domain: "coinex.com"     },
  { id: "lbank",     label: "LBank",        color: "#E46D3A", domain: "lbank.com"      },
  { id: "ascendex",  label: "AscendEX",     color: "#E31F6A", domain: "ascendex.com"   },
  { id: "bitrue",    label: "Bitrue",       color: "#1E65C8", domain: "bitrue.com"     },
  { id: "deepcoin",  label: "Deepcoin",     color: "#4B55F5", domain: "deepcoin.com"   },
  { id: "hotcoin",   label: "Hotcoin",      color: "#FF5D1C", domain: "hotcoin.com"    },
  { id: "probit",    label: "ProBit",       color: "#4B7BF5", domain: "probit.com"     },
  { id: "digifinex", label: "DigiFinex",    color: "#23C95C", domain: "digifinex.com"  },
];

export function getExchangeFavicon(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function getExchangeById(id: string): Exchange | undefined {
  return ALL_EXCHANGES.find(e => e.id === id);
}
