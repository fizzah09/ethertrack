import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql, client } from "ponder";
import { eq, or } from "ponder";

const app = new Hono();

// Optional: full GraphQL + SQL-over-HTTP, useful while developing
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

// The endpoint the main wallet-graph-api server calls:
// returns every indexed transaction involving a given tracked wallet.
app.get("/transactions/:address", async (c) => {
  const param = c.req.param("address").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(param)) {
    return c.json({ error: "Invalid address" }, 400);
  }
  const address = param as `0x${string}`;

  const rows = await db
    .select()
    .from(schema.walletTx)
    .where(or(eq(schema.walletTx.from, address), eq(schema.walletTx.to, address)));

  return c.json({ address, count: rows.length, transactions: rows });
});

export default app;
