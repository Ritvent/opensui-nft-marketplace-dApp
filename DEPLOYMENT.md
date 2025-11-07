# 🚀 Deployment Guide

This guide covers deploying your NFT Marketplace to production.

## 📋 Pre-Deployment Checklist

### 1. Smart Contract Deployment
- [ ] Deploy your Move contract to Sui mainnet
- [ ] Note down the Package ID
- [ ] Note down the Marketplace shared object ID
- [ ] Test all contract functions on testnet first

### 2. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in production contract addresses
- [ ] Set correct network (`mainnet`)
- [ ] Set admin wallet address
- [ ] Remove all console.log statements (optional)

### 3. Code Quality
- [ ] Run `npm run lint` - No errors
- [ ] Run `npm run type-check` - No TypeScript errors
- [ ] Test all features on testnet
- [ ] Review security considerations

## 🏗️ Build Process

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Create production .env
cp .env.example .env

# Edit with your production values
nano .env  # or use your preferred editor
```

**Production `.env` example:**
```env
VITE_SUI_NETWORK=mainnet
VITE_CONTRACT_PACKAGE_ID=0x... # Your mainnet package ID
VITE_CONTRACT_MODULE_NAME=nft_marketplace
VITE_CONTRACT_MARKETPLACE_ID=0x... # Your mainnet marketplace ID
VITE_ADMIN_ADDRESS=0x... # Admin wallet address
```

### 3. Build for Production
```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### 4. Test Production Build Locally
```bash
npm run preview
```

Visit `http://localhost:4173` to test the production build.

## 🌐 Deployment Options

### Option 1: Vercel (Recommended)

**Quick Deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**Manual Steps:**

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Set Environment Variables**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add all variables from your `.env` file
- Redeploy for changes to take effect

**Vercel Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Option 2: Netlify

1. **Install Netlify CLI**
```bash
npm install -g netlify-cli
```

2. **Build**
```bash
npm run build
```

3. **Deploy**
```bash
netlify deploy --prod --dir=dist
```

4. **Set Environment Variables**
- Go to Netlify Dashboard → Site Settings → Environment Variables
- Add all `VITE_*` variables

**Netlify Configuration** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: GitHub Pages

1. **Install gh-pages**
```bash
npm install -D gh-pages
```

2. **Add to package.json**
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "homepage": "https://yourusername.github.io/your-repo-name"
}
```

3. **Deploy**
```bash
npm run deploy
```

4. **Configure GitHub**
- Go to Repository → Settings → Pages
- Source: `gh-pages` branch
- Set environment variables in GitHub Actions secrets

### Option 4: Custom Server (VPS)

**Using Nginx:**

1. **Build**
```bash
npm run build
```

2. **Upload dist folder to server**
```bash
scp -r dist/* user@your-server:/var/www/nft-marketplace/
```

3. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/nft-marketplace;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

4. **Enable SSL with Let's Encrypt**
```bash
sudo certbot --nginx -d your-domain.com
```

## 🔐 Security Considerations

### Environment Variables
- ✅ **NEVER commit `.env` to git**
- ✅ Always use `.env.example` as template
- ✅ Set environment variables in deployment platform
- ✅ Rotate admin keys regularly

### Contract Security
- ✅ Audit Move contract before mainnet deployment
- ✅ Test all functions thoroughly on testnet
- ✅ Set reasonable fee percentages (2-5%)
- ✅ Implement rate limiting if needed

### Frontend Security
- ✅ Validate all user inputs
- ✅ Sanitize NFT metadata (names, descriptions)
- ✅ Check wallet connection before transactions
- ✅ Display clear error messages

## 📊 Post-Deployment

### 1. Verify Deployment
- [ ] Visit your deployed URL
- [ ] Connect wallet
- [ ] Test minting an NFT
- [ ] Test listing/buying flow
- [ ] Verify admin dashboard (as admin)
- [ ] Check all pages load correctly

### 2. Monitor Performance
- Set up error tracking (Sentry, LogRocket)
- Monitor RPC usage
- Track transaction success rates
- Monitor gas costs

### 3. Domain Setup (Optional)
```bash
# For Vercel
vercel domains add your-domain.com

# For Netlify
netlify domains:add your-domain.com
```

### 4. Analytics (Optional)
```bash
# Add Google Analytics or Plausible
# Add to index.html or use React Helmet
```

## 🔄 Updates and Maintenance

### Deploying Updates

1. **Make changes**
2. **Test locally**
```bash
npm run dev
```

3. **Build**
```bash
npm run build
```

4. **Deploy**
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod --dir=dist

# GitHub Pages
npm run deploy
```

### Contract Updates

If you update your Move contract:

1. Deploy new contract version
2. Update `.env` with new addresses
3. Rebuild and redeploy frontend
4. Test thoroughly before promoting

## 🐛 Troubleshooting

### "Cannot read environment variables"
- Ensure all `VITE_*` variables are set in deployment platform
- Rebuild after adding environment variables

### "Network error" or "RPC error"
- Check network setting (testnet vs mainnet)
- Verify contract addresses are correct
- Consider using custom RPC URL for better reliability

### "Transaction failed"
- Ensure users have sufficient SUI for gas
- Verify contract addresses
- Check Move contract is deployed correctly

### CORS errors
- Most platforms handle this automatically
- For custom servers, configure CORS in nginx/apache

## 📈 Performance Optimization

### 1. Asset Optimization
```bash
# Images
npm install -D vite-plugin-imagemin

# Bundle analysis
npm install -D rollup-plugin-visualizer
```

### 2. Caching Strategy
- Set proper cache headers
- Use CDN for static assets
- Implement service workers (optional)

### 3. RPC Optimization
- Use custom RPC endpoint for production
- Implement request rate limiting
- Cache blockchain queries where possible

## 🔗 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)
- [Sui Mainnet Info](https://docs.sui.io/guides/developer/getting-started/connect)

---

**Need help?** Check the main [README.md](./README.md) or ask in [Sui Discord](https://discord.gg/sui)
