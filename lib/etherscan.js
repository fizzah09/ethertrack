import "dotenv/config";
import fetch from "node-fetch";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 60 });
const API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = "https://api.etherscan.io/v2/api";
const NATIVE_ASSETS = {
  "1": "ETH",
  "10": "ETH",
  "56": "BNB",
  "137": "POL",
  "8453": "ETH",
  "42161": "ETH",
  "11155111": "SepoliaETH",
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function call(params, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached) return { rows: cached, error: null };

  const url = `${BASE_URL}?${new URLSearchParams({ ...params, apikey: API_KEY })}`;

  let data;
  try {
    const res = await fetch(url);
    const text = await res.text();
    data = JSON.parse(text);
  } catch (err) {
    console.error(`Etherscan request failed (${params.action}):`, err.message);
    return { rows: [], error: `${params.action}: ${err.message}` };
  }

  if (data.status !== "1" && data.message !== "No transactions found") {
    const details = typeof data.result === "string" && data.result !== data.message
      ? data.result
      : data.message || data.result;
    console.error(`Etherscan error (${params.action}):`, details);
    return { rows: [], error: `${params.action}: ${details}` };
  }

  const result = Array.isArray(data.result) ? data.result : [];
  cache.set(cacheKey, result);
  await sleep(350); // stay comfortably under the free-tier 3 req/sec limit
  return { rows: result, error: null };
}

/** Native ETH transfers in/out of an address */
export async function fetchNativeTxs(address, chainId) {
  const { rows: txs } = await call(
    { chainid: chainId, module: "account", action: "txlist", address, sort: "desc", page: 1, offset: 100 },
    `native:${chainId}:${address}`
  );
  return txs.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / 1e18,
    timestamp: Number(tx.timeStamp),
    isError: tx.isError === "1",
    source: "etherscan:native",
    asset: NATIVE_ASSETS[chainId] || "native",
    inputData: tx.input,
  }));
}

/** ERC-20 token transfers in/out of an address */
export async function fetchTokenTxs(address, chainId) {
  const { rows: txs } = await call(
    { chainid: chainId, module: "account", action: "tokentx", address, sort: "desc", page: 1, offset: 100 },
    `token:${chainId}:${address}`
  );
  return txs.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / Math.pow(10, Number(tx.tokenDecimal) || 18),
    timestamp: Number(tx.timeStamp),
    isError: false,
    source: "etherscan:token",
    asset: tx.tokenSymbol || "TOKEN",
  }));
}

/** Internal transactions (contract-to-contract value moves, e.g. inside a DEX swap) */
export async function fetchInternalTxs(address, chainId) {
  const { rows: txs } = await call(
    { chainid: chainId, module: "account", action: "txlistinternal", address, sort: "desc", page: 1, offset: 100 },
    `internal:${chainId}:${address}`
  );
  return txs.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / 1e18,
    timestamp: Number(tx.timeStamp),
    isError: tx.isError === "1",
    source: "etherscan:internal",
    asset: NATIVE_ASSETS[chainId] || "native",
  }));
}

/** Pulls all three Etherscan tx types for an address and merges them */
export async function fetchAllEtherscanTxs(address, chainId) {
  const [nativeResult, tokenResult, internalResult] = await Promise.all([
    call(
      { chainid: chainId, module: "account", action: "txlist", address, sort: "desc", page: 1, offset: 100 },
      `native:${chainId}:${address}`
    ),
    call(
      { chainid: chainId, module: "account", action: "tokentx", address, sort: "desc", page: 1, offset: 100 },
      `token:${chainId}:${address}`
    ),
    call(
      { chainid: chainId, module: "account", action: "txlistinternal", address, sort: "desc", page: 1, offset: 100 },
      `internal:${chainId}:${address}`
    ),
  ]);
  const native = nativeResult.rows.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / 1e18,
    timestamp: Number(tx.timeStamp),
    isError: tx.isError === "1",
    source: "etherscan:native",
    asset: NATIVE_ASSETS[chainId] || "native",
    inputData: tx.input,
  }));
  const token = tokenResult.rows.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / Math.pow(10, Number(tx.tokenDecimal) || 18),
    timestamp: Number(tx.timeStamp),
    isError: false,
    source: "etherscan:token",
    asset: tx.tokenSymbol || "TOKEN",
  }));
  const internal = internalResult.rows.map((tx) => ({
    hash: tx.hash,
    from: tx.from?.toLowerCase(),
    to: tx.to?.toLowerCase(),
    valueEth: Number(tx.value) / 1e18,
    timestamp: Number(tx.timeStamp),
    isError: tx.isError === "1",
    source: "etherscan:internal",
    asset: NATIVE_ASSETS[chainId] || "native",
  }));
  return {
    transactions: [...native, ...token, ...internal],
    errors: [nativeResult.error, tokenResult.error, internalResult.error].filter(Boolean),
  };
}
