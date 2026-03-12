import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AI_DISCLAIMER } from '@/lib/ai/prompts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskTolerance = searchParams.get('risk') || 'moderate';
    const investmentHorizon = searchParams.get('horizon') || 'medium';

    // Get API key from header (sent from frontend localStorage) or fall back to env
    const apiKeyFromHeader = request.headers.get('x-openai-key');
    const apiKey = apiKeyFromHeader || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY in Settings to get AI-powered stock recommendations.',
        requiresSetup: true,
      }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    const prompt = generateRecommendationPrompt(riskTolerance, investmentHorizon);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior financial advisor with expertise in equity research and portfolio management.
Provide stock recommendations based on fundamental analysis, market trends, and growth potential.
Always consider risk management and diversification principles.
Respond in valid JSON format only.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content;
    let recommendationsData;

    try {
      recommendationsData = JSON.parse(responseText || '{}');
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response. Please try again.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...recommendationsData,
        generatedAt: new Date(),
        riskTolerance,
        investmentHorizon,
      },
      disclaimer: AI_DISCLAIMER,
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate recommendations. Please check your OpenAI API key and try again.',
    }, { status: 500 });
  }
}

function generateRecommendationPrompt(riskTolerance: string, horizon: string): string {
  return `As a financial advisor, provide stock recommendations for an investor with:
- Risk Tolerance: ${riskTolerance}
- Investment Horizon: ${horizon} term

Analyze current market conditions and provide:

1. Top 5 stock recommendations with high growth potential
2. Sector analysis for the top 4 sectors

For each stock recommendation, include:
- Symbol and company name
- Sector
- Current estimated price and target price
- Upside percentage
- Rating (strong_buy, buy, or hold)
- Confidence level (1-100)
- Brief reasoning (2-3 sentences)
- Key metrics (P/E ratio, market cap, dividend yield if applicable, growth rate)
- Risk level (low, medium, high)
- Suggested time horizon

For each sector analysis, include:
- Sector name
- Market outlook (bullish, neutral, bearish)
- Score (1-10)
- Top pick symbol
- Brief reasoning

Response format:
{
  "recommendations": [...],
  "sectorAnalysis": [...],
  "marketSummary": "Brief overall market outlook",
  "investmentThesis": "Key investment theme for current conditions"
}`;
}
