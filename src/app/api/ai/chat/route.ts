import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AI_DISCLAIMER } from '@/lib/ai/prompts';

interface PositionData {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gain: number;
  gainPercent: number;
  unit?: string;
}

function formatPortfolioContext(positions: PositionData[], totalValue: number, totalGain: number, totalGainPercent: number, portfolioName?: string): string {
  if (!positions || positions.length === 0) {
    return 'The user has no positions in their portfolio yet.';
  }

  const positionsList = positions.map(p => {
    const gainSign = p.gain >= 0 ? '+' : '';
    const unitStr = p.unit && p.unit !== 'units' ? ` ${p.unit}` : ' shares';
    return `- ${p.symbol} (${p.name}): ${p.quantity}${unitStr} @ $${p.avgCost.toFixed(2)} avg cost, current price $${p.currentPrice.toFixed(2)}, value $${p.marketValue.toFixed(2)}, ${gainSign}$${p.gain.toFixed(2)} (${gainSign}${p.gainPercent.toFixed(1)}%)`;
  }).join('\n');

  const gainSign = totalGain >= 0 ? '+' : '';

  return `Portfolio "${portfolioName || 'My Portfolio'}":
Total Value: $${totalValue.toFixed(2)}
Total Gain/Loss: ${gainSign}$${totalGain.toFixed(2)} (${gainSign}${totalGainPercent.toFixed(1)}%)

Positions:
${positionsList}`;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, positions = [], totalValue = 0, totalGain = 0, totalGainPercent = 0, portfolioName, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message required' }, { status: 400 });
    }

    // Get API key from header (sent from frontend localStorage) or fall back to env
    const apiKeyFromHeader = request.headers.get('x-openai-key');
    const apiKey = apiKeyFromHeader || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY in Settings to use the AI chat feature.',
        requiresSetup: true,
      }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    const portfolioContext = formatPortfolioContext(positions, totalValue, totalGain, totalGainPercent, portfolioName);

    const systemPrompt = `You are an expert AI investment advisor assistant. You have access to the user's current portfolio and can provide personalized advice.

CURRENT PORTFOLIO DATA:
${portfolioContext}

GUIDELINES:
1. Be specific with numbers - reference actual positions and values from the portfolio
2. Provide actionable insights based on their holdings
3. Consider diversification, risk, and correlation between assets
4. For buy/sell questions, explain your reasoning with specifics
5. Keep responses concise but informative (2-3 paragraphs max)
6. If asked about a stock not in their portfolio, still provide helpful analysis
7. Consider the user's apparent risk tolerance based on their holdings
8. Mention any concentration risks or overexposure
9. For commodities (gold, silver), consider them as hedges against market volatility

IMPORTANT: This is educational information only, not financial advice. Always encourage users to do their own research.`;

    // Build messages array with conversation history
    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (excluding the initial greeting)
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: ConversationMessage) => {
        if (msg.content && !msg.content.includes("Hello! I'm your AI investment advisor")) {
          apiMessages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current message
    apiMessages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try again.";

    return NextResponse.json({
      success: true,
      response: responseText + '\n\n---\n' + AI_DISCLAIMER.trim(),
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: `AI chat failed: ${errorMessage}. Please check your OpenAI API key and try again.`,
    }, { status: 500 });
  }
}
