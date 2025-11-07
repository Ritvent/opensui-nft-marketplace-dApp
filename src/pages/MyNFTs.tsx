import { Header } from "@/components/header"
import { NFTCard } from "@/components/nft-card"
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, CONTRACTBURNMETHOD, CONTRACTMARKETPLACEID, CONTRACTLISTMETHOD, CONTRACTUPDATEDESCMETHOD } from "../configs/constants"
import { Transaction } from "@mysten/sui/transactions"

export default function MyNFTsPage() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction()
  const [searchParams] = useSearchParams()
  const [nfts, setNfts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [priceById, setPriceById] = useState<Record<string, string>>({})
  const [openListForId, setOpenListForId] = useState<string | null>(null)
  
  // Get NFT type path from URL parameter (format: packageId::moduleName::NFTType)
  const nftTypePath = searchParams.get('type')
  const externalPackageId = searchParams.get('package')
  const externalMarketplaceId = searchParams.get('marketplace')
  const isExploringExternal = !!(nftTypePath || externalPackageId)

  useEffect(() => {
    if (account || isExploringExternal) {
      loadNFTs()
    } else {
      setLoading(false)
    }
  }, [account, nftTypePath, externalPackageId, externalMarketplaceId])

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

  const loadNFTsByTypePath = async (typePath: string) => {
    try {
      console.log(`\n🔍 Querying listed NFTs by type path: ${typePath}`)
      
      // Parse the type path: packageId::moduleName::NFTType
      const parts = typePath.split('::')
      if (parts.length !== 3) {
        console.error('❌ Invalid type path format. Expected: packageId::moduleName::NFTType')
        setNfts([])
        setLoading(false)
        return
      }
      
      const [packageId, moduleName] = parts
      console.log(`Package: ${packageId}`)
      console.log(`Module: ${moduleName}`)
      
      // Query ListNFTEvent using the parsed module name
      const listingEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::${moduleName}::ListNFTEvent`
        },
        limit: 50,
      })
      
      console.log(`Found ${listingEvents.data.length} listing events`)
      
      const externalNFTs: any[] = []
      
      for (const event of listingEvents.data) {
        try {
          const parsedJson = event.parsedJson as any
          const listingId = parsedJson?.listing_id
          
          if (!listingId) continue
          
          // Fetch the listing object
          const listingObj = await suiClient.getObject({
            id: listingId,
            options: { showContent: true, showType: true },
          })
          
          if (!listingObj.data) continue
          
          const listingContent: any = listingObj.data.content
          if (!listingContent || !('fields' in listingContent)) continue
          
          const fields = listingContent.fields as any
          const rawNftId = fields.nft_id || fields.nft || fields.object || ''
          
          let nftId = ''
          let nftData: any = null
          
          // Handle nested NFT object structure
          if (typeof rawNftId === 'object' && rawNftId !== null) {
            if (rawNftId.fields && rawNftId.fields.id && rawNftId.fields.id.id) {
              nftId = rawNftId.fields.id.id
              nftData = rawNftId.fields
            } else if (rawNftId.id) {
              nftId = rawNftId.id
            }
          } else {
            nftId = String(rawNftId)
          }
          
          if (!nftId) continue
          
          const price = fields.price ? String(fields.price) : undefined
          const priceSUI = price ? (Number(price) / 1e9).toFixed(2) : undefined
          
          let name = 'NFT'
          let description = ''
          let image = ''
          
          // Use embedded NFT data if available
          if (nftData) {
            name = nftData.name || 'NFT'
            description = nftData.description || ''
            image = nftData.url || nftData.image_url || ''
          } else {
            // Fallback: fetch NFT object
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
            } catch (e) {
              console.warn(`Failed to fetch NFT ${nftId}:`, e)
            }
          }
          
          externalNFTs.push({
            id: nftId,
            name,
            description,
            image: image || '/placeholder.svg',
            price: priceSUI,
            isListed: true,
            isExternal: true,
          })
          
          console.log(`✅ Added NFT: ${name}`)
        } catch (e) {
          console.warn('Failed to process event:', e)
        }
      }
      
      setNfts(externalNFTs)
      console.log(`\n✅ Loaded ${externalNFTs.length} external NFTs`)
    } catch (error) {
      console.error('❌ Failed to load NFTs by type path:', error)
      setNfts([])
    } finally {
      setLoading(false)
    }
  }

  const loadExternalMarketplaceNFTs = async (packageId: string, marketplaceId?: string) => {
    try {
      console.log(`\n📦 Querying external marketplace`)
      console.log(`Package ID: ${packageId}`)
      if (marketplaceId) console.log(`Marketplace ID: ${marketplaceId}`)
      
      const externalNFTs: any[] = []
      
      // If marketplace ID is provided, query its dynamic fields directly
      if (marketplaceId) {
        try {
          console.log(`🔍 Querying marketplace object dynamic fields...`)
          
          // Get dynamic fields (listings) from the marketplace
          let cursor = null
          let hasNextPage = true
          
          while (hasNextPage) {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: marketplaceId,
              cursor,
              limit: 50,
            })
            
            console.log(`Found ${dynamicFields.data.length} dynamic fields`)
            
            for (const field of dynamicFields.data) {
              try {
                const fieldObj = await suiClient.getDynamicFieldObject({
                  parentId: marketplaceId,
                  name: field.name,
                })
                
                if (!fieldObj.data) continue
                
                const content: any = fieldObj.data.content
                if (!content || !('fields' in content)) continue
                
                const fields = content.fields as any
                const rawNftId = fields.nft_id || fields.nft || fields.object || ''
                
                let nftId = ''
                let nftData: any = null
                
                // Handle nested NFT object structure
                if (typeof rawNftId === 'object' && rawNftId !== null) {
                  if (rawNftId.fields && rawNftId.fields.id && rawNftId.fields.id.id) {
                    nftId = rawNftId.fields.id.id
                    nftData = rawNftId.fields
                  } else if (rawNftId.id) {
                    nftId = rawNftId.id
                  }
                } else {
                  nftId = String(rawNftId)
                }
                
                if (!nftId) continue
                
                const price = fields.price ? String(fields.price) : undefined
                const priceSUI = price ? (Number(price) / 1e9).toFixed(2) : undefined
                
                let name = 'NFT'
                let description = ''
                let image = ''
                
                // Use embedded NFT data if available
                if (nftData) {
                  name = nftData.name || 'NFT'
                  description = nftData.description || ''
                  image = nftData.url || nftData.image_url || ''
                }
                
                // Fetch NFT object if we don't have full data
                if (!image) {
                  try {
                    const nftObj = await suiClient.getObject({
                      id: nftId,
                      options: { showContent: true, showDisplay: true },
                    })
                    
                    const display = nftObj.data?.display?.data
                    const nftContent = nftObj.data?.content as any
                    name = display?.name || name
                    description = display?.description || description
                    image = display?.image_url || display?.image || ''
                    
                    if (!image && nftContent && 'fields' in nftContent) {
                      const nf = nftContent.fields as any
                      image = nf.url || nf.image_url || ''
                    }
                  } catch (e) {
                    console.warn(`Failed to fetch NFT ${nftId}:`, e)
                  }
                }
                
                externalNFTs.push({
                  id: nftId,
                  name,
                  description,
                  image: image || '/placeholder.svg',
                  price: priceSUI,
                  isListed: true,
                  isExternal: true,
                })
                
                console.log(`✅ Added NFT: ${name}`)
              } catch (e) {
                console.warn("Failed to process dynamic field:", e)
              }
            }
            
            cursor = dynamicFields.nextCursor
            hasNextPage = dynamicFields.hasNextPage
          }
          
          setNfts(externalNFTs)
          console.log(`\n✅ Loaded ${externalNFTs.length} NFTs from marketplace object`)
          setLoading(false)
          return
        } catch (e) {
          console.error("Failed to query marketplace object, falling back to events:", e)
        }
      }
      
      // Fallback: Query events
      console.log(`🔍 Querying events for package: ${packageId}`)
      
      let listingEvents: any = null
      
      try {
        // Query all events from this package
        const allEvents = await suiClient.queryEvents({
          query: { Transaction: packageId },
          limit: 50,
        })
        
        console.log(`Found ${allEvents.data.length} total events from package`)
        
        // Look for ListNFTEvent or similar listing events
        const listingEventData = allEvents.data.filter((event: any) => {
          const eventType = event.type
          return eventType.includes('ListNFT') || 
                 eventType.includes('List') || 
                 eventType.includes('list')
        })
        
        if (listingEventData.length > 0) {
          console.log(`✅ Found ${listingEventData.length} listing events`)
          listingEvents = { data: listingEventData }
        }
      } catch (e) {
        console.log("Could not query by transaction, trying module names...")
      }
      
      // If the above didn't work, try specific module names
      if (!listingEvents || listingEvents.data.length === 0) {
        const possibleModuleNames = ['nft_marketplace', 'marketplace', 'nft', 'main']
        
        for (const moduleName of possibleModuleNames) {
          try {
            console.log(`🔍 Trying module: ${moduleName}`)
            const events = await suiClient.queryEvents({
              query: {
                MoveEventType: `${packageId}::${moduleName}::ListNFTEvent`
              },
              limit: 50,
            })
            
            if (events.data.length > 0) {
              listingEvents = events
              console.log(`✅ Found ${events.data.length} events with module: ${moduleName}`)
              break
            }
          } catch (e) {
            continue
          }
        }
      }
      
      if (!listingEvents || listingEvents.data.length === 0) {
        console.log(`⚠️ No listing events found for package ${packageId}`)
        setNfts([])
        setLoading(false)
        return
      }
      
      console.log(`Processing ${listingEvents.data.length} listing events`)
      
      // Process events and add to externalNFTs array
      
      for (const event of listingEvents.data) {
        try {
          const parsedJson = event.parsedJson as any
          const listingId = parsedJson?.listing_id
          
          if (!listingId) continue
          
          // Fetch the listing object
          const listingObj = await suiClient.getObject({
            id: listingId,
            options: { showContent: true, showType: true },
          })
          
          if (!listingObj.data) continue
          
          const listingContent: any = listingObj.data.content
          if (!listingContent || !('fields' in listingContent)) continue
          
          const fields = listingContent.fields as any
          const rawNftId = fields.nft_id || fields.nft || fields.object || ''
          
          let nftId = ''
          let nftData: any = null
          
          // Handle nested NFT object structure
          if (typeof rawNftId === 'object' && rawNftId !== null) {
            if (rawNftId.fields && rawNftId.fields.id && rawNftId.fields.id.id) {
              nftId = rawNftId.fields.id.id
              nftData = rawNftId.fields
            } else if (rawNftId.id) {
              nftId = rawNftId.id
            }
          } else {
            nftId = String(rawNftId)
          }
          
          if (!nftId) continue
          
          const price = fields.price ? String(fields.price) : undefined
          const priceSUI = price ? (Number(price) / 1e9).toFixed(2) : undefined
          
          let name = 'NFT'
          let description = ''
          let image = ''
          
          // Use embedded NFT data if available
          if (nftData) {
            name = nftData.name || 'NFT'
            description = nftData.description || ''
            image = nftData.url || nftData.image_url || ''
          } else {
            // Fallback: fetch NFT object
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
            } catch (e) {
              console.warn(`Failed to fetch NFT ${nftId}:`, e)
            }
          }
          
          externalNFTs.push({
            id: nftId,
            name,
            description,
            image: image || '/placeholder.svg',
            price: priceSUI,
            isListed: true,
            isExternal: true,
          })
          
          console.log(`✅ Added external NFT: ${name}`)
        } catch (e) {
          console.warn("Failed to process event:", e)
        }
      }
      
      setNfts(externalNFTs)
      console.log(`\n✅ Loaded ${externalNFTs.length} external NFTs`)
    } catch (error) {
      console.error("❌ Failed to load external marketplace NFTs:", error)
      setNfts([])
    } finally {
      setLoading(false)
    }
  }

  const loadNFTs = async () => {
    // For external package exploration, we don't need account
    if (!isExploringExternal && !account?.address) return

    try {
      setLoading(true)
      
      // If type path is provided, use it to query listings
      if (nftTypePath) {
        console.log("=== 🌐 EXPLORING BY TYPE PATH ===")
        console.log("Type Path:", nftTypePath)
        await loadNFTsByTypePath(nftTypePath)
        return
      }
      
      // If exploring external marketplace, show listed NFTs from that package
      if (isExploringExternal && externalPackageId) {
        console.log("=== 🌐 EXPLORING EXTERNAL MARKETPLACE ===")
        console.log("Package ID:", externalPackageId)
        await loadExternalMarketplaceNFTs(externalPackageId, externalMarketplaceId || undefined)
        return
      }
      
      // Otherwise, load user's own NFTs
      console.log("=== 🔍 STARTING NFT FETCH ===")
      console.log("Wallet Address:", account?.address)
      console.log("Package ID:", CONTRACTPACKAGEID)
      console.log("Module Name:", CONTRACTMODULENAME)
      
      // Step 1: Fetch ALL owned objects first
      console.log("\n=== Step 1: Fetching ALL owned objects ===")
      const allOwnedObjects = await suiClient.getOwnedObjects({
        owner: account!.address,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        },
      })
      
      console.log(`Total objects owned: ${allOwnedObjects.data.length}`)
      
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

  if (!account && !isExploringExternal) {
    return (
      <main className="min-h-screen bg-background">
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
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        {isExploringExternal ? (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                ← Back to Home
              </Link>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              External Marketplace
            </h1>
            {nftTypePath ? (
              <p className="text-muted-foreground">
                NFT Type: <span className="font-mono text-sm break-all">{nftTypePath}</span>
              </p>
            ) : externalPackageId ? (
              <p className="text-muted-foreground">
                Package ID: <span className="font-mono text-sm">{externalPackageId}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                My NFTs
              </h1>
              <p className="text-muted-foreground">Your digital collectible collection</p>
            </div>
            <button
              onClick={loadNFTs}
              disabled={loading}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-50 transition-opacity text-sm font-medium"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground">Loading your NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              {isExploringExternal ? (
                <p className="text-muted-foreground mb-6">No NFTs listed in this marketplace</p>
              ) : (
                <>
                  <p className="text-muted-foreground mb-6">You don't have any NFTs yet</p>
                  <Link
                    to="/mint"
                    className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 px-8 py-3 text-primary-foreground font-medium transition-colors"
                  >
                    Create Your First NFT
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <div key={nft.id} className="space-y-3">
                <NFTCard
                  {...nft}
                  onList={nft.isFromThisPackage && !nft.isExternal ? () => setOpenListForId((prev) => (prev === nft.id ? null : nft.id)) : undefined}
                  listButtonText={openListForId === nft.id ? "Cancel" : "List for Sale"}
                  onUpdateDescription={nft.isFromThisPackage && !nft.isExternal ? (newDesc) => updateNFTDescription(nft.id, newDesc) : undefined}
                  canEdit={nft.isFromThisPackage && !nft.isExternal}
                />
                
                {/* Show info for external marketplace NFTs */}
                {nft.isExternal && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      🌐 External Marketplace NFT
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This NFT is from another marketplace - View only
                    </p>
                  </div>
                )}
                
                {/* Show warning for NFTs from other packages (but same marketplace) */}
                {!nft.isFromThisPackage && !nft.isExternal && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      ⚠️ From external collection - View only
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cannot list, burn, or edit NFTs from other packages
                    </p>
                  </div>
                )}
                
                {openListForId === nft.id && nft.isFromThisPackage && !nft.isExternal && (
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
                
                {/* Only show burn button for NFTs from this package and not external */}
                {nft.isFromThisPackage && !nft.isExternal && (
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