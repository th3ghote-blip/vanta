/**
 * Display metadata for symbols.  Mostly used by the picker UI so users see
 * "Bitcoin (BTCUSD)" instead of just "BTCUSD".
 */

export type SymbolCategory =
  | 'Crypto'
  | 'Forex'
  | 'Metals'
  | 'Commodities'
  | 'Indices'
  | 'Stocks';

export interface SymbolMeta {
  ticker: string;
  name: string;
  category: SymbolCategory;
}

const META: Record<string, Omit<SymbolMeta, 'ticker'>> = {
  // ── Crypto ──────────────────────────────────────────────────────────
  BTCUSD:    { name: 'Bitcoin',               category: 'Crypto' },
  ETHUSD:    { name: 'Ethereum',              category: 'Crypto' },
  SOLUSD:    { name: 'Solana',                category: 'Crypto' },
  XRPUSD:    { name: 'XRP',                   category: 'Crypto' },
  DOGEUSD:   { name: 'Dogecoin',              category: 'Crypto' },
  ADAUSD:    { name: 'Cardano',               category: 'Crypto' },
  AVAXUSD:   { name: 'Avalanche',             category: 'Crypto' },
  LINKUSD:   { name: 'Chainlink',             category: 'Crypto' },
  DOTUSD:    { name: 'Polkadot',              category: 'Crypto' },
  MATICUSD:  { name: 'Polygon',               category: 'Crypto' },
  SHIBUSD:   { name: 'Shiba Inu',             category: 'Crypto' },
  LTCUSD:    { name: 'Litecoin',              category: 'Crypto' },
  UNIUSD:    { name: 'Uniswap',               category: 'Crypto' },
  ATOMUSD:   { name: 'Cosmos',                category: 'Crypto' },
  NEARUSD:   { name: 'NEAR Protocol',         category: 'Crypto' },
  APTUSD:    { name: 'Aptos',                 category: 'Crypto' },
  ARBUSD:    { name: 'Arbitrum',              category: 'Crypto' },
  OPUSD:     { name: 'Optimism',              category: 'Crypto' },
  FILUSD:    { name: 'Filecoin',              category: 'Crypto' },
  ICPUSD:    { name: 'Internet Computer',     category: 'Crypto' },
  INJUSD:    { name: 'Injective',             category: 'Crypto' },
  SUIUSD:    { name: 'Sui',                   category: 'Crypto' },
  TIAUSD:    { name: 'Celestia',              category: 'Crypto' },
  SEIUSD:    { name: 'Sei',                   category: 'Crypto' },
  ETCUSD:    { name: 'Ethereum Classic',      category: 'Crypto' },
  BCHUSD:    { name: 'Bitcoin Cash',          category: 'Crypto' },
  STXUSD:    { name: 'Stacks',                category: 'Crypto' },
  RNDRUSD:   { name: 'Render',                category: 'Crypto' },
  PEPEUSD:   { name: 'Pepe',                  category: 'Crypto' },
  WIFUSD:    { name: 'dogwifhat',             category: 'Crypto' },
  BONKUSD:   { name: 'Bonk',                  category: 'Crypto' },
  JUPUSD:    { name: 'Jupiter',               category: 'Crypto' },
  PYTHUSD:   { name: 'Pyth Network',          category: 'Crypto' },
  WLDUSD:    { name: 'Worldcoin',             category: 'Crypto' },
  AAVEUSD:   { name: 'Aave',                  category: 'Crypto' },
  MKRUSD:    { name: 'Maker',                 category: 'Crypto' },
  SNXUSD:    { name: 'Synthetix',             category: 'Crypto' },
  CRVUSD:    { name: 'Curve DAO',             category: 'Crypto' },
  COMPUSD:   { name: 'Compound',              category: 'Crypto' },
  LDOUSD:    { name: 'Lido DAO',              category: 'Crypto' },
  PENDLEUSD: { name: 'Pendle',                category: 'Crypto' },
  ENAUSD:    { name: 'Ethena',                category: 'Crypto' },
  SANDUSD:   { name: 'The Sandbox',           category: 'Crypto' },
  AXSUSD:    { name: 'Axie Infinity',         category: 'Crypto' },
  MANAUSD:   { name: 'Decentraland',          category: 'Crypto' },
  APEUSD:    { name: 'ApeCoin',               category: 'Crypto' },
  GALAUSD:   { name: 'Gala',                  category: 'Crypto' },

  // ── Crypto — Tier 2 (added T.17) ────────────────────────────────────
  ALGOUSD:   { name: 'Algorand',              category: 'Crypto' },
  XLMUSD:    { name: 'Stellar',               category: 'Crypto' },
  HBARUSD:   { name: 'Hedera',                category: 'Crypto' },
  FLOWUSD:   { name: 'Flow',                  category: 'Crypto' },
  EOSUSD:    { name: 'EOS',                   category: 'Crypto' },
  XTZUSD:    { name: 'Tezos',                 category: 'Crypto' },
  BATUSD:    { name: 'Basic Attention Token', category: 'Crypto' },
  ZECUSD:    { name: 'Zcash',                 category: 'Crypto' },
  ZRXUSD:    { name: '0x Protocol',           category: 'Crypto' },
  LRCUSD:    { name: 'Loopring',              category: 'Crypto' },
  ANKRUSD:   { name: 'Ankr',                  category: 'Crypto' },
  IOTXUSD:   { name: 'IoTeX',                 category: 'Crypto' },
  SKLUSD:    { name: 'SKALE Network',         category: 'Crypto' },
  GRTUSD:    { name: 'The Graph',             category: 'Crypto' },
  IMXUSD:    { name: 'Immutable X',           category: 'Crypto' },
  FETUSD:    { name: 'Fetch.ai',              category: 'Crypto' },
  TAOUSD:    { name: 'Bittensor',             category: 'Crypto' },
  ONDOUSD:   { name: 'Ondo Finance',          category: 'Crypto' },
  KASUSD:    { name: 'Kaspa',                 category: 'Crypto' },
  RPLUSD:    { name: 'Rocket Pool',           category: 'Crypto' },
  ENSUSD:    { name: 'ENS',                   category: 'Crypto' },
  DYDXUSD:   { name: 'dYdX',                  category: 'Crypto' },
  CVXUSD:    { name: 'Convex Finance',        category: 'Crypto' },
  BLURUSD:   { name: 'Blur',                  category: 'Crypto' },
  KAVAUSD:   { name: 'Kava',                  category: 'Crypto' },
  ARUSD:     { name: 'Arweave',               category: 'Crypto' },
  NMRUSD:    { name: 'Numeraire',             category: 'Crypto' },
  JASMYUSD:  { name: 'JasmyCoin',             category: 'Crypto' },
  SUPERUSD:  { name: 'SuperVerse',            category: 'Crypto' },
  QNTUSD:    { name: 'Quant',                 category: 'Crypto' },
  CTSIUSD:   { name: 'Cartesi',               category: 'Crypto' },
  ASTRUSD:   { name: 'Astar',                 category: 'Crypto' },
  CHZUSD:    { name: 'Chiliz',                category: 'Crypto' },


  // ── Metals ──────────────────────────────────────────────────────────
  // PAXG (Paxos Gold) — 1 token = 1 troy oz gold, real-time via Coinbase.
  // The only metal usable on 5s/30s rounds (sub-second feed).
  PAXGUSD:  { name: 'Gold (PAXG, real-time)', category: 'Metals' },
  // Yahoo futures (~10s delayed → 60s+ rounds only)
  XAUUSD:   { name: 'Gold',                   category: 'Metals' },
  XAGUSD:   { name: 'Silver',                 category: 'Metals' },
  PLATINUM: { name: 'Platinum',               category: 'Metals' },
  COPPER:   { name: 'Copper',                 category: 'Metals' },

  // ── Commodities (Yahoo futures, ~10s delayed → 60s+ rounds) ─────────
  USOIL:    { name: 'Crude Oil (WTI)',        category: 'Commodities' },
  UKOIL:    { name: 'Crude Oil (Brent)',      category: 'Commodities' },
  NATGAS:   { name: 'Natural Gas',            category: 'Commodities' },

  // ── Forex (Yahoo, real-time) ────────────────────────────────────────
  EURUSD:   { name: 'Euro / US Dollar',       category: 'Forex' },
  GBPUSD:   { name: 'Pound / US Dollar',      category: 'Forex' },
  USDJPY:   { name: 'US Dollar / Yen',        category: 'Forex' },
  AUDUSD:   { name: 'Aussie / US Dollar',     category: 'Forex' },
  USDCAD:   { name: 'US Dollar / Loonie',     category: 'Forex' },
  USDCHF:   { name: 'US Dollar / Franc',      category: 'Forex' },
  NZDUSD:   { name: 'Kiwi / US Dollar',       category: 'Forex' },
  EURGBP:   { name: 'Euro / Pound',           category: 'Forex' },
  EURJPY:   { name: 'Euro / Yen',             category: 'Forex' },
  GBPJPY:   { name: 'Pound / Yen',            category: 'Forex' },

  // ── Indices (Yahoo, real-time) ──────────────────────────────────────
  SPX500:   { name: 'S&P 500',                category: 'Indices' },
  NAS100:   { name: 'Nasdaq Composite',       category: 'Indices' },
  US30:     { name: 'Dow Jones 30',           category: 'Indices' },

  // ── Stocks (Yahoo, real-time) ───────────────────────────────────────
  AAPL:     { name: 'Apple',                  category: 'Stocks' },
  MSFT:     { name: 'Microsoft',              category: 'Stocks' },
  TSLA:     { name: 'Tesla',                  category: 'Stocks' },
  AMZN:     { name: 'Amazon',                 category: 'Stocks' },
  GOOGL:    { name: 'Alphabet',               category: 'Stocks' },
  META:     { name: 'Meta Platforms',         category: 'Stocks' },
  NVDA:     { name: 'Nvidia',                 category: 'Stocks' },
  NFLX:     { name: 'Netflix',                category: 'Stocks' },
  AMD:      { name: 'AMD',                     category: 'Stocks' },

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

/** Ordered category list — Crypto first (most used in Quick mode). */
export const CATEGORIES: SymbolCategory[] = [
  'Crypto', 'Forex', 'Metals', 'Commodities', 'Indices', 'Stocks',
];

/**
 * Symbols backed by a sub-second real-time feed (Coinbase crypto + PAXG).
 * Only these are eligible for ultra-short 5s / 30s rounds — Yahoo-backed
 * assets (forex/indices/stocks at 5s poll, futures ~10s delayed) would make
 * those durations a coin-flip on stale data.
 */
export function isRealtimeSymbol(ticker: string): boolean {
  return symbolMeta(ticker).category === 'Crypto' || ticker === 'PAXGUSD';
}
