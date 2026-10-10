import { ponder } from "ponder:registry";
import { walletTx } from "ponder:schema";

// Fires for every transaction SENT by one of the tracked wallets
ponder.on("TrackedWallet:transaction:from", async ({ event, context }) => {
  await context.db.insert(walletTx).values({
    id: `${event.transaction.hash}-from`,
    hash: event.transaction.hash,
    from: event.transaction.from,
    to: event.transaction.to ?? "0x0000000000000000000000000000000000000000",
    valueWei: event.transaction.value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    direction: "from",
    trackedWallet: event.transaction.from,
  }).onConflictDoNothing();
});

// Fires for every transaction RECEIVED by one of the tracked wallets
ponder.on("TrackedWallet:transaction:to", async ({ event, context }) => {
  await context.db.insert(walletTx).values({
    id: `${event.transaction.hash}-to`,
    hash: event.transaction.hash,
    from: event.transaction.from,
    to: event.transaction.to ?? "0x0000000000000000000000000000000000000000",
    valueWei: event.transaction.value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    direction: "to",
    trackedWallet: event.transaction.to ?? "0x0000000000000000000000000000000000000000",
  }).onConflictDoNothing();
});
