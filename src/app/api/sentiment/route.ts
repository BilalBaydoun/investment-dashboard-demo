import { NextRequest, NextResponse } from 'next/server';

// Alternative.me Fear & Greed API (works reliably, updates daily)
const ALTERNATIVE_API_URL = 'https://api.alternative.me/fng/?limit=31';

interface AlternativeResponse {
  data: {
    value: string;
    value_classification: string;
    timestamp: string;
  }[];
}

// Get rating label from score
function getRatingFromScore(score: number): string {
  if (score <= 20) return 'Extreme Fear';
  if (score <= 40) return 'Fear';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Greed';
  return 'Extreme Greed';
}

export async function GET(request: NextRequest) {
  try {
    // Use Alternative.me Fear & Greed API (reliable, no bot blocking)
    const response = await fetch(ALTERNATIVE_API_URL, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Alternative.me API returned ${response.status}`);
    }

    const data: AlternativeResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('Invalid response from Alternative.me API');
    }

    const current = data.data[0];
    const score = parseInt(current.value, 10);

    // Get historical data for changes
    const yesterday = data.data[1] ? parseInt(data.data[1].value, 10) : score;
    const lastWeek = data.data[7] ? parseInt(data.data[7].value, 10) : score;
    const lastMonth = data.data[30] ? parseInt(data.data[30].value, 10) : score;

    return NextResponse.json({
      success: true,
      data: {
        score,
        rating: getRatingFromScore(score),
        timestamp: new Date(parseInt(current.timestamp, 10) * 1000).toISOString(),
        changes: {
          daily: score - yesterday,
          weekly: score - lastWeek,
          monthly: score - lastMonth,
          yearly: 0, // Not available in this API
        },
        historical: data.data.slice(0, 30).map(item => ({
          timestamp: parseInt(item.timestamp, 10) * 1000,
          score: parseInt(item.value, 10),
          rating: getRatingFromScore(parseInt(item.value, 10)),
        })),
        source: 'Fear & Greed Index',
      },
    });
  } catch (error) {
    console.error('Failed to fetch Fear & Greed:', error);

    // Return fallback data
    return NextResponse.json({
      success: true,
      data: {
        score: 50,
        rating: 'Neutral',
        timestamp: new Date().toISOString(),
        changes: {
          daily: 0,
          weekly: 0,
          monthly: 0,
          yearly: 0,
        },
        historical: [],
        source: 'Fallback (API unavailable)',
        isFallback: true,
      },
    });
  }
}
