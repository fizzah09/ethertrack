import fetch from "node-fetch";

/**
 * SOURCE: your own Ponder indexer (see /ponder-indexer).
 * This queries the custom API endpoint Ponder exposes for wallets you've
 * configured it to continuously index (ponder-indexer/.env TRACKED_WALLETS).
 * If the address being graphed isn't one of your tracked wallets, or the
 * Ponder service isn't running, this returns [] and the graph falls back
 * to Etherscan-only data — it never blocks the request.
 */
const PONDER_API_URL = process.env.PONDER_API_URL; // e.g. http://localhost:42069

export async function fetchPonderTxs(address) {
  if (!PONDER_API_URL) return [];

  try {
    const res = await fetch(`${PONDER_API_URL}/transactions/${address}`, { timeout: 3000 });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.transactions || []).map((tx) => ({
      hash: tx.hash,
      from: tx.from?.toLowerCase(),
      to: tx.to?.toLowerCase(),
      valueEth: Number(tx.valueWei) / 1e18,
      timestamp: Number(tx.timestamp),
      isError: false,
      source: "ponder:indexed",
      asset: "ETH",
    }));
  } catch (err) {
    // Ponder service not reachable — fine, just skip this source
    return [];
  }
}
