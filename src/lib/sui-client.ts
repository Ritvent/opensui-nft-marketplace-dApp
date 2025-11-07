import { SuiClient } from "@mysten/sui/client"
import { SUI_CONFIG } from "./sui-config"

let suiClient: SuiClient | null = null

export function getSuiClient(): SuiClient {
  if (!suiClient) {
    suiClient = new SuiClient({
      url: SUI_CONFIG.network.rpcUrl,
    })
  }
  return suiClient
}

