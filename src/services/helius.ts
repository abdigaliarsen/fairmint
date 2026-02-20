/**
 * Helius service — wraps the Helius SDK for Solana token and wallet data.
 *
 * Uses the Helius DAS (Digital Asset Standard) API for token metadata,
 * token account queries for holder analysis, and transaction history
 * for wallet activity.
 *
 * IMPORTANT: This module must only run server-side (API routes, server
 * components). The HELIUS_API_KEY is never exposed to the client.
 */

import { createHelius, type HeliusClient } from "helius-sdk";
import type {
  Asset,
  TokenAccounts,
} from "helius-sdk/types/das";
import type {
  TransactionForAddressSignature,
} from "helius-sdk/types/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  decimals: number | null;
  supply: number | null;
  /** The update authority / deployer address. */
  updateAuthority: string | null;
  /** Mint authority address, if any. */
  mintAuthority: string | null;
  /** Freeze authority address, if any. */
  freezeAuthority: string | null;
  /** Raw Helius Asset object for further inspection. */
  raw: Asset;
}

export interface TokenHolder {
  /** Wallet address of the holder. */
  owner: string;
  /** Token amount (raw, before decimal adjustment). */
  amount: number;
  /** Percentage of total supply held by this wallet. */
  percentage: number;
}

/** Known Solana DEX program IDs for LP vault detection. */
const DEX_PROGRAMS: Record<string, string> = {
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CLMM",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora DLMM",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eBj6xGaBpnh77SXfQ": "Meteora Pools",
};

export interface LPVault {
  /** DEX name (e.g., "Raydium AMM"). */
  dex: string;
  /** Vault token account owner. */
  owner: string;
  /** Token amount in the vault. */
  amount: number;
  /** Percentage of sampled supply in this vault. */
  percentage: number;
}

export interface HolderAnalysis {
  /** Regular (non-LP) holders. */
  holders: TokenHolder[];
  /** Identified LP vault positions. */
  lpVaults: LPVault[];
  /** Total percentage of supply in LP vaults. */
  lpSupplyPercent: number;
}

export interface WalletTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  status: "success" | "failed";
  memo: string | null;
}

// ---------------------------------------------------------------------------
// Singleton Helius client
// ---------------------------------------------------------------------------

let heliusClient: HeliusClient | null = null;

function getHelius(): HeliusClient {
  if (heliusClient) return heliusClient;

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: HELIUS_API_KEY");
  }

  heliusClient = createHelius({ apiKey });
  return heliusClient;
}

// ---------------------------------------------------------------------------
// getTokenMetadata
// ---------------------------------------------------------------------------

/**
 * Fetch metadata for a single token by its mint address using the Helius
 * DAS `getAsset` endpoint.
 *
 * Returns `null` if the asset is not found or the request fails.
 */
