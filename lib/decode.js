import { loaders } from "@shazow/whatsabi";
import NodeCache from "node-cache";

/**
 * SOURCE: whatsabi (https://github.com/shazow/whatsabi), Paradigm-maintained,
 * open source. Decodes a transaction's method name from its calldata's
 * 4-byte selector using an open signature database (4byte.directory /
 * OpenChain / Samczsun), even for contracts with no verified source.
 * This turns an edge labeled "0x3593564c..." into "Swap" or "Approve".
 */
const selectorCache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // selectors never really change meaning
const sigLookup = loaders.defaultSignatureLookup;

/**
 * Given raw tx input data, return the best-guess method name, e.g. "transfer(address,uint256)".
 * Returns null for plain ETH transfers (no input data) or if lookup fails.
 */
export async function decodeMethod(inputData) {
  if (!inputData || inputData === "0x" || inputData.length < 10) return null;

  const selector = inputData.slice(0, 10);
  const cached = selectorCache.get(selector);
  if (cached !== undefined) return cached;

  try {
    const candidates = await sigLookup.loadFunctions(selector);
    const name = candidates?.[0] || null;
    selectorCache.set(selector, name);
    return name;
  } catch (err) {
    selectorCache.set(selector, null);
    return null;
  }
}

/** Friendly short form, e.g. "transfer(address,uint256)" -> "transfer" */
export function shortMethodName(signature) {
  if (!signature) return null;
  return signature.split("(")[0];
}
