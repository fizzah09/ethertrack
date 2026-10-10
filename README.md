# EtherTrack: Wallet Transaction Graph API

EtherTrack builds a graph of addresses connected to an EVM wallet. It fetches transactions from Etherscan for the selected network and can optionally add Ethereum-only Ponder and TrueBlocks data. The graph UI is served by the same Node.js app.

| Source | What it adds | Required? |
|---|---|---|
| Etherscan API | Native coin, ERC-20, and internal transactions | Yes |
| Bundled Etherscan labels | Names for known Ethereum addresses | No |
| Ponder | Transactions from wallets you continuously index | No |
| TrueBlocks | Additional on-chain appearance confirmations | No |
| whatsabi | Best-effort method decoding from transaction calldata | No |

## Quick Start

### Requirements

- Git
- Node.js 20 or newer with npm
- An Etherscan API key from https://etherscan.io/register

### Windows PowerShell

```powershell
git clone https://github.com/fizzah09/ethertrack.git
cd ethertrack
npm install
Copy-Item .env.example .env
```

Open `.env` in an editor and set `ETHERSCAN_API_KEY` to your key. Then start the app:

```powershell
npm start
```

### macOS or Linux

```bash
git clone https://github.com/fizzah09/ethertrack.git
cd ethertrack
npm install
cp .env.example .env
```

Set `ETHERSCAN_API_KEY` in `.env`, then run:

```bash
npm start
```

Open http://localhost:3000, enter an EVM address, choose a network, and click **Build Graph**. Keep the terminal running while you use the app. `.env` is ignored by Git; do not publish your API key.

## Using The Graph

The network selector includes Ethereum, Polygon, BNB Smart Chain, Arbitrum One, Optimism, Base, Avalanche C-Chain, Gnosis, Linea, Scroll, Fantom, and Sepolia. Each graph request is scoped to the selected chain; graphs from different networks are not combined. Etherscan support and API access for a network can depend on your plan. See [Etherscan's supported chains](https://docs.etherscan.io/etherscan-v2/getting-started/supported-chains).

Addresses must be EVM format: `0x` followed by 40 hexadecimal characters. Bitcoin and Solana addresses are not supported.

- **Depth** controls how many hops from the starting address are expanded. Depth 2 can take longer.
- **Minimum native amount** filters native coin transfers only. Token quantities are not compared to an ETH threshold.
- **Asset filter** shows all transfers, native coin only, or tokens only.
- **Labeled addresses** limits the graph to transfers connected to labeled nodes. The bundled labels currently cover Ethereum only.
- **Max tx** limits visible transactions to the most recent results.
- **Decode methods** optionally asks whatsabi to identify methods from native transaction calldata.

The API is also available directly, for example:

```text
GET http://localhost:3000/api/graph/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1&depth=1
```

## Troubleshooting

- **Etherscan `NOTOK` or API warning:** Check that `.env` contains a valid key, restart the server after editing it, and verify that your Etherscan plan allows the selected chain. The graph may be partial if one history endpoint fails.
- **Port 3000 is already in use:** Stop the other server, or set another port in `.env`, such as `PORT=3001`, and open that port in the browser.
- **`chifra` not found:** The main app can run without TrueBlocks. If using TrueBlocks on Windows, the app must also run inside WSL so Node can find the Linux `chifra` binary.

## Optional: Ponder

Ponder continuously indexes configured wallets; unlike Etherscan, it does not answer on-demand queries for arbitrary wallets. This integration is for Ethereum mainnet.

In a second terminal, from the project root:

```bash
cd ponder-indexer
npm install
```

Copy `ponder-indexer/.env.example` to `.env` in that folder (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in Bash). Edit the file to set `PONDER_RPC_URL_1`, `TRACKED_WALLETS`, and `START_BLOCK`, then start the indexer:

```bash
npm run dev
```

The indexer API runs at `http://localhost:42069`. In the main project's `.env`, set `PONDER_API_URL=http://localhost:42069` and restart the main app.

## Optional: TrueBlocks

TrueBlocks' `chifra` CLI supports Linux and macOS, not native Windows. Windows users can install it in WSL; run the Node app in WSL as well because a Windows process cannot find WSL's Linux executable. Follow the [official installation guide](https://trueblocks.io/docs/install/install-core/), then initialize the published index:

```bash
chifra --version
chifra init
```

`chifra init` downloads index filters and retrieves relevant chunks as addresses are queried. `chifra scrape` is not needed for typical use; it builds an index from a suitable local tracing/archive node and can require substantial time and storage. TrueBlocks is only merged for Ethereum mainnet in this app.

## Deployment

- **Main API:** Deploy as a Node.js service and set `ETHERSCAN_API_KEY`. Set `PONDER_API_URL` only when using Ponder.
- **Ponder:** Needs a persistent database and a long-running process. See https://ponder.sh/docs/production/deploy.
- **TrueBlocks:** Needs a persistent Linux machine or WSL environment with its local index; it is not suitable for serverless deployment.
