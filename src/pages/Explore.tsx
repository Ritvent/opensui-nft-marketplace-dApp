import { Header } from "@/components/header"
import { NFTCard } from "@/components/nft-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast-provider"
import { Search, SlidersHorizontal, Grid3x3, List } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { CONTRACTMARKETPLACEID, CONTRACTPACKAGEID, CONTRACTMODULENAME, CONTRACTBUYMETHOD, CONTRACTDELISTMETHOD } from "../configs/constants"
import { Transaction } from "@mysten/sui/transactions"

type ListingItem = {
  id: string
  nftId: string
  name: string
  description: string
  image: string
  price?: string
  isListed: boolean
  seller?: string
}

export default function ExplorePage() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<ListingItem[]>([])
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null)
 const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'name'>('price-low')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [userBalance, setUserBalance] = useState<string>('0')
  const [showInsufficientBalanceWarning, setShowInsufficientBalanceWarning] = useState(false)

  useEffect(() => {
    loadListings()
  }, [])

  useEffect(() => {
    if (account?.address) {
      fetchUserBalance()
    }
  }, [account?.address])

  const fetchUserBalance = async () => {
    if (!account?.address) return
    
    try {
      const balance = await suiClient.getBalance({
        owner: account.address,
      })
      // Convert MIST to SUI
      const balanceInSUI = (Number(balance.totalBalance) / 1e9).toFixed(4)
      console.log("💰 User Balance Fetched:", balanceInSUI, "SUI")
      setUserBalance(balanceInSUI)
    } catch (e) {
      console.error("Failed to fetch balance:", e)
      setUserBalance('0')
    }
  }

  const buyNFT = async (listingId: string, priceInSUI: string) => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        type: "error"
      })
      return
    }

    console.log("=== BUY NFT CHECK ===")
    console.log("User Balance:", userBalance)
    console.log("Price:", priceInSUI)
    console.log("Balance < Price:", Number(userBalance) < Number(priceInSUI))

    // Check if user has sufficient balance
    if (Number(userBalance) < Number(priceInSUI)) {
      console.log("INSUFFICIENT BALANCE - Showing warning")
      setShowInsufficientBalanceWarning(true)
      
      // Hide warning after 5 seconds
      setTimeout(() => {
        setShowInsufficientBalanceWarning(false)
      }, 5000)
      
      return
    }

    // Clear warning if user has sufficient balance
    setShowInsufficientBalanceWarning(false)

    try {
      const priceInMist = BigInt(Math.round(Number(priceInSUI) * 1e9))
      const txb = new Transaction()
      
      // Split coins to get the exact payment amount
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(priceInMist.toString())])
      
      // Call the buy_nft function
      // Signature: entry fun buy_nft(listing: Listing, mut payment: Coin<SUI>, marketplace: &mut Marketplace, ctx: &mut TxContext)
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${CONTRACTBUYMETHOD}`,
        arguments: [
          txb.object(listingId),
          paymentCoin,
          txb.object(CONTRACTMARKETPLACEID)
        ]
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            console.log("NFT purchased successfully!")
            toast({
              title: "Purchase Successful",
              description: "NFT has been added to your collection!",
              type: "success"
            })
            // Reload listings and balance
            await loadListings()
            await fetchUserBalance()
            setSelectedListing(null)
          },
          onError: (e) => {
            console.error("Purchase failed:", e)
            toast({
              title: "Purchase Failed",
              description: e.message || 'Unknown error occurred',
              type: "error"
            })
          },
        },
      )
    } catch (e: any) {
      console.error("Purchase error:", e)
      toast({
        title: "Purchase Error",
        description: e.message || 'Unknown error occurred',
        type: "error"
      })
    }
  }

  const delistNFT = async (listingId: string) => {
    if (!account) {
      alert("Please connect your wallet first")
      return
    }

    try {
      const txb = new Transaction()
      
      // Call the delist_nft function
      // Signature: public fun delist_nft(listing: Listing, ctx: &TxContext)
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${CONTRACTDELISTMETHOD}`,
        arguments: [
          txb.object(listingId)
        ]
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            console.log("NFT delisted successfully!")
            // Reload listings to reflect the delisting
            await loadListings()
            setSelectedListing(null)
          },
          onError: (e) => {
            console.error("Delist failed:", e)
            alert(`Delist failed: ${e.message || 'Unknown error'}`)
          },
        },
      )
    } catch (e: any) {
      console.error("Delist error:", e)
      alert(`Delist error: ${e.message || 'Unknown error'}`)
    }
  }

  const loadListings = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!CONTRACTMARKETPLACEID) {
        setError("Marketplace ID not configured.")
        setLoading(false)
        return
      }

      console.log("=== 🛒 LOADING MARKETPLACE LISTINGS ===")
      console.log("Marketplace ID:", CONTRACTMARKETPLACEID)
      console.log("Package ID:", CONTRACTPACKAGEID)
      console.log("Module Name:", CONTRACTMODULENAME)

      // Try Method 1: Get dynamic fields from marketplace
      console.log("\n📍 Method 1: Checking dynamic fields...")
      const fields = await suiClient.getDynamicFields({ parentId: CONTRACTMARKETPLACEID })
      console.log(`Found ${fields.data.length} dynamic fields in marketplace`)

      // Try Method 2: Query for all Listing objects owned by the marketplace
      console.log("\n📍 Method 2: Querying for Listing objects owned by marketplace...")
      let listingObjects: any[] = []
      
      try {
        const ownedListings = await suiClient.getOwnedObjects({
          owner: CONTRACTMARKETPLACEID,
          options: {
            showContent: true,
            showType: true,
          },
        })
        console.log(`Marketplace owns ${ownedListings.data.length} objects`)
        
        // Filter for Listing type objects
        listingObjects = ownedListings.data.filter(obj => {
          const type = obj.data?.type || ''
          return type.includes('Listing')
        })
        console.log(`Found ${listingObjects.length} Listing objects owned by marketplace`)
      } catch (e) {
        console.warn("Method 2 failed:", e)
      }

      // Try Method 3: Query for ALL Listing objects on chain by type
      console.log("\n📍 Method 3: Querying for ALL Listing objects by type...")
      try {
        const listingType = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::Listing`
        console.log(`Searching for type: ${listingType}`)
        
        // Use multiGetObjects to check if we can find listings by querying events or known IDs
        // For now, let's try to get all objects of Listing type
        const allObjects = await suiClient.queryEvents({
          query: {
            MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::ListNFTEvent`
          },
          limit: 50,
        })
        
        console.log(`Found ${allObjects.data.length} ListNFTEvent events`)
        
        // Extract listing IDs from events
        for (const event of allObjects.data) {
          try {
            const parsedJson = event.parsedJson as any
            const listingId = parsedJson?.listing_id
            
            if (listingId && !listingObjects.find(obj => obj.data?.objectId === listingId)) {
              console.log(`Found listing from event: ${listingId}`)
              
              // Try to fetch this listing object
              const listingObj = await suiClient.getObject({
                id: listingId,
                options: { showContent: true, showType: true },
              })
              
              if (listingObj.data) {
                listingObjects.push({ data: listingObj.data })
              }
            }
          } catch (e) {
            console.warn("Failed to process event:", e)
          }
        }
        
        console.log(`Total unique listings found: ${listingObjects.length}`)
      } catch (e) {
        console.warn("Method 3 failed:", e)
      }

      if (fields.data.length === 0 && listingObjects.length === 0) {
        console.log("⚠️ No listings found using any method")
        setListings([])
        setLoading(false)
        return
      }

      // Process listings from both methods
      const items: ListingItem[] = []
      
      // Process dynamic fields (Method 1)
      console.log(`\n📦 Processing ${fields.data.length} dynamic fields...`)
      for (const f of fields.data) {
        try {
          console.log(`\n📋 Processing field:`, f.name)
          const fieldObj = await suiClient.getDynamicFieldObject({ parentId: CONTRACTMARKETPLACEID, name: f.name })
          const listingObjId = fieldObj.data?.objectId
          const listingDetails = fieldObj.data
          const listingType = listingDetails?.type || ''
          console.log(`   Type: ${listingType}`)

          // Ensure it's our Listing type
          const expectedListingTypeFragment = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::Listing`
          if (!listingType.includes(expectedListingTypeFragment)) {
            console.log(`   ⚠️ Skipping - not a Listing type`)
            continue
          }

          // Extract fields (best-effort, depends on your Move struct)
          const listingContent: any = listingDetails?.content
          let nftId = ''
          let price: string | undefined
          if (listingContent && 'fields' in listingContent) {
            const lf = listingContent.fields as any
            nftId = String(lf.nft_id || lf.nft || lf.object || '')
            price = lf.price ? String(lf.price) : undefined
            console.log(`   NFT ID: ${nftId}`)
            console.log(`   Price (MIST): ${price}`)
          }
          if (!nftId) {
            console.log(`   ⚠️ Skipping - no NFT ID found`)
            continue
          }

          // Convert MIST to SUI
          const priceSUI = price ? (Number(price) / 1e9).toFixed(2) : undefined
          console.log(`   Price (SUI): ${priceSUI}`)

          // Fetch the NFT object for display data
          console.log(`   Fetching NFT object...`)
          const nftObj = await suiClient.getObject({
            id: nftId,
            options: { showContent: true, showDisplay: true, showType: true },
          })

          const display = nftObj.data?.display?.data
          const content = nftObj.data?.content as any
          let name = display?.name || 'NFT'
          let description = display?.description || ''
          let image = display?.image_url || display?.image || ''

          if ((!name || !image) && content && 'fields' in content) {
            const nf = content.fields as any
            name = name || nf.name || 'NFT'
            description = description || nf.description || ''
            image = image || nf.url || nf.image_url || ''
          }

          console.log(`   ✅ Listed NFT found:`)
          console.log(`      Name: ${name}`)
          console.log(`      Image: ${image}`)

          items.push({
            id: listingObjId!,
            nftId,
            name,
            description,
            image: image || '/placeholder.svg',
            price: priceSUI,
            isListed: true,
          })
        } catch (e) {
          // skip bad field entries
          console.error(`   ❌ Error processing field:`, e)
          continue
        }
      }

      // Process owned Listing objects (Method 2)
      console.log(`\n📦 Processing ${listingObjects.length} owned listing objects...`)
      for (const listingObj of listingObjects) {
        try {
          const listingObjId = listingObj.data?.objectId
          if (!listingObjId) continue

          console.log(`\n📋 Processing listing object: ${listingObjId}`)
          
          const listingDetails = await suiClient.getObject({
            id: listingObjId,
            options: { showContent: true, showType: true },
          })

          const listingContent: any = listingDetails.data?.content
          let nftId = ''
          let price: string | undefined
          let seller: string | undefined
          let nftData: any = null

          if (listingContent && 'fields' in listingContent) {
            const lf = listingContent.fields as any
            // Handle different NFT ID formats (could be string, object with 'id' field, or ID type)
            const rawNftId = lf.nft_id || lf.nft || lf.object || ''
            console.log(`   Raw NFT ID structure:`, rawNftId)
            console.log(`   Raw NFT ID type:`, typeof rawNftId)
            
            if (typeof rawNftId === 'object' && rawNftId !== null) {
              // The contract stores the entire NFT object, not just the ID
              // Extract the ID from fields.id.id
              if (rawNftId.fields && rawNftId.fields.id && rawNftId.fields.id.id) {
                nftId = rawNftId.fields.id.id
                // We have the NFT data already!
                nftData = rawNftId.fields
              } else if (rawNftId.id) {
                nftId = rawNftId.id
              } else {
                nftId = JSON.stringify(rawNftId)
              }
              console.log(`   Extracted NFT ID:`, nftId)
            } else {
              nftId = String(rawNftId)
            }
            price = lf.price ? String(lf.price) : undefined
            seller = lf.seller ? String(lf.seller) : undefined
            console.log(`   Final NFT ID: ${nftId}`)
            console.log(`   Price (MIST): ${price}`)
            console.log(`   Seller: ${seller}`)
          }

          if (!nftId) {
            console.log(`   ⚠️ Skipping - no NFT ID found`)
            continue
          }

          // Check if already added from Method 1
          if (items.some(item => item.nftId === nftId)) {
            console.log(`   ⚠️ Skipping - already added`)
            continue
          }

          const priceSUI = price ? (Number(price) / 1e9).toFixed(2) : undefined
          console.log(`   Price (SUI): ${priceSUI}`)

          let name = 'NFT'
          let description = ''
          let image = ''

          // Use the NFT data we already have from the listing
          if (nftData) {
            name = nftData.name || 'NFT'
            description = nftData.description || ''
            image = nftData.url || nftData.image_url || ''
            console.log(`   ✅ Using NFT data from listing:`)
            console.log(`      Name: ${name}`)
            console.log(`      Description: ${description}`)
            console.log(`      Image: ${image}`)
          } else {
            // Fallback: Fetch the NFT object for display data
            console.log(`   Fetching NFT object...`)
            try {
              const nftObj = await suiClient.getObject({
                id: nftId,
                options: { showContent: true, showDisplay: true, showType: true },
              })

              const display = nftObj.data?.display?.data
              const content = nftObj.data?.content as any
              name = display?.name || 'NFT'
              description = display?.description || ''
              image = display?.image_url || display?.image || ''

              if ((!name || !image) && content && 'fields' in content) {
                const nf = content.fields as any
                name = name || nf.name || 'NFT'
                description = description || nf.description || ''
                image = image || nf.url || nf.image_url || ''
              }

              console.log(`   ✅ Listed NFT found:`)
              console.log(`      Name: ${name}`)
              console.log(`      Image: ${image}`)
            } catch (e) {
              console.error(`   ❌ Error fetching NFT object:`, e)
              continue
            }
          }

          items.push({
            id: listingObjId,
            nftId,
            name,
            description,
            image: image || '/placeholder.svg',
            price: priceSUI,
            isListed: true,
            seller,
          })
        } catch (e) {
          console.error(`   ❌ Error processing listing object:`, e)
          continue
        }
      }

      console.log(`\n=== ✅ LOADED ${items.length} LISTINGS ===`)
      setListings(items)
      if (items.length > 0 && !selectedListing) {
        setSelectedListing(items[0])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load listings.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let result = [...listings]
    
    // Search filter
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((l) => l.name.toLowerCase().includes(q))
    }
    
    // Price range filter
    if (priceRange.min) {
      result = result.filter((l) => l.price && Number(l.price) >= Number(priceRange.min))
    }
    if (priceRange.max) {
      result = result.filter((l) => l.price && Number(l.price) <= Number(priceRange.max))
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price-low') {
        return Number(a.price || 0) - Number(b.price || 0)
      }
      if (sortBy === 'price-high') {
        return Number(b.price || 0) - Number(a.price || 0)
      }
      return a.name.localeCompare(b.name)
    })
    
    return result
  }, [search, listings, sortBy, priceRange])

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      {/* Header bar */}
      
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">OpenSUI Marketplace</h1>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="text-primary"
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={loadListings} 
                disabled={loading}
                className="text-primary"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className={`${showFilters ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
            <Card className="bg-card border-border p-4 sticky top-4">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-primary uppercase">Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase mb-2 block">Search</label>
                      <div className="relative">
                        <Input
                          placeholder="Item name..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="bg-background border-border text-sm h-8"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground uppercase mb-2 block">Sort By</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-background border border-border text-foreground text-sm h-8 rounded px-2"
                      >
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="name">Name</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground uppercase mb-2 block">Price Range (SUI)</label>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                          className="bg-background border-border text-sm h-8"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                          className="bg-background border-border text-sm h-8"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setPriceRange({ min: '', max: '' })
                      }}
                      className="w-full text-xs h-7"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Total Items:</span>
                      <span className="text-foreground">{listings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Showing:</span>
                      <span className="text-foreground">{filtered.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {!showFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(true)}
                className="mb-4"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Show Filters
              </Button>
            )}

            {error && (
              <div className="mb-4 p-3 bg-destructive/20 border border-destructive/50 rounded text-sm text-destructive">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading marketplace...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">No items found</p>
                <p className="text-muted-foreground text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="flex gap-4">
                {/* Items List */}
                <div className="flex-1">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filtered.map((item) => {
                        const isSelected = selectedListing?.id === item.id
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedListing(item)}
                            className={`bg-card border-2 rounded cursor-pointer transition-all hover:border-primary ${
                              isSelected ? 'border-primary' : 'border-border'
                            }`}
                          >
                            <div className="aspect-square bg-muted overflow-hidden">
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg'
                                }}
                              />
                            </div>
                            <div className="p-3">
                              <h3 className="text-foreground text-sm font-semibold truncate mb-1">{item.name}</h3>
                              <h3 className="text-muted-foreground text-xs font-semibold truncate mb-1">{item.description}</h3>
                              {item.price && (
                                <div className="flex items-center justify-between">
                                  <span className="text-primary text-lg font-bold">{item.price} SUI</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((item) => {
                        const isSelected = selectedListing?.id === item.id
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedListing(item)}
                            className={`bg-card border-2 rounded cursor-pointer transition-all hover:border-primary ${
                              isSelected ? 'border-primary' : 'border-border'
                            }`}
                          >
                            <div className="flex gap-4 p-3">
                              <div className="w-24 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                                <img 
                                  src={item.image} 
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder.svg'
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-foreground font-semibold mb-1">{item.name}</h3>
                                <p className="text-muted-foreground text-sm truncate mb-2">{item.description}</p>
                                {item.seller && (
                                  <p className="text-xs text-muted-foreground">
                                    Seller: <a 
                                      href={`https://suiscan.xyz/testnet/account/${item.seller}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-primary underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {item.seller.slice(0, 6)}...{item.seller.slice(-4)}
                                    </a>
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col justify-center items-end">
                                {item.price && (
                                  <span className="text-primary text-xl font-bold">{item.price} SUI</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right Panel - Selected Item Details */}
                {selectedListing && (
                  <div className="w-64 flex-shrink-0">
                    <Card className="bg-card border-border sticky top-20">
                      <div className="p-4">
                        <div className="aspect-square bg-muted rounded mb-4 overflow-hidden">
                          <img 
                            src={selectedListing.image} 
                            alt={selectedListing.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg'
                            }}
                          />
                        </div>

                        <h2 className="text-foreground text-xl font-bold mb-2">{selectedListing.name}</h2>
                        
                        {selectedListing.description && (
                          <p className="text-muted-foreground text-sm mb-4">{selectedListing.description}</p>
                        )}

                        <div className="bg-muted rounded p-3 mb-4">
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-muted-foreground text-xs uppercase">Price</span>
                          </div>
                          {selectedListing.price ? (
                            <>
                              <div className="text-primary text-3xl font-bold">{selectedListing.price} SUI</div>
                              {showInsufficientBalanceWarning && account?.address && selectedListing.seller && account.address !== selectedListing.seller && (
                                <div className="mt-3 text-red-600 dark:text-red-400 text-sm font-medium animate-in fade-in">
                                  Insufficient balance. You need {(Number(selectedListing.price) - Number(userBalance)).toFixed(4)} more SUI
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-muted-foreground text-sm">Not listed</div>
                          )}
                        </div>

                        {selectedListing.seller && (
                          <div className="mb-4 p-3 bg-muted rounded">
                            <p className="text-xs text-muted-foreground uppercase mb-1">Seller</p>
                            <a 
                              href={`https://suiscan.xyz/testnet/account/${selectedListing.seller}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground text-sm font-mono hover:text-primary underline break-all"
                            >
                              {selectedListing.seller.slice(0, 8)}...{selectedListing.seller.slice(-6)}
                            </a>
                          </div>
                        )}

                        <div className="space-y-2">
                          {account?.address && selectedListing.seller && account.address === selectedListing.seller ? (
                            <Button
                              onClick={() => delistNFT(selectedListing.id)}
                              disabled={isPending}
                              variant="outline"
                              className="w-full text-destructive hover:bg-destructive/20 hover:border-destructive"
                            >
                              {isPending ? "Processing..." : "Delist Item"}
                            </Button>
                          ) : selectedListing.price ? (
                            <Button
                              onClick={() => buyNFT(selectedListing.id, selectedListing.price!)}
                              disabled={isPending}
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg h-12"
                            >
                              {isPending ? "Processing..." : "Buy Now"}
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Listing ID:</span>
                              <a 
                                href={`https://suiscan.xyz/testnet/object/${selectedListing.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono hover:text-primary underline"
                              >
                                {selectedListing.id.slice(0, 8)}...
                              </a>
                            </div>
                            <div className="flex justify-between">
                              <span>NFT ID:</span>
                              <a 
                                href={`https://suiscan.xyz/testnet/object/${selectedListing.nftId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono hover:text-primary underline"
                              >
                                {selectedListing.nftId.slice(0, 8)}...
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}