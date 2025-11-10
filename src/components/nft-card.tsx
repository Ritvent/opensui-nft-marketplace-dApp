import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit2, Check, X } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"

interface NFTCardProps {
  id: string
  name: string
  description: string
  image: string
  price?: string
  isListed?: boolean
  creator?: string
  collection?: string
  onBuy?: () => void
  onList?: () => void
  onDelist?: () => void
  showDelist?: boolean
  onUpdateDescription?: (newDescription: string) => void
  canEdit?: boolean
  listButtonText?: string
}

export function NFTCard({
  id: _id,
  name,
  description,
  image,
  price,
  isListed,
  creator,
  collection,
  onBuy,
  onList,
  onDelist,
  showDelist,
  onUpdateDescription,
  canEdit,
  listButtonText = "List for Sale",
}: NFTCardProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [newDescription, setNewDescription] = useState(description)

  const handleSaveDescription = () => {
    if (onUpdateDescription && newDescription.trim()) {
      onUpdateDescription(newDescription.trim())
      setIsEditingDesc(false)
    }
  }

  const handleCancelEdit = () => {
    setNewDescription(description)
    setIsEditingDesc(false)
  }

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-300 fade-in glow-accent hover:glow-purple shadow-lg hover:shadow-xl">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        <img
          src={image || "/placeholder.svg"}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        {isListed && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary text-primary-foreground font-medium">Listed</Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground truncate text-balance">{name}</h3>
          {isEditingDesc ? (
            <div className="flex gap-2 mt-2">
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="text-sm"
                placeholder="Enter new description..."
              />
              <button
                onClick={handleSaveDescription}
                className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
              >
                <Check className="w-4 h-4 text-primary" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30 transition-colors"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="text-sm text-muted-foreground truncate flex-1">{description}</p>
              {canEdit && (
                <button
                  onClick={() => setIsEditingDesc(true)}
                  className="p-1 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                >
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
        </div>

        {(creator || collection) && (
          <div className="flex gap-2 text-xs">
            {creator && <span className="text-muted-foreground">{isListed ? 'Listed by' : 'By'} {creator}</span>}
            {collection && <span className="text-primary/70">{collection}</span>}
          </div>
        )}

        {price && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <p className="text-xl font-bold text-primary">{price} SUI</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isListed && showDelist && onDelist && (
            <Button onClick={onDelist} variant="outline" className="flex-1 font-medium bg-transparent border-destructive text-destructive hover:bg-destructive/10">
              Delist
            </Button>
          )}
          {isListed && onBuy && !showDelist && (
            <Button onClick={onBuy} className="flex-1 bg-primary hover:bg-primary/90 font-medium">
              Buy Now
            </Button>
          )}
          {!isListed && onList && (
            <Button onClick={onList} variant="outline" className="flex-1 font-medium bg-transparent">
              {listButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

