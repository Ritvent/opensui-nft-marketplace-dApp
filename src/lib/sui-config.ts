// Configuration for Sui network and contract interactions
export const SUI_CONFIG = {
  // Network configuration - Update with your RPC URL
  network: {
    rpcUrl: import.meta.env.VITE_SUI_RPC_URL || "https://fullnode.testnet.sui.io",
    networkType: "testnet" as const,
  },

  // Contract configuration - Update with your deployed package ID
  contracts: {
    packageId: import.meta.env.VITE_NFT_PACKAGE_ID || "0x6a8a82df94142a6889b26f44069c72a7b85db48d0b4545657206e03653ceffe3",
    nftModule: "nft_marketplace",

    // Function names
    functions: {
      mint: "mint_to_sender",
      listForSale: "list_nft",
      buy: "buy_nft",
      cancelListing: "cancel_listing",
      withdrawFees: "withdraw_fees",
    },

    // Object types
    types: {
      nft: "NFT",
      listing: "Listing",
      marketplace: "Marketplace",
    },
  },
}

export type SuiConfig = typeof SUI_CONFIG

