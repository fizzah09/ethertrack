import { createConfig } from "ponder";

/**
 * SOURCE: Ponder (https://ponder.sh) — open-source, MIT-licensed TypeScript
 * framework for indexing EVM chain data into your own Postgres database.
 *
 * IMPORTANT — how this differs from the Etherscan integration:
 * Etherscan lets you query the history of *any* address on demand.
 * Ponder instead continuously indexes a *pre-configured* list of
 * addresses/contracts into your own database as new blocks arrive.
 * So this is best used for wallets you track on an ongoing basis
 * (e.g. addresses flagged as suspicious, or ones your users follow),
 * not arbitrary one-off lookups — those should still go through
 * lib/etherscan.js in the main API.
 *
 * Add every wallet you want continuously indexed to TRACKED_WALLETS
 * below (comma-separated in .env), and Ponder will index every native
 * transaction sent or received by each of them, from startBlock onward.
 */

const trackedWallets = (process.env.TRACKED_WALLETS || "")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean) as `0x${string}`[];

if (trackedWallets.length === 0) {
  console.warn("⚠️  No TRACKED_WALLETS set in .env — Ponder will index nothing. See README.");
}

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
    },
  },
  accounts: {
    TrackedWallet: {
      chain: "mainnet",
      address: trackedWallets.length > 0 ? trackedWallets : ["0x0000000000000000000000000000000000dEaD"],
      startBlock: Number(process.env.START_BLOCK) || 19000000,
    },
  },
});
