import { Header } from "@/components/header"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { CONTRACTPACKAGEID, CONTRACTMODULENAME } from "@/configs/constants"

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

export default function Home() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const navigate = useNavigate()
  const [listings, setListings] = useState<ListingItem[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [packageSearch, setPackageSearch] = useState("")
  const [copied, setCopied] = useState(false);

  // Load listings from blockchain
  useEffect(() => {
    loadListings()
  }, [])

  // Slideshow auto-advance - resets when currentSlide changes (including manual navigation)
  useEffect(() => {
    if (listings.length === 0) return
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % listings.length)
    }, 3000) // Change slide every 3 seconds

    return () => clearInterval(interval)
  }, [listings.length, currentSlide])

  const handleMarketplaceSearch = () => {
    if (packageSearch.trim()) {
      // Navigate to MyNFTs with the full type path as a query parameter
      navigate(`/my-nfts?type=${encodeURIComponent(packageSearch.trim())}`)
    }
  }

  const loadListings = async () => {
    setLoading(true)
    try {
      console.log("🏠 Loading listings for hero slideshow...")
      
      // Query for all ListNFTEvent events
      const listingEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::ListNFTEvent`
        },
        limit: 50,
      })

      console.log(`Found ${listingEvents.data.length} listing events`)

      const loadedListings: ListingItem[] = []

      // Process each event to get listing details
      for (const event of listingEvents.data) {
        try {
          const parsedJson = event.parsedJson as any
          const listingId = parsedJson?.listing_id
          
          if (!listingId) {
            console.log("No listing_id in event, skipping")
            continue
          }

          console.log(`Fetching listing: ${listingId}`)
          
          // Try to fetch the listing object
          const listingObj = await suiClient.getObject({
            id: listingId,
            options: { showContent: true, showType: true }
          })

          // If listing doesn't exist, it was purchased or delisted
          if (!listingObj.data) {
            console.log(`Listing ${listingId} no longer exists (purchased/delisted)`)
            continue
          }

          // Extract listing fields
          if (listingObj.data?.content && 'fields' in listingObj.data.content) {
            const fields = listingObj.data.content.fields as any
            
            // Handle different NFT ID formats (could be string, object with 'id' field, or ID type)
            const rawNftId = fields.nft_id || fields.nft || fields.object || ''
            let nftId = ''
            let nftData: any = null
            
            if (typeof rawNftId === 'object' && rawNftId !== null) {
              // The contract stores the entire NFT object, not just the ID
              // Extract the ID from fields.id.id
              if (rawNftId.fields && rawNftId.fields.id && rawNftId.fields.id.id) {
                nftId = rawNftId.fields.id.id
                // We have the NFT data already!
                nftData = rawNftId.fields
                console.log(`  ✅ Found NFT data in listing object`)
              } else if (rawNftId.id) {
                nftId = rawNftId.id
              }
            } else {
              nftId = String(rawNftId)
            }
            
            const price = fields.price ? (Number(fields.price) / 1e9).toFixed(2) : '0'
            const seller = fields.seller
            const listingDescription = fields.description || ''

            console.log(`  NFT ID: ${nftId}, Price: ${price} SUI`)

            if (!nftId) {
              console.log(`  ⚠️ No NFT ID found in listing fields, skipping`)
              continue
            }

            let name = 'NFT'
            let description = ''
            let image = ''

            // Use the NFT data we already have from the listing
            if (nftData) {
              name = nftData.name || 'NFT'
              description = nftData.description || listingDescription || ''
              image = nftData.url || nftData.image_url || ''
              console.log(`  ✅ Using embedded NFT data: ${name}`)
            } else {
              // Fallback: Fetch the NFT object for display data
              try {
                const nftObj = await suiClient.getObject({
                  id: nftId,
                  options: { showContent: true, showDisplay: true }
                })

                const display = nftObj.data?.display?.data
                const nftContent = nftObj.data?.content && 'fields' in nftObj.data.content ? nftObj.data.content.fields as any : null

                name = display?.name || nftContent?.name || 'NFT'
                description = display?.description || nftContent?.description || listingDescription || 'No description'
                image = display?.image_url || display?.image || nftContent?.url || nftContent?.image_url || ''
                console.log(`  ✅ Fetched NFT data: ${name}`)
              } catch (error) {
                console.error(`  ❌ Failed to fetch NFT ${nftId}:`, error)
                continue
              }
            }

            console.log(`  ✅ Added: ${name}`)

            loadedListings.push({
              id: listingId,
              nftId,
              name,
              description,
              image: image || '/placeholder.svg',
              price,
              isListed: true,
              seller,
            })
          }
        } catch (error) {
          console.log(`  ⚠️ Error processing event:`, error)
        }
      }

      // Shuffle the listings for variety
      const shuffled = loadedListings.sort(() => Math.random() - 0.5)
      setListings(shuffled)
      console.log(`✅ Loaded ${shuffled.length} active listings for slideshow`)
      
      if (shuffled.length === 0) {
        console.log("⚠️ No active listings found")
      }
    } catch (error) {
      console.error("❌ Failed to load listings:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent text-balance">
                The Future of Digital Collectibles
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Mint, trade, and collect unique NFTs on the Sui blockchain. Experience lightning-fast transactions and
                low fees with our modern marketplace.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/explore">
                  <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                    Explore NFTs
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                {account ? (
                  <Link to="/mint">
                    <Button variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 bg-transparent">
                      Create NFT
                    </Button>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground pt-2">Connect wallet to create NFTs</p>
                )}
              </div>
            </div>

            {/* Hero Visual - NFT Slideshow */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full h-96">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl" />
                <div className="relative h-full w-full rounded-3xl bg-card border border-border/50 overflow-hidden glow-purple">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin text-4xl mb-4">◆</div>
                        <p className="text-muted-foreground">Loading NFTs...</p>
                      </div>
                    </div>
                  ) : listings.length > 0 ? (
                    <div className="relative h-full w-full">
                      {listings.map((listing, index) => (
                        <div
                          key={listing.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentSlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <img
                            src={listing.image}
                            alt={listing.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <h3 className="text-2xl font-bold mb-2">{listing.name}</h3>
                            <p className="text-sm text-gray-300 mb-3 line-clamp-2">{listing.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-primary">{listing.price} SUI</span>
                              <Link to="/explore">
                                <Button size="sm" className="bg-primary hover:bg-primary/90">
                                  View Details
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Navigation Buttons */}
                      <button
                        onClick={() => setCurrentSlide((prev) => (prev - 1 + listings.length) % listings.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setCurrentSlide((prev) => (prev + 1) % listings.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      
                      {/* Slide Indicators */}
                      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {listings.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentSlide 
                                ? 'bg-primary w-8' 
                                : 'bg-white/50 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">◆</div>
                        <p className="text-muted-foreground">No NFTs listed yet</p>
                        <p className="text-sm text-muted-foreground mt-2">Be the first to list!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Marketplace Explorer Section */}
        <section className="mb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Explore Other Marketplaces
            </h2>
            <p className="text-muted-foreground mb-8">
              Enter the NFT type path to discover Listed NFTs from other marketplaces on the Sui test network
            </p>
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Enter NFT type path"
                value={packageSearch}
                onChange={(e) => setPackageSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleMarketplaceSearch()
                  }
                }}
                className="flex-1 h-12 text-base bg-card border-border"
              />
              <Button
                onClick={handleMarketplaceSearch}
                disabled={!packageSearch.trim()}
                className="h-12 px-8 bg-primary hover:bg-primary/90"
              >
                <Search className="w-5 h-5 mr-2" />
                Explore
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Example:</span>
              <code 
                className="bg-muted px-3 py-1 rounded text-[10px] cursor-pointer hover:bg-muted/80 transition-colors break-all" 
                onClick={() => {
                  const exampleText = '0x038bf323b5b788f74879e0ea072e23f2817953770f6c6c3aba85870985171a9a::dian_nft_marketplace::DianChainNFT';
                  navigator.clipboard.writeText(exampleText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="Click to copy"
              >
                {'0x038bf323b5b788f74879e0ea072e23f2817953770f6c6c3aba85870985171a9a::dian_nft_marketplace::DianChainNFT'}
              </code>
              <button 
                onClick={() => {
                  const exampleText = '0x038bf323b5b788f74879e0ea072e23f2817953770f6c6c3aba85870985171a9a::dian_nft_marketplace::DianChainNFT';
                  navigator.clipboard.writeText(exampleText);
                  setPackageSearch(exampleText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-primary hover:text-primary/80 underline shrink-0"
              >
              </button>
              {copied && (
                <span className="text-purple-500 font-medium">Copied!</span>
              )}
            </div>
          </div>
        </section>
        {
        /* Stats Section  
        <section className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, i) => {
              const IconComponent = stat.icon
              return (
                <div
                  key={i}
                  className="p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors fade-in"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <IconComponent className="w-8 h-8 text-primary/60" />
                  </div>
                </div> 
              )
            })}
          </div>
        </section>
        */}
        
        {/* Features Section */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-12 text-center">Why Open SUI?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Powered by Sui blockchain for instant transactions",
              },
              {
                icon: "💰",
                title: "Low Fees",
                description: "Minimal transaction costs compared to other platforms",
              },
              {
                icon: "🔒",
                title: "Secure",
                description: "Built with industry-leading security standards",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-lg bg-card border border-border hover:border-primary transition-colors fade-in"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        {!account && (
          <section className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-border p-12 text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your Sui wallet to explore NFTs, create your own, and manage your collection.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}

