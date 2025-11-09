import { Link } from "react-router-dom"
import { Github, Twitter, Mail } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">◆</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                OpenSUI
              </span>
            </div>
            <p className="text-sm text-muted-foreground">The premier NFT marketplace on Sui network</p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                  Explore
                </Link>
              </li>
              <li>
                <Link to="/mint" className="text-muted-foreground hover:text-foreground transition-colors">
                  Create
                </Link>
              </li>
              <li>
                <Link to="/my-nfts" className="text-muted-foreground hover:text-foreground transition-colors">
                  My Collection
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Connect</h3>
            <div className="flex gap-3">
              <a href="https://www.github.com/Ritvent" className="p-2 rounded-lg hover:bg-primary/10 transition-colors">
                <Github className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </a>
              <a href="#" className="p-2 rounded-lg hover:bg-primary/10 transition-colors">
                <Mail className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {currentYear} OpenSUI. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

