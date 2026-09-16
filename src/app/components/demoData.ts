export type DemoAsset = {
  symbol: string;
  name: string;
  quantity: number;
  price: number; // USD price
  change24h: number; // percent
};

export function getDemoPortfolio() {
  // Deterministic demo portfolio with 6 assets
  const assets: DemoAsset[] = [
    { symbol: "SOL", name: "Solana", quantity: 12.34, price: 28.5, change24h: 2.4 },
    { symbol: "USDC", name: "USD Coin", quantity: 1500, price: 1.0, change24h: 0.0 },
    { symbol: "MNGO", name: "Mango Markets", quantity: 420, price: 0.12, change24h: -4.2 },
    { symbol: "RAY", name: "Raydium", quantity: 210, price: 1.8, change24h: 6.3 },
    { symbol: "STEP", name: "Step Finance", quantity: 55, price: 3.2, change24h: -1.1 },
    { symbol: "SRM", name: "Serum", quantity: 10, price: 4.5, change24h: 12.8 },
  ];

  const assetsWithValue = assets.map((a) => ({ ...a, value: +(a.quantity * a.price).toFixed(2) }));
  const total = +(assetsWithValue.reduce((s, a) => s + a.value, 0)).toFixed(2);

  return {
    assets: assetsWithValue,
    total,
    generatedAt: new Date().toISOString(),
  };
}
