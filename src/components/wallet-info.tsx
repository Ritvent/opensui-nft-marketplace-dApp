import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { useEffect, useState } from "react"
import { Wallet, Copy } from "lucide-react"

export function WalletInfo() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (account?.address) {
      loadBalance()
    }
  }, [account?.address])

  const loadBalance = async () => {
    if (!account?.address) return

    try {
      setLoading(true)
      const balanceResult = await suiClient.getBalance({
        owner: account.address,
        coinType: "0x2::sui::SUI",
      })

      const suiAmount = (Number.parseFloat(balanceResult.totalBalance) / 1e9).toFixed(3)
      setBalance(suiAmount)
    } catch (error) {
      console.error("Failed to fetch balance:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!account) return null

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Wallet</h3>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">SUI Balance</p>
          <p className="text-2xl font-bold text-primary">{loading ? "..." : `${balance}`}</p>
          <p className="text-xs text-muted-foreground">SUI</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono text-foreground truncate bg-background px-3 py-2 rounded-md flex-1">
              {account.address.slice(0, 10)}...{account.address.slice(-10)}
            </p>
            <button
              onClick={copyAddress}
              className="p-2 hover:bg-background rounded-md transition-colors"
              title="Copy address"
            >
              <Copy className="w-4 h-4 text-muted-foreground hover:text-primary" />
            </button>
          </div>
          {copied && <p className="text-xs text-primary mt-1">Copied!</p>}
        </div>
      </div>

      <button
        onClick={loadBalance}
        disabled={loading}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-medium"
      >
        {loading ? "Refreshing..." : "Refresh Balance"}
      </button>
    </div>
  )
}

