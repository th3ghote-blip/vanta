/**
 * Display metadata for symbols.  Mostly used by the picker UI so users see
 * "Bitcoin (BTCUSD)" instead of just "BTCUSD".
 */

export type SymbolCategory = 'Crypto' | 'Forex' | 'Metals' | 'Stocks';

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

  // ── Forex ────────────────────────────────────────────────────────────
  EURUSD: { name: 'Euro / US Dollar',              category: 'Forex' },
  GBPUSD: { name: 'British Pound / US Dollar',     category: 'Forex' },
  USDJPY: { name: 'US Dollar / Japanese Yen',      category: 'Forex' },
  AUDUSD: { name: 'Australian Dollar / US Dollar', category: 'Forex' },
  USDCAD: { name: 'US Dollar / Canadian Dollar',   category: 'Forex' },
  NZDUSD: { name: 'New Zealand Dollar / US Dollar',category: 'Forex' },
  USDCHF: { name: 'US Dollar / Swiss Franc',       category: 'Forex' },
  EURJPY: { name: 'Euro / Japanese Yen',           category: 'Forex' },
  GBPJPY: { name: 'British Pound / Japanese Yen',  category: 'Forex' },
  EURGBP: { name: 'Euro / British Pound',          category: 'Forex' },
  AUDJPY: { name: 'Australian Dollar / Japanese Yen', category: 'Forex' },
  EURCHF: { name: 'Euro / Swiss Franc',            category: 'Forex' },
  GBPCHF: { name: 'British Pound / Swiss Franc',   category: 'Forex' },

  // ── Metals ───────────────────────────────────────────────────────────
  XAUUSD: { name: 'Gold',   category: 'Metals' },
  XAGUSD: { name: 'Silver', category: 'Metals' },

  // ── Stocks ───────────────────────────────────────────────────────────
  AAPL:  { name: 'Apple Inc.',              category: 'Stocks' },
  MSFT:  { name: 'Microsoft Corp.',         category: 'Stocks' },
  TSLA:  { name: 'Tesla, Inc.',             category: 'Stocks' },
  AMZN:  { name: 'Amazon.com, Inc.',        category: 'Stocks' },
  GOOGL: { name: 'Alphabet Inc.',           category: 'Stocks' },
  META:  { name: 'Meta Platforms, Inc.',    category: 'Stocks' },
  NVDA:  { name: 'NVIDIA Corp.',            category: 'Stocks' },
  NFLX:  { name: 'Netflix, Inc.',           category: 'Stocks' },
  AMD:   { name: 'Advanced Micro Devices',  category: 'Stocks' },
  INTC:  { name: 'Intel Corp.',             category: 'Stocks' },
  CRM:   { name: 'Salesforce, Inc.',        category: 'Stocks' },
  ORCL:  { name: 'Oracle Corp.',            category: 'Stocks' },
  IBM:   { name: 'IBM Corp.',               category: 'Stocks' },
  BA:    { name: 'Boeing Co.',              category: 'Stocks' },
  JPM:   { name: 'JPMorgan Chase & Co.',   category: 'Stocks' },
  BAC:   { name: 'Bank of America Corp.',  category: 'Stocks' },
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
export const CATEGORIES: SymbolCategory[] = ['Crypto', 'Forex', 'Metals', 'Stocks'];
