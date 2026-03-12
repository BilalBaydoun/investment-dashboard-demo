import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { spyChange, spyChangePercent, marketDirection } = await request.json();

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        insights: generateFallbackInsights(marketDirection, spyChange, spyChangePercent),
      });
    }

    // Get current date for context
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const prompt = `You are a financial market analyst. Today is ${dateStr}. The S&P 500 is ${marketDirection === 'up' ? 'up' : marketDirection === 'down' ? 'down' : 'flat'} ${Math.abs(spyChangePercent).toFixed(2)}% today.

Generate a brief market analysis in JSON format with these fields:
1. "summary": One sentence (max 100 chars) describing today's market action
2. "whyMoving": Array of 3 short reasons (max 50 chars each) explaining why markets are moving
3. "keyDrivers": Array of 3 objects with {sector, impact, reason} where:
   - sector: major sector name (Technology, Financials, Healthcare, Energy, Consumer, etc.)
   - impact: "positive", "negative", or "neutral"
   - reason: very short reason (max 30 chars)
4. "whatToExpect": One paragraph (max 150 chars) about what traders should watch for today

Be specific and actionable. Reference current market themes like Fed policy, earnings season, economic data, geopolitical events, or sector rotations. Keep it professional and concise.

Respond ONLY with valid JSON, no markdown or explanation.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a concise financial market analyst. Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        success: true,
        insights: generateFallbackInsights(marketDirection, spyChange, spyChangePercent),
      });
    }

    try {
      // Clean up the response (remove markdown if present)
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      const insights = JSON.parse(cleanContent);

      return NextResponse.json({
        success: true,
        insights: {
          ...insights,
          marketDirection,
          spyChange,
          spyChangePercent,
        },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json({
        success: true,
        insights: generateFallbackInsights(marketDirection, spyChange, spyChangePercent),
      });
    }
  } catch (error) {
    console.error('Market insights error:', error);
    return NextResponse.json({
      success: true,
      insights: generateFallbackInsights('flat', 0, 0),
    });
  }
}

function generateFallbackInsights(
  direction: string,
  change: number,
  changePercent: number
) {
  const isUp = direction === 'up';
  const isDown = direction === 'down';

  return {
    marketDirection: direction,
    spyChange: change,
    spyChangePercent: changePercent,
    summary: isUp
      ? 'Markets rally as investors show renewed optimism.'
      : isDown
      ? 'Stocks retreat amid profit-taking and cautious sentiment.'
      : 'Markets consolidate near recent levels.',
    whyMoving: isUp
      ? ['Strong economic indicators', 'Positive earnings surprises', 'Dovish Fed commentary']
      : isDown
      ? ['Profit-taking after gains', 'Economic data concerns', 'Rising yield pressures']
      : ['Mixed economic signals', 'Awaiting key data releases', 'Sector rotation underway'],
    keyDrivers: [
      { sector: 'Technology', impact: isUp ? 'positive' : isDown ? 'negative' : 'neutral', reason: isUp ? 'AI tailwinds' : 'Valuation concerns' },
      { sector: 'Financials', impact: 'neutral', reason: 'Rate path uncertain' },
      { sector: 'Energy', impact: isUp ? 'positive' : 'negative', reason: 'Oil volatility' },
    ],
    whatToExpect: isUp
      ? 'Watch for follow-through buying. Volume confirmation key for sustained move higher.'
      : isDown
      ? 'Monitor support levels. Oversold conditions may attract buyers.'
      : 'Range-bound action likely until clear catalyst emerges.',
  };
}
