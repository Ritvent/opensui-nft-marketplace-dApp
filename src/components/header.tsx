import { useState, useEffect } from "react"
import { ConnectButton, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { Link, useLocation } from "react-router-dom"
import { Menu, X, Wallet } from "lucide-react"

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (account?.address) {
      loadBalance()
      // Refresh balance every 10 seconds
      const interval = setInterval(loadBalance, 10000)
      return () => clearInterval(interval)
    } else {
      setBalance(null)
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              OpenSUI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to="/explore" 
              className={`transition-colors ${location.pathname === '/explore' ? 'font-semibold' : ''}`}
              style={{ color: location.pathname === '/explore' ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 70%, transparent)' }}
            >
              Explore
            </Link>
            <Link 
              to="/mint" 
              className={`transition-colors ${location.pathname === '/mint' ? 'font-semibold' : ''}`}
              style={{ color: location.pathname === '/mint' ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 70%, transparent)' }}
            >
              Mint
            </Link>
            <Link 
              to="/my-nfts" 
              className={`transition-colors ${location.pathname === '/my-nfts' ? 'font-semibold' : ''}`}
              style={{ color: location.pathname === '/my-nfts' ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 70%, transparent)' }}
            >
              My NFTs
            </Link>
            <Link 
              to="/admin" 
              className={`transition-colors ${location.pathname === '/admin' ? 'font-semibold' : ''}`}
              style={{ color: location.pathname === '/admin' ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 70%, transparent)' }}
            >
              Admin
            </Link>
          </nav>

          {/* Wallet Connection & Mobile Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3">
              {account && balance !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {loading ? "..." : `${balance} SUI`}
                  </span>
                </div>
              )}
              <ConnectButton />
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <nav className="md:hidden mt-4 flex flex-col gap-4 pb-4 border-t border-border pt-4">
            <Link to="/explore" className={`${location.pathname === '/explore' ? 'text-primary font-semibold' : 'text-primary/70'} hover:text-primary transition-colors`} onClick={() => setMobileOpen(false)}>
              Explore
            </Link>
            <Link to="/mint" className={`${location.pathname === '/mint' ? 'text-primary font-semibold' : 'text-primary/70'} hover:text-primary transition-colors`} onClick={() => setMobileOpen(false)}>
              Mint
            </Link>
            <Link to="/my-nfts" className={`${location.pathname === '/my-nfts' ? 'text-primary font-semibold' : 'text-primary/70'} hover:text-primary transition-colors`} onClick={() => setMobileOpen(false)}>
              My NFTs
            </Link>
            <Link to="/admin" className={`${location.pathname === '/admin' ? 'text-primary font-semibold' : 'text-primary/70'} hover:text-primary transition-colors`} onClick={() => setMobileOpen(false)}>
              Admin
            </Link>
            <div className="pt-2 flex flex-col gap-3">
              {account && balance !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {loading ? "..." : `${balance} SUI`}
                  </span>
                </div>
              )}
              <ConnectButton />
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}