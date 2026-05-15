import { PolymarketEarlyBirdClient } from "./engine/client.ts";
const client = new PolymarketEarlyBirdClient();
await client.init();
await client.updateUSDCBalance();
const bal = await client.getUSDCBalance();
console.log(`CLOB balance: $${bal.toFixed(2)}`);
