import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { fetchAllEtherscanTxs } from "./lib/etherscan.js";
import { fetchPonderTxs } from "./lib/ponder.js";
import { fetchTrueBlocksAppearances } from "./lib/trueblocks.js";
import { decodeMethod, shortMethodName } from "./lib/decode.js";
import { lookupLabel, labelCount } from "./lib/labels.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_CHAIN_ID = process.env.DEFAULT_CHAIN_ID || "1";

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor", express.static(path.join(__dirname, "node_modules/vis-network/standalone/umd")));

function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function nodeLabel(address, chainId) {
  const label = chainId === "1" ? lookupLabel(address) : null;
  return label ? label.name : shortenAddress(address);
}

/**
 * Queries the selected chain and only adds optional sources that are
 * configured for Ethereum mainnet.
 */
async function fetchFromAllSources(address, chainId) {
  const isEthereumMainnet = chainId === "1";
  const [etherscanResult, ponderTxs, trueblocksAppearances] = await Promise.all([
    fetchAllEtherscanTxs(address, chainId),
    isEthereumMainnet ? fetchPonderTxs(address) : Promise.resolve([]),
    isEthereumMainnet ? fetchTrueBlocksAppearances(address) : Promise.resolve([]),
  ]);

  const byHash = new Map();
  for (const tx of [...etherscanResult.transactions, ...ponderTxs]) {
    if (!byHash.has(tx.hash)) byHash.set(tx.hash, tx);
  }

  let unresolvedAppearances = 0;
  for (const appearance of trueblocksAppearances) {
    if (byHash.has(appearance.hash)) {
      byHash.get(appearance.hash).confirmedByTrueBlocks = true;
    } else {
      unresolvedAppearances++;
    }
  }

  return {
    transactions: Array.from(byHash.values()),
    unresolvedAppearances,
    errors: etherscanResult.errors,
  };
}

/** Builds a graph exclusively from the selected EVM chain. */
async function buildGraph(rootAddress, { depth = 1, minValueEth = 0, chainId = DEFAULT_CHAIN_ID, decode = false, maxNodes = 150 } = {}) {
  const nodes = new Map();
  const edges = [];
  const edgeKeys = new Set();
  const visited = new Set();
  const queue = [{ address: rootAddress.toLowerCase(), level: 0 }];
  let totalUnresolvedAppearances = 0;
  const sourceErrors = new Set();
  const isEthereumMainnet = chainId === "1";

  nodes.set(rootAddress.toLowerCase(), {
    id: rootAddress.toLowerCase(),
    label: nodeLabel(rootAddress, chainId),
    root: true,
    labelInfo: isEthereumMainnet ? lookupLabel(rootAddress) : null,
  });

  while (queue.length > 0 && nodes.size < maxNodes) {
    const { address, level } = queue.shift();
    if (visited.has(address)) continue;
    visited.add(address);

    const { transactions, unresolvedAppearances, errors } = await fetchFromAllSources(address, chainId);
    totalUnresolvedAppearances += unresolvedAppearances;
    errors.forEach((error) => sourceErrors.add(error));

    for (const tx of transactions) {
      if (!tx.from || !tx.to) continue;
      if (tx.source !== "etherscan:token" && tx.valueEth < minValueEth) continue;

      const counterpart = tx.from === address ? tx.to : tx.from;

      if (!nodes.has(counterpart)) {
        nodes.set(counterpart, {
          id: counterpart,
          label: nodeLabel(counterpart, chainId),
          labelInfo: isEthereumMainnet ? lookupLabel(counterpart) : null,
        });
      }

      const edgeKey = `${tx.hash}:${tx.source}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        edges.push({
          id: edgeKey,
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.valueEth,
          asset: tx.asset,
          timestamp: tx.timestamp,
          isError: tx.isError,
          source: tx.source,
          confirmedByTrueBlocks: tx.confirmedByTrueBlocks || false,
          inputData: tx.inputData,
          method: null,
        });
      }

      if (level < depth && nodes.size < maxNodes) {
        queue.push({ address: counterpart, level: level + 1 });
      }
    }
  }

  if (decode) {
    await Promise.all(
      edges
        .filter((edge) => edge.source === "etherscan:native" && edge.inputData)
        .slice(0, 40)
        .map(async (edge) => {
          const signature = await decodeMethod(edge.inputData);
          edge.method = shortMethodName(signature);
        })
    );
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    meta: {
      rootAddress,
      chainId,
      depth,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      sourceErrors: Array.from(sourceErrors),
      labelsAvailable: isEthereumMainnet ? labelCount() : 0,
      unresolvedTrueBlocksAppearances: totalUnresolvedAppearances,
      sourcesUsed: isEthereumMainnet
        ? ["etherscan", "ponder (if tracked)", "trueblocks (if installed)", "whatsabi (if decode=true)"]
        : ["etherscan"],
    },
  };
}

// --- Routes ---

app.get("/api/graph/:address", async (req, res) => {
  const { address } = req.params;
  const depth = Math.min(parseInt(req.query.depth) || 1, 2);
  const minValueEth = parseFloat(req.query.minValueEth) || 0;
  const chainId = req.query.chainId || DEFAULT_CHAIN_ID;
  const decode = req.query.decode === "true";

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid EVM address" });
  }
  if (!/^\d+$/.test(String(chainId))) {
    return res.status(400).json({ error: "chainId must be a numeric EVM chain ID" });
  }

  try {
    const graph = await buildGraph(address, { depth, minValueEth, chainId, decode });
    res.json(graph);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build graph", details: err.message });
  }
});

app.get("/api/label/:address", (req, res) => {
  res.json({ address: req.params.address, label: lookupLabel(req.params.address) });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", labelsLoaded: labelCount() });
});

app.listen(PORT, () => {
  console.log(`🚀 Wallet graph API running at http://localhost:${PORT}`);
  console.log(`   Sources: Etherscan (always) · Ponder (if PONDER_API_URL set) · TrueBlocks (if chifra installed) · whatsabi (opt-in via ?decode=true)`);
});
