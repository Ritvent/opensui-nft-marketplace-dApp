import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit"
import { useState } from "react"
import { Loader2, Upload, Zap } from "lucide-react"
import { Transaction } from "@mysten/sui/transactions"
import { CONTRACTMODULEMETHOD, CONTRACTMODULENAME, CONTRACTPACKAGEID } from '../configs/constants'
import { useNavigate } from "react-router-dom"

export default function MintPage() {
  const account = useCurrentAccount()
  const navigate = useNavigate()
  const suiClient = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    price: "",
  })
  const [mintedNftId, setMintedNftId] = useState<string | null>(null)

  if (!account) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
            <p className="text-muted-foreground">You need to connect a Sui wallet to mint NFTs</p>
          </div>
        </div>
      </main>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return

    setLoading(true)
    setMintedNftId(null)

    try {
      const txb = new Transaction()
      const contractAddress = CONTRACTPACKAGEID
      const contractModuleName = CONTRACTMODULENAME
      const contractMethod = CONTRACTMODULEMETHOD

      txb.moveCall({
        target: `${contractAddress}::${contractModuleName}::${contractMethod}`,
        arguments: [
          txb.pure.string(formData.name),
          txb.pure.string(formData.description),
          txb.pure.string(formData.imageUrl)
        ],
      })

      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: async ({ digest }) => {
            try {
              const { effects } = await suiClient.waitForTransaction({
                digest: digest,
                options: {
                  showEffects: true,
                },
              })

              if (effects?.created?.[0]?.reference?.objectId) {
                setMintedNftId(effects.created[0].reference.objectId)
                setFormData({
                  name: "",
                  description: "",
                  imageUrl: "",
                  price: "",
                })
                
                // Navigate to my-nfts after successful mint
                setTimeout(() => {
                  navigate("/my-nfts")
                }, 2000)
              }
            } finally {
              setLoading(false)
            }
          },
          onError: () => {
            setLoading(false)
          }
        },
      )
    } catch (error) {
      console.error("Mint failed:", error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6 sm:py-8 lg:py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create & Mint NFT
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Mint your unique digital collectible on Sui</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {/* NFT Details Section */}
            <div className="rounded-lg bg-card border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                NFT Details
              </h2>

              {/* NFT Name */}
              <div>
                <label className="block text-sm font-medium mb-2">NFT Name *</label>
                <Input
                  placeholder="e.g., Cosmic Nebula #001"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  placeholder="Describe your NFT's story, inspiration, and unique features..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                  required
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Image URL *
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="bg-background border-border"
                  required
                />
                {formData.imageUrl && (
                  <div className="mt-4 relative w-full h-64 rounded-lg overflow-hidden bg-muted border border-border">
                    <img
                      src={formData.imageUrl || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {mintedNftId && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <p className="text-green-500 font-semibold mb-2">NFT Minted Successfully!</p>
                <p className="text-sm text-muted-foreground">Object ID: {mintedNftId}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.name ||
                !formData.description ||
                !formData.imageUrl
              }
              className="w-full bg-primary hover:bg-primary/90 py-5 sm:py-6 text-base sm:text-lg font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Creating NFT...
                </>
              ) : (
                <>
                  <Zap className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                  Mint NFT
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}

