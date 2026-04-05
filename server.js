import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.post('/api/brief', async (req, res) => {
  const { ticker, name, filingInfo, financials } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const finCtx = financials?.length
    ? `REPORTED FINANCIALS FROM SEC FILINGS:\n` + financials.map(f =>
        `${f.metric}: ${f.periods.map(p => `${p.label}: ${p.value}`).join(' | ')}`
      ).join('\n')
    : '';

  const filingCtx = filingInfo
    ? `Latest filing: ${filingInfo.form} | Period end: ${filingInfo.period_end} | Filed: ${filingInfo.filed} | FY ends: ${filingInfo.fy_end}`
    : '';

  const prompt = `You are a senior equity analyst. Write a structured intelligence brief for ${name} (${ticker}).

${filingCtx}
${finCtx}

Using the data above and your knowledge through early 2025:

**FINANCIAL PEQFOPMANCE**
Analyze revenue trajectory (cite growth %), margin trends, EPS direction, cash generation.

**BUSINESS OVERVIEW**
2-3 sentences: business model, market position, primary revenue drivers.

**KEY RISKS**
1. [Specific risk]
2. [Specific risk]
3. [Specific risk]

**GROWTH CATALYSTS**
1. [Specific catalyst]
2. [Specific catalyst]
3. [Specific catalyst]

**BOTTOM LINE**
One direct sentence on trajectory.

Be specific with numbers. No generic filler.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
  } finally { res.end(); }
});

app.post('/api/industry', async (req, res) => {
  const { industryName, companies } = req.body;
  if (!industryName || !companies?.length) return res.status(400).json({ error: 'industryName and companies required' });
  const briefs = companies.map(c => `${c.ticker} (${c.name}): Rev ${c.latestRev || '—'} | NI ${c.latestNI || '—'} | Rev Growth ${c.revGrow || '—'} | Margin ${c.margin || '—'} | EPS Growth ${c.epsGrow || '—'}`).join('\n');
  const prompt = `You are a portfolio manager. Synthesize these company snapshots for ${industryName}.\n \n${briefs}\n\n**INDUSTRY PULSE**\n2-3 sentences on sector health.\n\n**DOMINANT THEMES**\nTop 2-3 themes.\n\n)]**LEADERS VS. LAGGARDS**\nSpecific companies and why.\n\n**INVESTMENT ANGLE**\nBest risk/reward in this sector.`;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const stream = client.messages.stream({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (e) { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); }
  finally { res.end(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Market Intel running on port ${PORT}`));
