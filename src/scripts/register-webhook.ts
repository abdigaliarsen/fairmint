/**
 * One-time script to register a Helius webhook for TOKEN_MINT events.
 *
 * The webhook listens for new token mints on the Metaplex Token Metadata
 * program and POSTs enhanced transaction data to our ingestion endpoint.
 *
 * Usage: npx tsx src/scripts/register-webhook.ts
 *
 * Required env vars:
 *   HELIUS_API_KEY         — Helius API key
 *   NEXTAUTH_URL           — Base URL of the deployed app (e.g. https://tokentrust.app)
 *   HELIUS_WEBHOOK_SECRET  — (optional) Auth header sent with each delivery
 */

import { makeWebhookClient } from "helius-sdk/webhooks/client";

const METAPLEX_METADATA_PROGRAM =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

async function main() {
  const apiKey = process.env.HELIUS_API_KEY;
  const baseUrl = process.env.NEXTAUTH_URL;
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

  if (!apiKey) {
    console.error("Missing HELIUS_API_KEY");
    process.exit(1);
  }
  if (!baseUrl) {
    console.error("Missing NEXTAUTH_URL");
    process.exit(1);
  }

  const webhooks = makeWebhookClient(apiKey);
  const webhookURL = `${baseUrl}/api/ingest/new-tokens`;

  // Check for an existing webhook targeting the same URL
  const existing = await webhooks.getAll();
  console.log(`Found ${existing.length} existing webhook(s)`);

  const alreadyExists = existing.find((w) => w.webhookURL === webhookURL);
  if (alreadyExists) {
    console.log(`Webhook already registered: ${alreadyExists.webhookID}`);
    console.log(`  URL: ${alreadyExists.webhookURL}`);
    return;
  }

  // Register a new enhanced webhook for TOKEN_MINT events
  const webhook = await webhooks.create({
    webhookURL,
    transactionTypes: ["TOKEN_MINT"],
    accountAddresses: [METAPLEX_METADATA_PROGRAM],
    webhookType: "enhanced",
    authHeader: webhookSecret ?? "",
  });

  console.log("Webhook registered successfully!");
  console.log(`  ID:  ${webhook.webhookID}`);
  console.log(`  URL: ${webhook.webhookURL}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
