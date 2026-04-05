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

function sseStream(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

async function streamClaude(res, messages, maxTokens = 1024) {
  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages
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
}

// ─ Single company brief
app.post('/api/brief', async (req, res) => {
  const { ticker, name, filingInfo, financials } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
  sseStream(res);
  const finCtx = financials?.length ? `REPORTED FINANCIALS:\n` + financials.map(f =>
    `${f.metric}: ${f.periods.map(p => `${p.label}: ${p.value}`).join(' | ')}`
  ).join('\n') : '';
  const filingCtx = filingInfo ? `Latest filing: ${filingInfo.form} | Period end: ${filingInfo.period_end} | Filed: ${filingInfo.filed} | FY ends: ${filingInfo.fy_end}` : '';
  const prompt = `You are a senior equity analyst. Write a structured intelligence brief for ${name} (${ticker}).

${filingCtx}
${finCtx}

Using the data above and your knowledge through early 2026:

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
  await streamClaude(res, [{ role: 'user', content: prompt }]);
});

// ─ Industry synthesis
app.post('/api/industry', async (req, res) => {
  const { industryName, companies } = req.body;
  if (!industryName || !companies?.length) return res.status(400).json({ error: 'required' });
  sseStream(res);
  const briefs = companies.map(c => `${c.ticker} (${c.name}): Rev ${c.latestRev || '—'} | NI ${c.latestNI || '—'} | Rev Growth ${c.revGrow || '—'} | Margin ${c.margin || '—'}`).join('\n');
  const prompt = `You are a portfolio manager. Synthesize these ${industryName} company snapshots.\n\n${briefs}\n\n)]**INDUSTRY PULSE**\n2-3 sentences on sector health.\n\n)]**DOMINANT THEMES**\nTop 2-3 themes.\n\n)]**LEADERS VS. LAGGARDS**\nSpecific companies and why.\n\n**INVESTMENT ANGLE**\nBest risk/reward in this sector.`;
  await streamClaude(res, [{ role: 'user', content: prompt }], 800);
});

// ─ Interactive Q&A
app.post('/api/chat', async (req, res) => {
  const { ticker, name, financials, brief, question } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  sseStream(res);
  const finCtx = financials?.length ? financials.map(f => `${f.metric}: ${f.periods.map(p => `${p.label}: ${p.value}`).join(' | ')}`).join('\n') : '';
  const prompt = `You are a senior equity analyst with deep knowledge of ${name} (${ticker}).\n\nFINANCIAL DATA:\n${finCtx}\n\nBRIEF ALREADY GENERATED:\n${brief || 'Not yet generated.'}\n\nAnswer this question concisely and directly. Cite specific numbers where relevant. Use your knowledge through early 2026.\n\nQuestion: ${question}`;
  await streamClaude(res, [{ role: 'user', content: prompt }], 600);
});

// ─ Market news (web search)
app.post('/api/news', async (req, res) => {
  const { query, type } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  sseStream(res);
  const prompt = type === 'industry'
    ? `Search for the latest market news and sector developments for the ${query} industry from the past 30 days. Format as a list of 4-6 news items with 💘 emoji, each with a headline and 1-2 sentence summary. Include specific dates and numbers.`
    : `Search for the latest news, earnings, and analyst updates for ${query} from the past 30 days. Format as a list of 4-6 news items with 💘 emoji, each with a headline and 1-2 sentence summary. Include specific dates and numbers.`;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    });
    let fullText = '';
    for (const block of response.content) {
      if (block.type === 'text') fullText += block.text;
    }
    const words = fullText.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      res.write(`data: ${JSON.stringify({ text: words.slice(i, i+3).join(' ') + ' ' })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
  } finally { res.end(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Market Intel v2 running on port ${PORT}`));