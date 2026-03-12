'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AssetType } from '@/types';

interface AssetLogoProps {
  symbol: string;
  name?: string;
  assetType: AssetType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Crypto logos are not loaded from external CDN - fallback to symbol initials
const CRYPTO_LOGO_MAP: Record<string, string> = {};

// Map of known company domains for Clearbit logos
const COMPANY_DOMAINS: Record<string, string> = {
  UBER: 'uber.com',
  QS: 'quantumscape.com',
  TSLA: 'tesla.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  MSFT: 'microsoft.com',
  NFLX: 'netflix.com',
  NVDA: 'nvidia.com',
  DIS: 'disney.com',
  PYPL: 'paypal.com',
  SQ: 'squareup.com',
  SHOP: 'shopify.com',
  SPOT: 'spotify.com',
  SNAP: 'snap.com',
  PINS: 'pinterest.com',
  ZM: 'zoom.us',
  ABNB: 'airbnb.com',
  COIN: 'coinbase.com',
  HOOD: 'robinhood.com',
  PLTR: 'palantir.com',
  RBLX: 'roblox.com',
  RIVN: 'rivian.com',
  LCID: 'lucidmotors.com',
  NIO: 'nio.com',
  INTC: 'intel.com',
  CRM: 'salesforce.com',
  ADBE: 'adobe.com',
  ORCL: 'oracle.com',
  IBM: 'ibm.com',
  CSCO: 'cisco.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  GS: 'goldmansachs.com',
  MS: 'morganstanley.com',
  C: 'citigroup.com',
  WMT: 'walmart.com',
  TGT: 'target.com',
  COST: 'costco.com',
  HD: 'homedepot.com',
  LOW: 'lowes.com',
  NKE: 'nike.com',
  SBUX: 'starbucks.com',
  MCD: 'mcdonalds.com',
  KO: 'coca-cola.com',
  PEP: 'pepsi.com',
};


// Generate background color based on symbol
function getSymbolColor(symbol: string): string {
  const colors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#a855f7', // purple
    '#f59e0b', // amber
    '#f43f5e', // rose
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#10b981', // emerald
    '#f97316', // orange
    '#ec4899', // pink
  ];

  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function AssetLogo({ symbol, name, assetType, size = 'md', className }: AssetLogoProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(true);
  const upperSymbol = symbol.toUpperCase();

  // Get domain for Clearbit if available
  const domain = COMPANY_DOMAINS[upperSymbol];

  // Determine logo URL based on asset type
  useEffect(() => {
    if (assetType === 'crypto') {
      const cryptoLogo = CRYPTO_LOGO_MAP[upperSymbol];
      if (cryptoLogo) {
        setImgSrc(cryptoLogo);
      }
    } else if (domain) {
      // Use Clearbit for known domains
      setImgSrc(`https://logo.clearbit.com/${domain}`);
    } else {
      // Use Clearbit with lowercase symbol as domain guess
      setImgSrc(`https://logo.clearbit.com/${upperSymbol.toLowerCase()}.com`);
    }
  }, [upperSymbol, assetType, domain]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Only hide fallback if image is valid (not tiny placeholder)
    if (img.naturalWidth > 10 && img.naturalHeight > 10) {
      setShowFallback(false);
    }
  };

  const handleImageError = () => {
    // If image fails, show fallback
    setShowFallback(true);
  };

  const bgColor = getSymbolColor(upperSymbol);

  const sizeInPx = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  const fontSizeInPx = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: sizeInPx[size],
        height: sizeInPx[size],
        minWidth: sizeInPx[size],
        minHeight: sizeInPx[size],
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: showFallback ? bgColor : '#ffffff',
      }}
    >
      {/* Fallback - always rendered, visible when showFallback is true */}
      {showFallback && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: fontSizeInPx[size],
          }}
        >
          {upperSymbol.slice(0, 2)}
        </div>
      )}

      {/* Image - rendered on top, hidden until loaded */}
      {imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={name || symbol}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showFallback ? 0 : 1,
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