export async function getTokenMetadata(
  mint: string
): Promise<TokenMetadata | null> {
  try {
    const helius = getHelius();
    const asset: Asset = await helius.getAsset({ id: mint });

    if (!asset) return null;

    const metadata = asset.content?.metadata;
    const tokenInfo = asset.token_info;

    // Determine update authority from authorities array
    let updateAuthority: string | null = null;
    if (asset.authorities && asset.authorities.length > 0) {
      const fullAuthority = asset.authorities.find((a) =>
        a.scopes.includes("full" as never)
      );
      updateAuthority = fullAuthority?.address ?? asset.authorities[0].address;
    }

    // Token-2022 metadata extension may also carry the update authority
    if (!updateAuthority && asset.mint_extensions?.metadata?.updateAuthority) {
      updateAuthority = asset.mint_extensions.metadata.updateAuthority;
    }

    return {
      mint: asset.id,
      name: metadata?.name ?? "",
      symbol: metadata?.symbol ?? "",
      description: metadata?.description ?? "",
      image: asset.content?.links?.image ?? null,
      decimals: tokenInfo?.decimals ?? null,
      supply: tokenInfo?.supply ?? null,
      updateAuthority,
      mintAuthority: tokenInfo?.mint_authority ?? null,
      freezeAuthority: tokenInfo?.freeze_authority ?? null,
      raw: asset,
    };
  } catch (error) {
    console.error(`Helius getTokenMetadata failed for ${mint}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getTokenHolders
// ---------------------------------------------------------------------------

/**
 * Fetch the top holders for a given token mint.
 *
 * Uses the Helius DAS `getTokenAccounts` endpoint filtered by mint.
 * Returns holder entries sorted by amount descending, with percentage
 * calculated relative to total supply (if known) or to the sum of
 * returned balances.
 */
export async function getTokenHolders(
  mint: string,
  limit: number = 20
): Promise<TokenHolder[]> {
  try {
    const helius = getHelius();

    const response = await helius.getTokenAccounts({
      mint,
      limit,
    });

    const accounts: TokenAccounts[] = response.token_accounts ?? [];

    if (accounts.length === 0) return [];

    // Calculate total from the returned accounts as a fallback
    const totalAmount = accounts.reduce(
      (sum, acc) => sum + (acc.amount ?? 0),
      0
    );

    if (totalAmount === 0) return [];

    return accounts
      .filter((acc) => acc.owner && (acc.amount ?? 0) > 0)
      .map((acc) => ({
        owner: acc.owner!,
        amount: acc.amount ?? 0,
        percentage: ((acc.amount ?? 0) / totalAmount) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  } catch (error) {
    console.error(`Helius getTokenHolders failed for ${mint}:`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// analyzeHolders
// ---------------------------------------------------------------------------

/**
 * Analyze token holders to separate regular holders from LP vault positions.
 * Identifies accounts owned by known DEX programs.
 */
export function analyzeHolders(holders: TokenHolder[]): HolderAnalysis {
  const lpVaults: LPVault[] = [];
  const regularHolders: TokenHolder[] = [];

  for (const holder of holders) {
    const dex = DEX_PROGRAMS[holder.owner];
    if (dex) {
      lpVaults.push({
        dex,
        owner: holder.owner,
        amount: holder.amount,
        percentage: holder.percentage,
      });
    } else {
      regularHolders.push(holder);
    }
  }

  const lpSupplyPercent = lpVaults.reduce((sum, v) => sum + v.percentage, 0);

  return {
    holders: regularHolders,
    lpVaults,
    lpSupplyPercent,
  };
}

// ---------------------------------------------------------------------------
// getWalletTransactions
// ---------------------------------------------------------------------------

/**
 * Fetch recent transaction signatures for a wallet address.
 *
 * Uses the Helius `getTransactionsForAddress` endpoint which provides
 * paginated transaction history with status info.
 */
export async function getWalletTransactions(
  wallet: string,
  limit: number = 20
): Promise<WalletTransaction[]> {
  try {
    const helius = getHelius();

    const result = await helius.getTransactionsForAddress([
      wallet,
      { limit },
    ]);

    return result.data.map((tx: TransactionForAddressSignature) => ({
      signature: tx.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      status: tx.err === null ? ("success" as const) : ("failed" as const),
      memo: tx.memo,
    }));
  } catch (error) {
    console.error(
      `Helius getWalletTransactions failed for ${wallet}:`,
      error
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// checkHolderConnections — basic Sybil detection
// ---------------------------------------------------------------------------

/**
 * Check if any of the given wallets share recent transaction history.
 *
 * Fetches recent transaction signatures for each wallet and looks for
 * overlapping signatures — meaning two wallets participated in the same
 * on-chain transaction (e.g. direct SOL transfer, funding from the same
 * source). This catches basic Sybil patterns where one entity controls
 * multiple top-holder wallets.
 *
 * Returns the number of wallets that share at least one transaction with
 * another wallet in the set.
 */
export async function checkHolderConnections(
  wallets: string[],
  txLimit: number = 50
): Promise<number> {
  if (wallets.length < 2) return 0;

  // Fetch recent transaction signatures for each wallet in parallel
  const results = await Promise.all(
    wallets.map(async (wallet) => {
      const txs = await getWalletTransactions(wallet, txLimit);
      return {
        wallet,
        signatures: new Set(txs.map((tx) => tx.signature)),
      };
    })
  );

  // Find wallets that share at least one transaction with another top holder
  const connectedWallets = new Set<string>();
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      for (const sig of results[i].signatures) {
        if (results[j].signatures.has(sig)) {
          connectedWallets.add(results[i].wallet);
          connectedWallets.add(results[j].wallet);
          break;
        }
      }
    }
  }

  return connectedWallets.size;
}

// ---------------------------------------------------------------------------
// identifyDeployer
// ---------------------------------------------------------------------------

/**
 * Identify the deployer (update authority) from token metadata.
 *
 * Looks at the Helius Asset's authorities array and mint extension
 * metadata to find the address that has the "full" authority scope
 * or is the update authority for Token-2022 tokens.
 *
 * Returns `null` if no authority can be determined.
 */
export function identifyDeployer(metadata: TokenMetadata): string | null {
  return metadata.updateAuthority;
}
