import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'default';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - Load data from Supabase
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('id', USER_ID)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        portfolios: data.portfolios || [],
        transactions: data.transactions || [],
        watchlist: data.watchlist || [],
        goal: data.goal || null,
        preferences: data.preferences || {},
        alerts: data.alerts || [],
        paperTrading: data.paper_trading || null,
        savedGoals: data.saved_goals || [],
        activeGoalId: data.active_goal_id || null,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Sync load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load data' }, { status: 500 });
  }
}

// POST - Save data to Supabase
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();

    const { error } = await supabase
      .from('user_data')
      .upsert({
        id: USER_ID,
        portfolios: body.portfolios || [],
        transactions: body.transactions || [],
        watchlist: body.watchlist || [],
        goal: body.goal || null,
        preferences: body.preferences || {},
        alerts: body.alerts || [],
        paper_trading: body.paperTrading || null,
        saved_goals: body.savedGoals || [],
        active_goal_id: body.activeGoalId || null,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save data' }, { status: 500 });
  }
}
