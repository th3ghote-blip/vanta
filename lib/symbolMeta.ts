/**
 * Display metadata for symbols.  Mostly used by the picker UI so users see
 * "Bitcoin · BTCUSD" instead of just "BTCUSD".
 */

export type SymbolCategory = 'Forex' | 'Metals' | 'Stocks' | 'Crypto';

export interface SymbolMeta {
  ticker: string;
  name: string;
  category: SymbolCategory;
}

const META: Record<string, Omit<SymbolMeta, 'ticker'>> = {
  // Forex
  EURUSD: { name: 'Euro / US Dollar', category: 'Forex' },
  GBPUSD: { name: 'British Pound / US Dollar', category: 'Forex' },
  USDJPY: { name: 'US Dollar / Japanese Yen', category: 'Forex' },
  AUDUSD: { name: 'Australian Dollar / US Dollar', category: 'Forex' },
  USDCAD: { name: 'US Dollar / Canadian Dollar', category: 'Forex' },

  // Metals
  XAUUSD: { name: 'Gold', category: 'Metals' },

  // Stocks
  AAPL: { name: 'Apple Inc.', category: 'Stocks' },
  TSLA: { name: 'Tesla, Inc.', category: 'Stocks' },
  AMZN: { name: 'Amazon.com, Inc.', category: 'Stocks' },

  // Crypto
  BTCUSD: { name: 'Bitcoin', category: 'Crypto' },
  ETHUSD: { name: 'Ethereum', category: 'Crypto' },
  SOLUSD: { name: 'Solana', category: 'Crypto' },
  XRPUSD: { name: 'XRP', category: 'Crypto' },
  DOGEUSD: { name: 'Dogecoin', category: 'Crypto' },
  ADAUSD: { name: 'Cardano', category: 'Crypto' },
  AVAXUSD: { name: 'Avalanche', category: 'Crypto' },
  LINKUSD: { name: 'Chainlink', category: 'Crypto' },
  DOTUSD: { name: 'Polkadot', category: 'Crypto' },
  MATICUSD: { name: 'Polygon', category: 'Crypto' },
  SHIBUSD: { name: 'Shiba Inu', category: 'Crypto' },
  LTCUSD: { name: 'Litecoin', category: 'Crypto' },
  UNIUSD: { name: 'Uniswap', category: 'Crypto' },
  ATOMUSD: { name: 'Cosmos', category: 'Crypto' },
  NEARUSD: { name: 'NEAR Protocol', category: 'Crypto' },
  APTUSD: { name: 'Aptos', category: 'Crypto' },
  ARBUSD: { name: 'Arbitrum', category: 'Crypto' },
  OPUSD: { name: 'Optimism', category: 'Crypto' },
  FILUSD: { name: 'Filecoin', category: 'Crypto' },
  ICPUSD: { name: 'Internet Computer', category: 'Crypto' },
  INJUSD: { name: 'Injective', category: 'Crypto' },
  SUIUSD: { name: 'Sui', category: 'Crypto' },
  TIAUSD: { name: 'Celestia', category: 'Crypto' },
  SEIUSD: { name: 'Sei', category: 'Crypto' },
  ETCUSD: { name: 'Ethereum Classic', category: 'Crypto' },
  BCHUSD: { name: 'Bitcoin Cash', category: 'Crypto' },
  STXUSD: { name: 'Stacks', category: 'Crypto' },
  RNDRUSD: { name: 'Render', category: 'Crypto' },
  PEPEUSD: { name: 'Pepe', category: 'Crypto' },
  WIFUSD: { name: 'dogwifhat', category: 'Crypto' },
  BONKUSD: { name: 'Bonk', category: 'Crypto' },
  JUPUSD: { name: 'Jupiter', category: 'Crypto' },
  PYTHUSD: { name: 'Pyth Network', category: 'Crypto' },
  WLDUSD: { name: 'Worldcoin', category: 'Crypto' },
  AAVEUSD: { name: 'Aave', category: 'Crypto' },
  MKRUSD: { name: 'Maker', category: 'Crypto' },
  SNXUSD: { name: 'Synthetix', category: 'Crypto' },
  CRVUSD: { name: 'Curve DAO', category: 'Crypto' },
  COMPUSD: { name: 'Compound', category: 'Crypto' },
  LDOUSD: { name: 'Lido DAO', category: 'Crypto' },
  PENDLEUSD: { name: 'Pendle', category: 'Crypto' },
  ENAUSD: { name: 'Ethena', category: 'Crypto' },
  SANDUSD: { name: 'The Sandbox', category: 'Crypto' },
  AXSUSD: { name: 'Axie Infinity', category: 'Crypto' },
  MANAUSD: { name: 'Decentraland', category: 'Crypto' },
  APEUSD: { name: 'ApeCoin', category: 'Crypto' },
  GALAUSD: { name: 'Gala', category: 'Crypto' },
};

export function symbolMeta(ticker: string): SymbolMeta {
  const m = META[ticker];
  return {
    ticker,
    name: m?.name ?? ticker,
    category: m?.category ?? 'Crypto',
  };
}

export function allSymbols(): SymbolMeta[] {
  return Object.entries(META).map(([ticker, m]) => ({ ticker, ...m }));
}

export function symbolsByCategory(category: SymbolCategory): SymbolMeta[] {
  return allSymbols().filter((s) => s.category === category);
}

export const CATEGORIES: SymbolCategory[] = ['Forex', 'Metals', 'Stocks', 'Crypto'];
