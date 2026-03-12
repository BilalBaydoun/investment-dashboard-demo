import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateAnalysisPrompt, generateComprehensiveAnalysisPrompt, generatePortfolioAnalysisPrompt, AI_DISCLAIMER } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, symbol, quote, technicals, news, positions, totalValue, totalCost, screenerData, fundamentals, fairValue, earnings } = body;

    // Get API key from header (sent from frontend localStorage) or fall back to env
    const apiKeyFromHeader = request.headers.get('x-openai-key');
    const apiKey = apiKeyFromHeader || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY in Settings to enable AI analysis.',
        requiresSetup: true,
      }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    let prompt: string;
    switch (action) {
      case 'analyze':
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }
        // Use comprehensive analysis if we have Alpha Vantage data
        if (fundamentals || fairValue || earnings) {
          prompt = generateComprehensiveAnalysisPrompt(symbol, fundamentals, fairValue, earnings, news || []);
        } else if (quote) {
          prompt = generateAnalysisPrompt(symbol, quote, technicals, news || [], screenerData);
        } else {
          return NextResponse.json({ success: false, error: 'Quote or fundamentals required' }, { status: 400 });
        }
        break;

      case 'portfolio':
        if (!positions || positions.length === 0) {
          return NextResponse.json({ success: false, error: 'Positions required' }, { status: 400 });
        }
        prompt = generatePortfolioAnalysisPrompt(positions, totalValue, totalCost);
        break;

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Senior Portfolio Manager and Chartered Financial Analyst (CFA) with a Master's in Finance from Wharton.
You have 15+ years of experience managing institutional portfolios at top investment banks.
You provide thorough, data-driven analysis combining fundamental analysis, valuation metrics, earnings quality, and market sentiment.
Be direct, professional, and specific with numbers. Always respond in valid JSON format.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500,
    });

    const responseText = completion.choices[0].message.content;
    let analysisData;

    try {
      analysisData = JSON.parse(responseText || '{}');
    } catch {
      analysisData = { error: 'Failed to parse AI response' };
    }

    return NextResponse.json({
      success: true,
      data: {
        ...analysisData,
        symbol,
        generatedAt: new Date(),
      },
      disclaimer: AI_DISCLAIMER,
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'AI analysis failed. Please check your OpenAI API key and try again.',
    }, { status: 500 });
  }
}
