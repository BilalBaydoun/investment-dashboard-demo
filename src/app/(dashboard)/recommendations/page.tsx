'use client';

import { Header } from '@/components/layout/Header';
import { StockRecommendations } from '@/components/dashboard/StockRecommendations';

export default function RecommendationsPage() {
  return (
    <div className="min-h-screen">
      <Header
        title="AI Stock Picks"
        subtitle="Weekly scanner results — zero API calls, updated every Sunday"
      />

      <div className="p-3 md:p-6">
        <StockRecommendations />
      </div>
    </div>
  );
}
