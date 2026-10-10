# Wallet Transaction Graph API

Track a wallet's transactions and visualize them as a graph (Arkham-style), merging **four open-source/free data sources**:

| Source | Role | Required? |
|---|---|---|
| **Etherscan** (free API) | Core transaction history for *any* address, on demand | Yes — the only required source |
| **Ponder** (open source, self-hosted) | Continuously-indexed, decoded data for wallets you track long-term | Optional |
| **TrueBlocks** (open source, local) | Confirms every on-chain appearance of an address, catching what Etherscan misses | Optional |
| **whatsabi** (open source library) | Decodes what a transaction *did* ("Swap", "Approve") from raw calldata | Optional, opt-in per request |

Labels (turning `0xAb5...` into "Binance: Hot Wallet") come from the **etherscan-labels** open dataset (~30,000 addresses), bundled in `data/labels-ethereum.json`.

Every optional source degrades gracefully — if it isn't set up, it's silently skipped and you still get a working graph from Etherscan alone.

---

## 1. Core setup (required)

```bash
cd wallet-graph-api
npm install
cp .env.example .env
```

Get a free key at https://etherscan.io/register, paste it into `.env`:
```
ETHERSCAN_API_KEY=your_key_here
```

Run it:
```bash
npm start
```

Open **http://localhost:3000**, paste a wallet address, click **Build Graph**. This alone gives you native ETH + ERC-20 + internal transactions, merged, with labels applied where known.

---

## 2. Adding TrueBlocks (local, no API key)

TrueBlocks builds a complete local index of every appearance of an address across the whole chain — including appearances inside *other people's* transactions (e.g. as a log topic) that Etherscan's `txlist` never shows.

1. Install the `chifra` CLI: https://trueblocks.io/npm /install/install-core/
2. Run a one-time scrape for your chain (this can take a while and needs disk space):
   ```bash
   chifra init
   chifra scrape
   ```
3. That's it — `lib/trueblocks.js` auto-detects `chifra` on your `PATH`. When present, the graph response's `meta.unresolvedTrueBlocksAppearances` tells you how many on-chain appearances TrueBlocks found that aren't yet represented as graph edges (a good signal of "there's more here than Etherscan shows you").

No `chifra` installed? The app runs fine without it — you'll just see a one-line log message and this source contributes nothing.

---

## 3. Adding Ponder (continuous indexing for wallets you track)

**Important distinction:** Etherscan answers "show me this address's history" for *any* address, on demand. Ponder instead continuously indexes a **pre-configured list** of wallets into your own Postgres database as new blocks arrive — better data quality (no rate limits, fully your own), but only for wallets you've told it to watch in advance.

Use this for wallets you follow on an ongoing basis (e.g. ones flagged as suspicious, or ones your users track long-term).

```bash
cd ponder-indexer
npm install
cp .env.example .env
```

Edit `.env`:
```
PONDER_RPC_URL_1=https://eth.llamarpc.com      # or any free/paid RPC endpoint
TRACKED_WALLETS=0xWallet1,0xWallet2            # wallets to continuously index
START_BLOCK=19000000                            # roughly when they became active
```

Run the indexer (separate process, keeps running):
```bash
npm run dev
```

It serves an API at `http://localhost:42069`. Point the main app at it by adding to the **main project's** `.env`:
```
PONDER_API_URL=http://localhost:42069
```

Now, whenever you graph a wallet that's in `TRACKED_WALLETS`, its edges get tagged `source: "ponder:indexed"` and merged in alongside Etherscan's.

---

## 4. Using whatsabi (decode what a transaction did)

No setup needed — it's built in and opt-in per request. Add `?decode=true` to the graph endpoint, or check **"Decode methods"** in the UI:

```
GET /api/graph/0xabc...?depth=1&decode=true
```

This resolves each transaction's calldata selector (first 4 bytes of `input`) to a human-readable method name like `swap` or `approve`, using whatsabi's open signature database — even for unverified contracts. It's capped to the first 40 native transactions per request to keep response times reasonable, and any lookup failure just leaves `method: null` rather than breaking the request.

---

## How the merge works (`server.js`)

For each address expanded in the graph:
1. `lib/etherscan.js` fetches native + token + internal transactions (always).
2. `lib/ponder.js` fetches pre-indexed transactions, if `PONDER_API_URL` is set and this address is tracked (else `[]`).
3. `lib/trueblocks.js` fetches confirmed on-chain appearances, if `chifra` is installed (else `[]`).
4. All transactions are merged and de-duplicated by hash.
5. `lib/labels.js` attaches a known name/tags to every node, from the bundled open dataset.
6. If `decode=true`, `lib/decode.js` resolves method names for native transactions via whatsabi.

## Extending further

- **Multi-chain labels**: `data/labels-ethereum.json` is just the Ethereum slice of the etherscan-labels dataset. The same repo has `bscscan`, `arbiscan`, `polygonscan`, etc. — copy the matching `combinedAllLabels.json` into `data/` and load it based on `chainId` in `lib/labels.js`.
- **TrueBlocks full edges**: right now TrueBlocks only *confirms* appearances already found by Etherscan/Ponder. To turn its unresolved appearances into full graph edges, fetch each tx's details via `chifra export` or an RPC call once you have the hash.
- **More Ponder contracts**: `ponder-indexer/ponder.config.ts` currently indexes native transactions via the `accounts` field. Add a `contracts` entry (see Ponder's docs on the `contracts` field) to also index ERC-20 `Transfer` events for specific tokens you care about.

## Deploy

- **Main API**: Render/Railway/Fly.io free tier — build `npm install`, start `npm start`, set `ETHERSCAN_API_KEY` (and `PONDER_API_URL` if using Ponder).
- **Ponder indexer**: needs a persistent Postgres database and a long-running process — Railway or a small VPS work well; see https://ponder.sh/docs/production/deploy.
- **TrueBlocks**: local-only by design (it's building a local index) — not something you deploy to a serverless host; run it on your own machine or a VPS with disk space.
