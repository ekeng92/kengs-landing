# Deploying Keng's Landing Dashboard

## Option A: Cloudflare Pages (Recommended — Free)

### One-Time Setup
1. Create a Cloudflare account at cloudflare.com (free)
2. Install Wrangler CLI: `npm install -g wrangler`
3. Login: `wrangler login`
4. (Optional) Buy a domain: ~$12/year at Cloudflare Registrar

### Deploy
```bash
cd finances/dashboard
npm run build
npx wrangler pages deploy dist --project-name=kengs-landing
```

The first deploy creates the project. Subsequent deploys update it.

**Free URL**: `kengs-landing.pages.dev`
**Custom domain**: Add in Cloudflare Pages dashboard → Custom Domains

### Auto-Deploy from Git (Optional)
Connect your GitHub repo in Cloudflare Pages dashboard:
- Build command: `cd finances/dashboard && npm run build`
- Build output: `finances/dashboard/dist`
- Every push to `main` auto-deploys

## Option B: GitHub Pages (Free, Simpler)

1. Run `npm run build`
2. Push `dist/` contents to a `gh-pages` branch
3. Enable GitHub Pages in repo settings
4. URL: `ekeng92.github.io/kengs-landing`

## Option C: Self-Host from Home (Not Recommended)

Possible with:
- Raspberry Pi + Nginx + DuckDNS (free dynamic DNS)
- Port forward 80/443 on router
- Let's Encrypt for HTTPS

**Why not**: ISP may block ports, IP changes, power outages = downtime, security risk. Cloud hosting is free and better.

## Data Privacy Note

The dashboard runs 100% client-side. No data is sent to any server.
Financial data lives in the browser's localStorage on whatever device
accesses the site. The PIN gate prevents casual access but is not
bank-grade security — treat the URL as semi-private.
