import { onchainTable, index } from "ponder";

export const walletTx = onchainTable(
  "wallet_tx",
  (t) => ({
    id: t.text().primaryKey(), // tx hash + direction, unique per row
    hash: t.hex().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    valueWei: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    direction: t.text().notNull(), // "from" | "to" relative to the tracked wallet
    trackedWallet: t.hex().notNull(),
  }),
  (table) => ({
    trackedWalletIdx: index().on(table.trackedWallet),
    hashIdx: index().on(table.hash),
  })
);
