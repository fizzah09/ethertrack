import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SOURCE: brianleect/etherscan-labels (MIT, open source, community-maintained)
 * https://github.com/brianleect/etherscan-labels
 *
 * ~30,000 labeled addresses (exchanges, protocols, tokens, known contracts)
 * scraped from Etherscan's public label pages. This is what turns
 * "0xAb5..." into "Binance: Hot Wallet" in the graph.
 */
let labelMap = {};

try {
  const raw = fs.readFileSync(path.join(__dirname, "../data/labels-ethereum.json"), "utf-8");
  const parsed = JSON.parse(raw);
  // Normalize keys to lowercase so lookups are case-insensitive
  for (const [addr, info] of Object.entries(parsed)) {
    labelMap[addr.toLowerCase()] = info;
  }
  console.log(`✅ Loaded ${Object.keys(labelMap).length} address labels (etherscan-labels dataset)`);
} catch (err) {
  console.warn("⚠️  Could not load labels dataset:", err.message);
}

/**
 * Look up a known label for an address.
 * @param {string} address
 * @returns {{ name: string, labels: string[] } | null}
 */
export function lookupLabel(address) {
  if (!address) return null;
  return labelMap[address.toLowerCase()] || null;
}

export function labelCount() {
  return Object.keys(labelMap).length;
}
