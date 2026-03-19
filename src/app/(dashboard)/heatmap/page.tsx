'use client';

import { Header } from '@/components/layout/Header';
import { MarketHeatmap } from '@/components/dashboard/MarketHeatmap';

export default function HeatmapPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header
        title="Market Heatmap"
        subtitle="Top 100 US stocks by market cap"
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <MarketHeatmap />
      </div>
    </div>
  );
}
