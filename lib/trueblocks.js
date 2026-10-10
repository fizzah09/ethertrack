import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * SOURCE: TrueBlocks (https://github.com/TrueBlocks/trueblocks-core)
 * Open-source "Unchained Index" — builds a complete, local, trustless
 * index of every appearance of an address across the entire chain
 * (including appearances Etherscan's txlist misses, e.g. as a log topic
 * inside someone else's transaction). Requires the `chifra` binary
 * installed and a local index built (`chifra scrape` / `chifra chunks`)
 * — see README for setup. This integration degrades gracefully if
 * chifra isn't installed: it just returns an empty list.
 */
let chifraAvailable = null;

async function isChifraAvailable() {
  if (chifraAvailable !== null) return chifraAvailable;
  try {
    await execFileAsync("chifra", ["--version"]);
    chifraAvailable = true;
  } catch {
    chifraAvailable = false;
    console.warn("ℹ️  TrueBlocks (chifra) not found on PATH — skipping this data source. See README to enable it.");
  }
  return chifraAvailable;
}

/**
 * Returns every appearance of an address found in the local Unchained Index.
 * Falls back to [] if chifra isn't installed or the address hasn't been indexed.
 */
export async function fetchTrueBlocksAppearances(address) {
  if (!(await isChifraAvailable())) return [];

  try {
    const { stdout } = await execFileAsync("chifra", ["list", address, "--fmt", "json"]);
    const parsed = JSON.parse(stdout);
    const records = parsed?.data || [];

    return records.map((r) => ({
      hash: r.hash,
      blockNumber: r.blockNumber,
      timestamp: r.timestamp,
      source: "trueblocks:appearance",
      // TrueBlocks gives you *that* the address appeared in this tx;
      // the counterpart still needs resolving from tx details if you
      // want it as a graph edge — see README for the full-detail flag.
    }));
  } catch (err) {
    console.error("TrueBlocks lookup failed:", err.message);
    return [];
  }
}
