export type MarketWindow = "5m" | "15m";
export type MarketAsset = "btc" | "eth" | "xrp" | "sol" | "doge";

export type Config = {
  TICKER: ("polymarket" | "binance" | "coinbase" | "okx" | "bybit")[];
  MARKET_WINDOW: MarketWindow;
  MARKET_ASSET: MarketAsset;
  PROD: boolean;
  PRIVATE_KEY: string;
  POLY_FUNDER_ADDRESS: string;
  BUILDER_KEY: string;
  BUILDER_SECRET: string;
  BUILDER_PASSPHRASE: string;
};

export const ASSET_TICKER_MAP: Record<
  MarketAsset,
  {
    slugPrefix: string;
    binanceStream: string;
    coinbaseProduct: string;
    polymarketSymbol: string;
    apiSymbol: string;
    okxInstId: string;
    bybitSymbol: string;
  }
> = {
  btc: {
    slugPrefix: "btc",
    binanceStream: "btcusdt",
    coinbaseProduct: "BTC-USD",
    polymarketSymbol: "btc/usd",
    apiSymbol: "BTC",
    okxInstId: "BTC-USD",
    bybitSymbol: "BTCUSDT",
  },
  eth: {
    slugPrefix: "eth",
    binanceStream: "ethusdt",
    coinbaseProduct: "ETH-USD",
    polymarketSymbol: "eth/usd",
    apiSymbol: "ETH",
    okxInstId: "ETH-USD",
    bybitSymbol: "ETHUSDT",
  },
  xrp: {
    slugPrefix: "xrp",
    binanceStream: "xrpusdt",
    coinbaseProduct: "XRP-USD",
    polymarketSymbol: "xrp/usd",
    apiSymbol: "XRP",
    okxInstId: "XRP-USD",
    bybitSymbol: "XRPUSDT",
  },
  sol: {
    slugPrefix: "sol",
    binanceStream: "solusdt",
    coinbaseProduct: "SOL-USD",
    polymarketSymbol: "sol/usd",
    apiSymbol: "SOL",
    okxInstId: "SOL-USD",
    bybitSymbol: "SOLUSDT",
  },
  doge: {
    slugPrefix: "doge",
    binanceStream: "dogeusdt",
    coinbaseProduct: "DOGE-USD",
    polymarketSymbol: "doge/usd",
    apiSymbol: "DOGE",
    okxInstId: "DOGE-USD",
    bybitSymbol: "DOGEUSDT",
  },
};

export class Env {
  private static readonly defaults: Config = {
    TICKER: ["polymarket", "coinbase"],
    MARKET_WINDOW: "5m",
    MARKET_ASSET: "btc",
    PROD: false,
    PRIVATE_KEY: "",
    POLY_FUNDER_ADDRESS: "",
    BUILDER_KEY: "",
    BUILDER_SECRET: "",
    BUILDER_PASSPHRASE: "",
  };

  static get<T extends keyof Config>(key: T): Config[T] {
    const raw = process.env[key];
    const defaultVal = this.defaults[key];

    // No env var set, return default
    if (raw === undefined) return defaultVal;

    // Infer type from default value
    if (typeof defaultVal === "boolean") {
      return (raw === "true") as Config[T];
    }

    if (Array.isArray(defaultVal)) {
      return raw.split(",").map((s) => s.trim()) as Config[T];
    }

    return raw as Config[T];
  }

  static getAssetConfig() {
    const asset = Env.get("MARKET_ASSET");
    const config = ASSET_TICKER_MAP[asset];
    if (!config) {
      throw new Error(
        `Invalid MARKET_ASSET "${asset}". Must be one of: ${Object.keys(ASSET_TICKER_MAP).join(", ")}`,
      );
    }
    return config;
  }

  static getStrategyParams(): AssetStrategyParams {
    const asset = Env.get("MARKET_ASSET");
    return ASSET_STRATEGY_DEFAULTS[asset] ?? ASSET_STRATEGY_DEFAULTS.btc;
  }
}

export interface AssetStrategyParams {
  shares: number;
  minShares: number;
  maxEntryPrice: number;
  maxEntrySeconds: number;
  initialStopDistance: number;
  trailingStopDistance: number;
  minLiquidity: number;
  liquidityFullSize: number;
  certaintyCutoff: number;
}

export const ASSET_STRATEGY_DEFAULTS: Record<MarketAsset, AssetStrategyParams> = {
  btc: {
    shares: 8,
    minShares: 4,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 30,
    liquidityFullSize: 100,
    certaintyCutoff: 0.80,
  },
  eth: {
    shares: 50,
    minShares: 15,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 25,
    liquidityFullSize: 200,
    certaintyCutoff: 0.80,
  },
  sol: {
    shares: 40,
    minShares: 10,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 150,
    certaintyCutoff: 0.80,
  },
  doge: {
    shares: 25,
    minShares: 8,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 80,
    certaintyCutoff: 0.80,
  },
  xrp: {
    shares: 6,
    minShares: 3,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 40,
    certaintyCutoff: 0.80,
  },
};
