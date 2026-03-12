import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'weekly-analysis.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        error: 'Weekly analysis not yet available',
      }, { status: 404 });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    // Check if data has been generated
    if (!data.generatedAt) {
      return NextResponse.json({
        success: false,
        error: 'Weekly scanner has not run yet',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error reading weekly analysis:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to read weekly analysis data',
    }, { status: 500 });
  }
}
