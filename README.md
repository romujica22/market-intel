# Market Intel

SEC + AI Company Research Dashboard — powered by Claude.

## Deploy to Railway (recommended, free tier)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `ANTHROPIC_API_KEY=your_key_here`
5. Railway auto-detects Node and runs `npm start`
6. Done — your app is live at a public URL

## Deploy to Render (alternative, free tier)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable: `ANTHROPIC_API_KEY=your_key_here`
6. Deploy

## Run locally

```bash
npm install
cp .env.example .env
# Add your Anthropic API key to .env
npm start
# Open http://localhost:3000
```

## How it works

- `server.js` — Express server with two streaming endpoints:
  - `POST /api/brief` — single company intelligence brief
  - `POST /api/industry` — industry synthesis
- `public/index.html` — full dashboard frontend
- Financial data is embedded (SEC filings through early 2025)
- AI analysis streams token-by-token directly into the UI

## Getting your Anthropic API key

Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
