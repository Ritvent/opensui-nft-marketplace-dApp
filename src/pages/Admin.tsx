import { Header } from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast-provider"
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Loader2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { ADMIN_ADDRESS, CONTRACTMARKETPLACEID, CONTRACTPACKAGEID, CONTRACTMODULENAME } from "../configs/constants"
import { Transaction } from "@mysten/sui/transactions"

// Persistent NFT name cache (survives across component refreshes)
const nftNameCache = new Map<string, string>()

export default function AdminPage() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [showWithdrawInput, setShowWithdrawInput] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'sales' | 'listings' | 'delists'>('all')
  const [stats, setStats] = useState({
    totalFees: "0",
    feePercent: "2",
    totalListings: 0,
    totalSales: 0,
    totalVolume: "0",
    activeUsers: 0,
    allTimeListings: 0,
    avgPrice: "0",
    todaySales: 0,
  })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const isAdmin = account?.address === ADMIN_ADDRESS

  // Load marketplace stats in real-time
  useEffect(() => {
    if (account && isAdmin) {
      loadStats()
      // Refresh every 10 seconds for real-time updates
      const interval = setInterval(loadStats, 10000)
      return () => clearInterval(interval)
    }
  }, [account, isAdmin])

  // Filter activities based on selected tab
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return recentActivities
    if (activityFilter === 'sales') return recentActivities.filter(a => a.type === 'purchase')
    if (activityFilter === 'listings') return recentActivities.filter(a => a.type === 'listed')
    if (activityFilter === 'delists') return recentActivities.filter(a => a.type === 'delisted')
    return recentActivities
  }, [recentActivities, activityFilter])

  const loadStats = async () => {
    try {
      console.log("=== 📊 LOADING ADMIN STATS ===")
      
      // Helper function to fetch NFT name with caching
      const fetchNFTName = async (nftId: string): Promise<string> => {
        // Skip if invalid ID
        if (!nftId || nftId === 'Unknown') {
          return 'NFT (Unknown ID)'
        }

        // Check cache first
        if (nftNameCache.has(nftId)) {
          console.log(`✅ Cache hit for NFT: ${nftId.slice(0, 8)}...`)
          return nftNameCache.get(nftId)!
        }

        // Fetch from blockchain
        console.log(`🔍 Fetching NFT from blockchain: ${nftId.slice(0, 8)}...`)
        try {
          const nftObj = await suiClient.getObject({
            id: nftId,
            options: { showContent: true, showDisplay: true }
          })
          
          console.log(`📦 NFT Object for ${nftId.slice(0, 8)}:`, {
            hasDisplay: !!nftObj.data?.display,
            displayName: nftObj.data?.display?.data?.name,
            hasContent: !!nftObj.data?.content,
            contentType: nftObj.data?.content ? 'fields' in nftObj.data.content : false
          })

          // First try display metadata
          const display = nftObj.data?.display?.data
          let name = 'NFT'
          
          if (display?.name) {
            name = display.name
            console.log(`✨ Found name in display: ${name}`)
          } else if (nftObj.data?.content && 'fields' in nftObj.data.content) {
            // Fallback to fields
            const fields = nftObj.data.content.fields as any
            name = fields.name || fields.Name || fields.nft_name || 'NFT'
            console.log(`✨ Found name in fields: ${name}`)
          } else {
            console.log(`⚠️ No name found, using fallback`)
          }
          
          // Cache the result
          nftNameCache.set(nftId, name)
          console.log(`💾 Cached NFT name: "${name}" for ${nftId.slice(0, 8)}...`)
          return name
        } catch (e) {
          console.error(`❌ Could not fetch NFT ${nftId.slice(0, 8)}:`, e)
          const fallbackName = `NFT ${nftId.slice(0, 6)}...`
          nftNameCache.set(nftId, fallbackName)
          return fallbackName
        }
      }
      
      // Get marketplace object to check accumulated fees
      const marketplaceObj = await suiClient.getObject({
        id: CONTRACTMARKETPLACEID,
        options: {
          showContent: true,
        }
      })

      console.log("Marketplace Object:", marketplaceObj)

      // Get all NFTs minted
      const allNFTs = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::NFTMinted`
        },
        limit: 100,
      })

      // Get listing events
      const listingEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::ListNFTEvent`
        },
        limit: 50,
      })

      // Get delist events
      const delistEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::DelistNFTEvent`
        },
        limit: 50,
      })

      // Get purchase events for sales stats
      const purchaseEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::PurchaseNFTEvent`
        },
        limit: 50,
      })

      // Calculate total fees from purchases
      let totalFees = 0
      purchaseEvents.data.forEach((event: any) => {
        const parsedJson = event.parsedJson as any
        const price = Number(parsedJson?.price || 0)
        // 2% fee
        totalFees += price * 0.02
      })

      // Get marketplace balance if available
      let marketplaceFees = "0"
      if (marketplaceObj.data?.content && 'fields' in marketplaceObj.data.content) {
        const fields = marketplaceObj.data.content.fields as any
        if (fields.balance) {
          marketplaceFees = (Number(fields.balance) / 1e9).toFixed(2)
        }
      }

      // Get current active listings count by checking which listing objects still exist
      let activeListingsCount = 0
      const listingIds = new Set<string>()
      
      // Collect all listing IDs from ListNFTEvent
      listingEvents.data.forEach((event: any) => {
        const parsedJson = event.parsedJson as any
        if (parsedJson?.listing_id) {
          listingIds.add(parsedJson.listing_id)
        }
      })

      // Check which listings still exist (haven't been purchased or delisted)
      for (const listingId of listingIds) {
        try {
          const listingObj = await suiClient.getObject({
            id: listingId,
            options: { showContent: true }
          })
          // If the object exists and is a Listing, it's still active
          if (listingObj.data && listingObj.data.content) {
            activeListingsCount++
          }
        } catch (e) {
          // Object doesn't exist anymore (was purchased or delisted)
          console.log("Listing no longer exists:", listingId)
        }
      }

      console.log(`Active listings: ${activeListingsCount} out of ${listingIds.size} total listing events`)

      // Build recent activities with detailed info
      const activities: any[] = []

      // Add purchase events
      for (const event of purchaseEvents.data.slice(0, 10)) {
        const parsedJson = event.parsedJson as any
        const price = (Number(parsedJson?.price || 0) / 1e9).toFixed(2)
        const nftId = parsedJson?.nft_id || 'Unknown'
        const seller = parsedJson?.seller || 'Unknown'
        const buyer = parsedJson?.buyer || 'Unknown'
        const timestamp = new Date(Number(event.timestampMs)).toLocaleString()
        
        // Fetch NFT name with caching
        const nftName = await fetchNFTName(nftId)

        activities.push({
          type: 'purchase',
          nftName,
          nftId,
          seller,
          buyer,
          price,
          timestamp,
          timestampMs: event.timestampMs
        })
      }

      // Add listing events
      for (const event of listingEvents.data.slice(0, 5)) {
        const parsedJson = event.parsedJson as any
        const nftId = parsedJson?.nft_id || 'Unknown'
        const listingId = parsedJson?.listing_id || null
        const seller = parsedJson?.seller || 'Unknown'
        const price = (Number(parsedJson?.price || 0) / 1e9).toFixed(2)
        const timestamp = new Date(Number(event.timestampMs)).toLocaleString()

        // For listings, try to get NFT name from the listing object first
        let nftName = 'NFT'
        
        if (listingId) {
          try {
            console.log(`🔍 Fetching listing object: ${listingId.slice(0, 8)}...`)
            const listingObj = await suiClient.getObject({
              id: listingId,
              options: { showContent: true }
            })

            if (listingObj.data?.content && 'fields' in listingObj.data.content) {
              const listingFields = listingObj.data.content.fields as any
              
              // The listing contains the full NFT object
              if (listingFields.nft && typeof listingFields.nft === 'object' && listingFields.nft.fields) {
                const nftFields = listingFields.nft.fields
                nftName = nftFields.name || nftFields.Name || nftFields.nft_name || 'NFT'
                console.log(`✨ Found NFT name from listing object: ${nftName}`)
                // Cache it for future use
                nftNameCache.set(nftId, nftName)
              } else {
                // Fallback: fetch NFT directly
                console.log(`⚠️ Listing doesn't contain NFT data, fetching NFT directly`)
                nftName = await fetchNFTName(nftId)
              }
            } else {
              // Listing doesn't exist anymore, fetch NFT directly
              nftName = await fetchNFTName(nftId)
            }
          } catch (e) {
            console.log(`❌ Could not fetch listing ${listingId.slice(0, 8)}, falling back to NFT fetch`)
            nftName = await fetchNFTName(nftId)
          }
        } else {
          // No listing ID, fetch NFT directly
          nftName = await fetchNFTName(nftId)
        }

        activities.push({
          type: 'listed',
          nftName,
          nftId,
          listingId,
          seller,
          price,
          timestamp,
          timestampMs: event.timestampMs
        })
      }

      // Add delist events
      for (const event of delistEvents.data.slice(0, 5)) {
        const parsedJson = event.parsedJson as any
        const nftId = parsedJson?.nft_id || 'Unknown'
        const timestamp = new Date(Number(event.timestampMs)).toLocaleString()

        // Fetch NFT name with caching
        const nftName = await fetchNFTName(nftId)

        activities.push({
          type: 'delisted',
          nftName,
          nftId,
          timestamp,
          timestampMs: event.timestampMs
        })
      }

      // Sort by timestamp and take top 10
      activities.sort((a, b) => Number(b.timestampMs) - Number(a.timestampMs))
      const sortedActivities = activities.slice(0, 10)

      // Calculate average price from purchases
      let avgPrice = "0"
      if (purchaseEvents.data.length > 0) {
        const totalPrice = purchaseEvents.data.reduce((sum: number, event: any) => {
          const parsedJson = event.parsedJson as any
          return sum + (Number(parsedJson?.price || 0) / 1e9)
        }, 0)
        avgPrice = (totalPrice / purchaseEvents.data.length).toFixed(2)
      }

      // Calculate today's sales
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTimestamp = today.getTime()
      
      const todaySales = purchaseEvents.data.filter((event: any) => {
        return Number(event.timestampMs) >= todayTimestamp
      }).length

      setStats({
        totalFees: marketplaceFees,
        feePercent: "2",
        totalListings: activeListingsCount,
        totalSales: purchaseEvents.data.length,
        totalVolume: allNFTs.data.length.toString(),
        activeUsers: new Set([...listingEvents.data, ...purchaseEvents.data].map((e: any) => {
          const parsedJson = e.parsedJson as any
          return parsedJson?.seller || parsedJson?.buyer
        })).size,
        allTimeListings: listingIds.size,
        avgPrice,
        todaySales,
      })

      setRecentActivities(sortedActivities)

      console.log("Stats loaded:", {
        totalFees: marketplaceFees,
        totalListings: activeListingsCount,
        allTimeListings: listingIds.size,
        totalSales: purchaseEvents.data.length,
        totalNFTs: allNFTs.data.length,
        avgPrice,
        todaySales,
      })
    } catch (error) {
      console.error("Failed to load stats:", error)
    }
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
            <p className="text-muted-foreground">Connect to access admin dashboard</p>
          </div>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground">You don't have admin permissions</p>
          </div>
        </div>
      </main>
    )
  }

  const handleWithdrawFees = async () => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        type: "error"
      })
      return
    }

    const amount = Number(withdrawAmount)
    const availableFees = Number(stats.totalFees)

    // Validation: Empty or invalid
    if (!withdrawAmount || isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        type: "error"
      })
      return
    }

    // Validation: Exceeds available fees
    if (amount > availableFees) {
      toast({
        title: "Insufficient Fees",
        description: `You cannot withdraw ${amount} SUI. Only ${availableFees} SUI available.`,
        type: "error",
        duration: 7000
      })
      return
    }

    // Validation: No fees available
    if (availableFees === 0) {
      toast({
        title: "No Fees Available",
        description: "There are no accumulated fees to withdraw",
        type: "warning"
      })
      return
    }

    setLoading(true)
    try {
      const amountInMist = BigInt(Math.round(amount * 1e9))
      const txb = new Transaction()
      
      // Signature: entry fun withdraw_marketplace_fees(marketplace: &mut Marketplace, amount: u64, recipient: address, ctx: &mut TxContext)
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::withdraw_marketplace_fees`,
        arguments: [
          txb.object(CONTRACTMARKETPLACEID),
          txb.pure.u64(amountInMist.toString()),
          txb.pure.address(account.address)
        ]
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            console.log("Fees withdrawn successfully!")
            toast({
              title: "Withdrawal Successful",
              description: `Successfully withdrawn ${amount} SUI to your wallet!`,
              type: "success"
            })
            setWithdrawAmount("")
            setShowWithdrawInput(false)
            await loadStats()
          },
          onError: (e) => {
            console.error("Withdraw failed:", e)
            toast({
              title: "Withdrawal Failed",
              description: e.message || 'Unknown error occurred',
              type: "error"
            })
          },
        },
      )
    } catch (error: any) {
      console.error("Withdraw error:", error)
      toast({
        title: "Withdrawal Error",
        description: error.message || 'Unknown error occurred',
        type: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Real-time marketplace analytics and management</p>
        </div>

        {/* Stats Grid - 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Sales */}
          <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
                <p className="text-3xl font-bold text-foreground mb-2">{stats.totalSales}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
            </div>
          </Card>

          {/* Active Listings */}
          <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Active Listings</p>
                <p className="text-3xl font-bold text-foreground mb-2">{stats.totalListings}</p>
                <p className="text-xs text-muted-foreground">of {stats.allTimeListings} total</p>
              </div>
            </div>
          </Card>

          {/* Accumulated Fees */}
          <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Accumulated Fees</p>
                <p className="text-primary text-3xl font-bold mb-2">{stats.totalFees}</p>
                <p className="text-xs text-muted-foreground">SUI ({stats.feePercent}% fee)</p>
              </div>
            </div>
          </Card>

          {/* Active Users */}
          <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Unique Users</p>
                <p className="text-3xl font-bold text-foreground mb-2">{stats.activeUsers}</p>
                <p className="text-xs text-muted-foreground">Connected traders</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Fee Management + Quick Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Fee Management */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-bold mb-4">Fee Management</h3>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-accent/1 border">
                  <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-primary text-2xl font-bold">{stats.totalFees} SUI</p>
                </div>

                {!showWithdrawInput ? (
                  <Button
                    onClick={() => setShowWithdrawInput(true)}
                    disabled={isPending || Number(stats.totalFees) === 0}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Withdraw Fees
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={stats.totalFees}
                        placeholder="Amount (SUI)"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className={`pr-16 ${
                          withdrawAmount && Number(withdrawAmount) > Number(stats.totalFees) 
                            ? 'border-destructive' 
                            : ''
                        }`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setWithdrawAmount(stats.totalFees)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                        disabled={isPending}
                      >
                        MAX
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleWithdrawFees}
                        disabled={loading || isPending || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number(stats.totalFees)}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        {loading || isPending ? (
                          <>
                            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Confirm"
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowWithdrawInput(false)
                          setWithdrawAmount("")
                        }}
                        variant="outline"
                        disabled={loading || isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                    {withdrawAmount && Number(withdrawAmount) > Number(stats.totalFees) && (
                      <p className="text-xs text-destructive">Exceeds available balance!</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-bold mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Avg Sale Price</span>
                  <span className="text-primary font-bold">{stats.avgPrice} SUI</span>
                  
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Fee Rate</span>
                  <span className="font-bold">{stats.feePercent}%</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Today's Sales</span>
                  <span className="font-bold text-green-500 flex items-center gap-1"> 
                    {stats.todaySales}
                  </span>
                </div>
              </div>
            </Card>

            {/* System Status */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-bold mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">Marketplace Active</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Admin: {ADMIN_ADDRESS.slice(0, 8)}...{ADMIN_ADDRESS.slice(-6)}</p>
                  <p className="mt-1">Last Updated: {new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Activity Feed */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-card border-border h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Recent Activity</h3>
                <Button 
                  onClick={loadStats} 
                  variant="ghost" 
                  size="sm"
                  className="text-xs"
                >
                  Refresh
                </Button>
              </div>

              {/* Activity Filter Tabs */}
              <div className="flex gap-2 mb-4 border-b border-border">
                {(['all', 'sales', 'listings', 'delists'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      activityFilter === filter
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter}
                    {filter !== 'all' && (
                      <span className="ml-1 text-xs">
                        ({filter === 'sales' ? recentActivities.filter(a => a.type === 'purchase').length :
                          filter === 'listings' ? recentActivities.filter(a => a.type === 'listed').length :
                          recentActivities.filter(a => a.type === 'delisted').length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Activity List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${
                            activity.type === 'purchase' ? 'text-green-500' : 
                            activity.type === 'listed' ? 'text-white-500' : 
                            'text-red-500'
                          }`}>
                            {activity.type === 'purchase' ? '✓ Sold' : 
                             activity.type === 'listed' ? '📋 Listed' : 
                             '✗ Delisted'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                      </div>
                      
                      <p className="font-medium mb-2">{activity.nftName}</p>
                      
                      <p className="text-xs text-muted-foreground mb-2">
                        NFT ID: 
                        <a 
                          href={`https://suiscan.xyz/testnet/object/${activity.nftId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary underline ml-1 font-mono"
                        >
                          {activity.nftId.slice(0, 8)}...{activity.nftId.slice(-6)}
                        </a>
                      </p>
                      
                      {activity.type === 'purchase' && (
                        <div className="space-y-1 text-xs pt-2 border-t border-border">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Seller:</span>
                            <a 
                              href={`https://suiscan.xyz/testnet/account/${activity.seller}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono hover:text-primary underline"
                            >
                              {activity.seller.slice(0, 6)}...{activity.seller.slice(-4)}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Buyer:</span>
                            <a 
                              href={`https://suiscan.xyz/testnet/account/${activity.buyer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono hover:text-primary underline"
                            >
                              {activity.buyer.slice(0, 6)}...{activity.buyer.slice(-4)}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold text-green-500">{activity.price} SUI</span>
                          </div>
                        </div>
                      )}
                      
                      {activity.type === 'listed' && (
                        <div className="space-y-1 text-xs pt-2 border-t border-border">
                          {activity.listingId && (
                            <div className="flex justify-between mb-1">
                              <span className="text-muted-foreground">Listing ID:</span>
                              <a 
                                href={`https://suiscan.xyz/testnet/object/${activity.listingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono hover:text-primary underline"
                              >
                                {activity.listingId.slice(0, 8)}...{activity.listingId.slice(-6)}
                              </a>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Seller:</span>
                            <a 
                              href={`https://suiscan.xyz/testnet/account/${activity.seller}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono hover:text-primary underline"
                            >
                              {activity.seller.slice(0, 6)}...{activity.seller.slice(-4)}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="text-primary text-1xl font-bold">{activity.price} SUI</span>
                          </div>
                        </div>
                      )}

                      {activity.type === 'delisted' && (
                        <div className="text-xs text-yellow-500/60 pt-2 border-t border-border">
                          Removed from marketplace
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No {activityFilter === 'all' ? '' : activityFilter} activities yet
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}