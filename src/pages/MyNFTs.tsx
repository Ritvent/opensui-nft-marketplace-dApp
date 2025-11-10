import { Header } from "@/components/header"
import { NFTCard } from "@/components/nft-card"
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, CONTRACTBURNMETHOD, CONTRACTMARKETPLACEID, CONTRACTLISTMETHOD, CONTRACTUPDATEDESCMETHOD } from "../configs/constants"
import { Transaction } from "@mysten/sui/transactions"

export default function MyNFTsPage() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction()
  const [nfts, setNfts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [priceById, setPriceById] = useState<Record<string, string>>({})
  const [openListForId, setOpenListForId] = useState<string | null>(null)

  useEffect(() => {
    if (account) {
      loadNFTs()
    } else {
      setLoading(false)
    }
  }, [account])

  const burnNft = async (objectId: string) => {
    if (!account) return
    try {
      const txb = new Transaction()
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${CONTRACTBURNMETHOD}`,
        arguments: [txb.object(objectId)],
      })

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            await loadNFTs()
          },
          onError: (e) => {
            console.error("Burn failed:", e)
          },
        },
      )
    } catch (e) {
      console.error("Burn error:", e)
    }
  }

  const listNft = async (objectId: string) => {
    if (!account) return
    const priceInput = priceById[objectId]
    if (!priceInput) return
    try {
      const priceMist = BigInt(Math.round(Number(priceInput) * 1e9))
      const txb = new Transaction()
      // Signature: entry fun list_nft_for_sale(nft: TestChainNFT, price: u64, ctx: &mut TxContext)
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${CONTRACTLISTMETHOD}`,
        arguments: [
          txb.object(objectId),
          txb.pure.u64(priceMist.toString()),
        ],
      })

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            await loadNFTs()
            setPriceById((m) => ({ ...m, [objectId]: "" }))
          },
          onError: (e) => {
            console.error("List failed:", e)
          },
        },
      )
    } catch (e) {
      console.error("List error:", e)
    }
  }

  const updateNFTDescription = async (nftId: string, newDescription: string) => {
    if (!account) {
      alert("Please connect your wallet first")
      return
    }

    if (!newDescription.trim()) {
      alert("Description cannot be empty")
      return
    }

    try {
      const txb = new Transaction()
      
      // Call the update_nft_description function
      // Signature: entry fun update_nft_description(nft: &mut TestChainNFT, new_description: vector<u8>)
      txb.moveCall({
        target: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${CONTRACTUPDATEDESCMETHOD}`,
        arguments: [
          txb.object(nftId),
          txb.pure.string(newDescription)
        ]
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async () => {
            console.log("NFT description updated successfully!")
            await loadNFTs()
          },
          onError: (e) => {
            console.error("Update failed:", e)
            alert(`Update failed: ${e.message || 'Unknown error'}`)
          },
        },
      )
    } catch (e: any) {
      console.error("Update error:", e)
      alert(`Update error: ${e.message || 'Unknown error'}`)
    }
  }

  const loadNFTs = async () => {
    if (!account?.address) return

    try {
      setLoading(true)
      
      console.log("=== 🔍 STARTING NFT FETCH ===")
      console.log("Wallet Address:", account.address)
      console.log("Package ID:", CONTRACTPACKAGEID)
      console.log("Module Name:", CONTRACTMODULENAME)
      
      // Step 1: Fetch ALL owned objects with scalable pagination
      console.log("\n=== Step 1: Fetching owned objects (paginated) ===")
      
      let allObjects: any[] = []
      let cursor: string | null = null
      let hasNextPage = true
      let pageCount = 0
      const MAX_PAGES = 20 // Safety limit: ~1000 objects max (50 per page)
      
      // Paginate through owned objects with early exit
      while (hasNextPage && pageCount < MAX_PAGES) {
        try {
          const response = await suiClient.getOwnedObjects({
            owner: account.address,
            cursor: cursor,
            limit: 50, // Explicit limit for clarity
            options: {
              showContent: true,
              showType: true,
              showDisplay: true,
            },
          })
          
          allObjects = [...allObjects, ...response.data]
          hasNextPage = response.hasNextPage
          cursor = response.nextCursor ?? null
          pageCount++
          
          console.log(`📄 Page ${pageCount}: Fetched ${response.data.length} objects, total so far: ${allObjects.length}`)
          
        } catch (pageError) {
          console.warn(`⚠️ Failed to fetch page ${pageCount + 1}, continuing with ${allObjects.length} objects`, pageError)
          break // Stop pagination on error but continue with what we have
        }
      }
      
      if (pageCount >= MAX_PAGES) {
        console.warn(`⚠️ Reached maximum page limit (${MAX_PAGES} pages). Some objects may not be shown.`)
      }
      
      const allOwnedObjects = { data: allObjects }
      console.log(`✅ Total objects fetched: ${allOwnedObjects.data.length} (across ${pageCount} pages)`)
      
      if (allOwnedObjects.data.length === 0) {
        console.log("⚠️ No objects found for this address")
        setNfts([])
        setLoading(false)
        return
      }
      
      // Log all object types
      console.log("\n=== All owned object types: ===")
      allOwnedObjects.data.forEach((obj, index) => {
        console.log(`${index + 1}. Type: ${obj.data?.type}`)
        console.log(`   ID: ${obj.data?.objectId}`)
      })
      
      // Build a lookup of listed NFTs (nftId -> price in SUI) from marketplace
      const listedPriceByNftId: Record<string, string> = {}
      try {
        if (CONTRACTMARKETPLACEID) {
          const fields = await suiClient.getDynamicFields({ parentId: CONTRACTMARKETPLACEID })
          for (const f of fields.data) {
            try {
              const fieldObj = await suiClient.getDynamicFieldObject({ parentId: CONTRACTMARKETPLACEID, name: f.name })
              const listingDetails = fieldObj.data
              const listingType = listingDetails?.type || ''
              const expectedListingTypeFragment = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::Listing`
              if (!listingType.includes(expectedListingTypeFragment)) continue

              const content: any = listingDetails?.content
              if (content && 'fields' in content) {
                const lf = content.fields as any
                const nftId = String(lf.nft_id || lf.nft || lf.object || '')
                const rawPrice = lf.price ? String(lf.price) : undefined
                if (nftId && rawPrice) {
                  // Convert MIST -> SUI (1e9)
                  const sui = (Number(rawPrice) / 1e9).toString()
                  listedPriceByNftId[nftId] = sui
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn('Failed to read marketplace listings map:', e)
      }

      // Step 2: Universal NFT filtering - Show ALL NFTs from any package
console.log(`\n=== Step 2: Universal NFT filtering (showing ALL NFTs) ===`)

// Filter to show any object that looks like an NFT (has Display or NFT-like structure)
const matchingObjects = allOwnedObjects.data.filter(obj => {
  const type = obj.data?.type || ''
  const content = obj.data?.content
  
  // Check if object has total_supply field (coin indicator)
  let hasTotalSupply = false
  if (content && 'fields' in content) {
    const fields = content.fields as any
    hasTotalSupply = 'total_supply' in fields
  }
  
  // Exclude system objects and coin-related objects
  if (type.includes('::coin::') || 
      type.includes('TreasuryCap') ||
      type.includes('Coin<') ||
      type.includes('_coin::') ||
      type.includes('MY_COIN') ||
      hasTotalSupply ||
      type.includes('::kiosk::') || 
      type.includes('::display::') ||
      type.includes('::package::')) {
    console.log(`❌ Excluded system/coin object: ${type.slice(0, 80)}...`)
    return false
  }
  
  // MUST have content to be considered
  if (!content || !('fields' in content)) {
    console.log(`❌ Excluded: No content fields`)
    return false
  }
  
  // Include if it has Display metadata (standard NFTs have this)

        
        // Include if it has Display metadata (standard NFTs have this)
        const hasDisplay = !!obj.data?.display
        
        // Or if the type name suggests it's an NFT
        const looksLikeNFT = type.includes('NFT') || 
                             type.includes('nft') || 
                             type.includes('Token') ||
                             type.includes('Asset')
        
        return hasDisplay || looksLikeNFT
      })
      
      const ownedObjects = { data: matchingObjects }
      console.log(`✅ Universal filter found: ${ownedObjects.data.length} NFTs from all packages`)

      if (ownedObjects.data.length === 0) {
        console.log("\n❌ No NFTs found matching the criteria")
        console.log("Possible reasons:")
        console.log("1. No NFTs have been minted yet")
        console.log("2. Package ID doesn't match deployed contract")
        console.log("3. NFTs are stored under a different type name")
        setNfts([])
        setLoading(false)
        return
      }

      // Step 4: Parse NFT details
      console.log(`\n=== Step 4: Parsing ${ownedObjects.data.length} NFT(s) ===`)
      const nftList = await Promise.all(
        ownedObjects.data.map(async (obj, index) => {
          try {
            const objectId = obj.data?.objectId
            if (!objectId) {
              console.log(`⚠️ NFT ${index + 1}: No object ID`)
              return null
            }

            console.log(`\n📦 NFT ${index + 1} (${objectId}):`)
            
            const objectDetails = await suiClient.getObject({
              id: objectId,
              options: {
                showContent: true,
                showDisplay: true,
                showType: true,
              },
            })

            const content = objectDetails.data?.content
            const display = objectDetails.data?.display?.data
            const objectType = objectDetails.data?.type || ''
            
            // Check if this NFT is from our package (can be managed)
            const isFromThisPackage = objectType.includes(CONTRACTPACKAGEID) && 
                                      objectType.includes(CONTRACTMODULENAME) && 
                                      objectType.includes('TestChainNFT')
            
            console.log(`   Type: ${objectType}`)
            console.log(`   Has content: ${!!content}`)
            console.log(`   Has display: ${!!display}`)
            console.log(`   Is from this package: ${isFromThisPackage}`)
            
            if (content && 'fields' in content) {
              const fields = content.fields as any
              console.log(`   Available fields:`, Object.keys(fields))
              
              const name = fields.name || fields.Name || fields.nft_name || 'Unnamed NFT'
              const description = fields.description || fields.Description || fields.nft_description || ''
              const url = fields.url || fields.URL || fields.image_url || fields.imageUrl || fields.img_url || ''
              
              console.log(`   ✅ Extracted:`)
              console.log(`      Name: ${name}`)
              console.log(`      Description: ${description}`)
              console.log(`      Image: ${url}`)
              
              return {
                id: objectId,
                name: String(name),
                description: String(description),
                image: String(url) || '/placeholder.svg',
                price: listedPriceByNftId[objectId],
                isListed: Boolean(listedPriceByNftId[objectId]),
                isFromThisPackage,
                packageInfo: objectType,
              }
            }
            
            if (display) {
              console.log(`   ✅ Using display data:`)
              console.log(`      Name: ${display.name}`)
              console.log(`      Description: ${display.description}`)
              console.log(`      Image: ${display.image_url || display.image}`)
              
              return {
                id: objectId,
                name: display.name || 'Unnamed NFT',
                description: display.description || '',
                image: display.image_url || display.image || '/placeholder.svg',
                price: listedPriceByNftId[objectId],
                isListed: Boolean(listedPriceByNftId[objectId]),
                isFromThisPackage,
                packageInfo: objectType,
              }
            }
            
            console.log(`   ⚠️ No recognizable data structure, using defaults`)
            return {
              id: objectId,
              name: 'NFT',
              description: objectType || 'NFT',
              image: '/placeholder.svg',
              price: listedPriceByNftId[objectId],
              isListed: Boolean(listedPriceByNftId[objectId]),
              isFromThisPackage,
              packageInfo: objectType,
            }
          } catch (error) {
            console.error(`❌ Failed to fetch details for NFT ${index + 1}:`, error)
            return null
          }
        })
      )

      const validNFTs = nftList.filter((nft) => nft !== null) as any[]
      console.log(`\n=== ✅ FINAL RESULT: ${validNFTs.length} valid NFT(s) ===`)
      setNfts(validNFTs)
    } catch (error) {
      console.error("❌ Failed to load NFTs:", error)
      setNfts([])
    } finally {
      setLoading(false)
    }
  }

  if (!account) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
            <p className="text-muted-foreground">Connect to view your NFT collection</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8 sm:mb-12">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              My NFTs
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Your digital collectible collection</p>
          </div>
          <button
            onClick={loadNFTs}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-50 transition-opacity text-sm font-medium w-full sm:w-auto"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground">Loading your NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-muted-foreground mb-6">You don't have any NFTs yet</p>
              <Link
                to="/mint"
                className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 px-8 py-3 text-primary-foreground font-medium transition-colors"
              >
                Create Your First NFT
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {nfts.map((nft) => (
              <div key={nft.id} className="space-y-2 sm:space-y-3">
                <NFTCard
                  {...nft}
                  onList={nft.isFromThisPackage ? () => setOpenListForId((prev) => (prev === nft.id ? null : nft.id)) : undefined}
                  listButtonText={openListForId === nft.id ? "Cancel" : "List for Sale"}
                  onUpdateDescription={nft.isFromThisPackage ? (newDesc) => updateNFTDescription(nft.id, newDesc) : undefined}
                  canEdit={nft.isFromThisPackage}
                />
                
                {/* Show warning for NFTs from other packages */}
                {!nft.isFromThisPackage && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      ⚠️ From external collection - View only
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cannot modify or edit NFTs from other packages
                    </p>
                  </div>
                )}
                
                {openListForId === nft.id && nft.isFromThisPackage && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Price (SUI)"
                        value={priceById[nft.id] || ""}
                        onChange={(e) => setPriceById((m) => ({ ...m, [nft.id]: e.target.value }))}
                        className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => listNft(nft.id)}
                        disabled={isPending || !priceById[nft.id] || Number(priceById[nft.id]) <= 0}
                        className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-secondary disabled:hover:text-secondary-foreground text-sm font-medium transition-colors"
                      >
                        {isPending ? "Processing..." : "List"}
                      </button>
                    </div>
                    {priceById[nft.id] && Number(priceById[nft.id]) <= 0 && (
                      <p className="text-xs text-red-500 font-medium">
                        Price must be greater than 0 SUI
                      </p>
                    )}
                  </div>
                )}
                
                {/* Only show burn button for NFTs from this package */}
                {nft.isFromThisPackage && (
                  <button
                    onClick={() => burnNft(nft.id)}
                    disabled={isPending}
                    className="w-full px-3 py-2 rounded-md bg-destructive text-white hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
                  >
                    {isPending ? "Processing..." : "Burn"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}