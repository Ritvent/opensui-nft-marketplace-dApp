// ============================================
// NFT MARKETPLACE - CONFIGURATION CONSTANTS
// ============================================
// This file reads from environment variables (.env file)
// See .env.example for setup instructions

// Network Configuration
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || "testnet"
export const SUI_RPC_URL = import.meta.env.VITE_SUI_RPC_URL || undefined

// Contract Configuration
// ⚠️ REQUIRED: These must be set in your .env file
// See .env.example for setup instructions
const rawPackageId = import.meta.env.VITE_CONTRACT_PACKAGE_ID
if (!rawPackageId) {
  throw new Error(
    "VITE_CONTRACT_PACKAGE_ID is required. Please set it in your .env file. " +
    "See .env.example for setup instructions."
  )
}
export const CONTRACTPACKAGEID: string = rawPackageId

export const CONTRACTMODULENAME = 
  import.meta.env.VITE_CONTRACT_MODULE_NAME || 
  "nft_marketplace"

const rawMarketplaceId = import.meta.env.VITE_CONTRACT_MARKETPLACE_ID
if (!rawMarketplaceId) {
  throw new Error(
    "VITE_CONTRACT_MARKETPLACE_ID is required. Please set it in your .env file. " +
    "See .env.example for setup instructions."
  )
}
export const CONTRACTMARKETPLACEID: string = rawMarketplaceId

// Admin Configuration
const rawAdminAddress = import.meta.env.VITE_ADMIN_ADDRESS
if (!rawAdminAddress) {
  throw new Error(
    "VITE_ADMIN_ADDRESS is required. Please set it in your .env file. " +
    "See .env.example for setup instructions."
  )
}
export const ADMIN_ADDRESS: string = rawAdminAddress

// Contract Methods (with fallback defaults)
export const CONTRACTMODULEMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_MINT || 
  "mint_to_sender"

export const CONTRACTBURNMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_BURN || 
  "burn_nft"

export const CONTRACTLISTMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_LIST || 
  "list_nft_for_sale"

export const CONTRACTBUYMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_BUY || 
  "buy_nft"

export const CONTRACTDELISTMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_DELIST || 
  "delist_nft"

export const CONTRACTUPDATELISTEDDESCMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_UPDATE_LISTED_DESC || 
  "update_listed_nft_description"

export const CONTRACTUPDATEDESCMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_UPDATE_DESC || 
  "update_nft_description"

export const CONTRACTWITHDRAWFEESMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_WITHDRAW_FEES || 
  "withdraw_marketplace_fees"

export const CONTRACTUPDATEFEEMETHOD = 
  import.meta.env.VITE_CONTRACT_METHOD_UPDATE_FEE || 
  "update_fee"

// Validation
if (!CONTRACTPACKAGEID.startsWith("0x")) {
  console.warn("⚠️ CONTRACTPACKAGEID should start with '0x'")
}

if (!CONTRACTMARKETPLACEID.startsWith("0x")) {
  console.warn("⚠️ CONTRACTMARKETPLACEID should start with '0x'")
}

if (!ADMIN_ADDRESS.startsWith("0x")) {
  console.warn("⚠️ ADMIN_ADDRESS should start with '0x'")
}

// Development logging
if (import.meta.env.DEV) {
  console.log("🔧 NFT Marketplace Configuration:")
  console.log("  Network:", SUI_NETWORK)
  console.log("  Package ID:", CONTRACTPACKAGEID)
  console.log("  Marketplace ID:", CONTRACTMARKETPLACEID)
  console.log("  Admin Address:", ADMIN_ADDRESS)
}

