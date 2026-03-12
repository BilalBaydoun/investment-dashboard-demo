'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { AssetType, Position, QuantityUnit } from '@/types';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Search, Globe, Building2 } from 'lucide-react';
import { AssetLogo } from '@/components/ui/asset-logo';
import { fetchWithApiKeys } from '@/lib/api/apiKeys';
import { cn } from '@/lib/utils';

// Known crypto symbols for auto-detection
const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'DOT',
  'MATIC', 'LTC', 'SHIB', 'AVAX', 'LINK', 'UNI', 'ATOM',
  'BITCOIN', 'ETHEREUM', 'SOLANA', 'CARDANO', 'DOGECOIN'
]);

// Known commodity symbols for auto-detection
const COMMODITY_SYMBOLS = new Set([
  'GOLD', 'SILVER', 'XAU', 'XAG', 'PLATINUM', 'PALLADIUM',
  'GLD', 'SLV', 'IAU', 'SGOL', 'PSLV', 'COPPER', 'BRONZE'
]);

// Commodity name mappings
const COMMODITY_NAMES: Record<string, string> = {
  'GOLD': 'Physical Gold',
  'SILVER': 'Physical Silver',
  'XAU': 'Gold (XAU)',
  'XAG': 'Silver (XAG)',
  'PLATINUM': 'Physical Platinum',
  'PALLADIUM': 'Physical Palladium',
  'COPPER': 'Physical Copper',
  'BRONZE': 'Physical Bronze',
};

// ISIN format: 2 letter country code + 9 alphanumeric + 1 check digit
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

// Check if input looks like an ISIN
const isISIN = (value: string): boolean => {
  return ISIN_REGEX.test(value.toUpperCase());
};

interface ISINLookupResult {
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  isin: string;
  symbol: string;
  fullSymbol: string;
  assetType: string;
  price: number;
  previousClose: number;
}

interface AddPositionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPosition?: Position | null;
}

const assetTypes: { value: AssetType; label: string }[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bond' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'commodity', label: 'Commodity (Gold, Silver...)' },
];

const quantityUnits: { value: QuantityUnit; label: string }[] = [
  { value: 'units', label: 'Units' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'troy_oz', label: 'Troy Ounces (t oz)' },
];

export function AddPositionForm({ open, onOpenChange, editPosition }: AddPositionFormProps) {
  const { addPosition, updatePosition, getActivePortfolio, addTransaction } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const [formData, setFormData] = useState({
    symbol: editPosition?.symbol || '',
    name: editPosition?.name || '',
    assetType: editPosition?.assetType || 'stock' as AssetType,
    quantity: editPosition?.quantity.toString() || '',
    avgCost: editPosition?.avgCost.toString() || '',
    currentPrice: editPosition?.currentPrice.toString() || '',
    isin: editPosition?.isin || '',
    exchange: editPosition?.exchange || '',
    manualPriceOnly: editPosition?.manualPriceOnly || false,
    unit: editPosition?.unit || 'units' as QuantityUnit,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isLookingUpISIN, setIsLookingUpISIN] = useState(false);
  const [fetchedQuote, setFetchedQuote] = useState<{ price: number; name: string; previousClose: number } | null>(null);
  const [isinResult, setIsinResult] = useState<ISINLookupResult | null>(null);
  const [inputMode, setInputMode] = useState<'symbol' | 'isin'>('symbol');

  // Reset form when editPosition changes
  useEffect(() => {
    if (editPosition) {
      setFormData({
        symbol: editPosition.symbol,
        name: editPosition.name,
        assetType: editPosition.assetType,
        quantity: editPosition.quantity.toString(),
        avgCost: editPosition.avgCost.toString(),
        currentPrice: editPosition.currentPrice.toString(),
        isin: editPosition.isin || '',
        exchange: editPosition.exchange || '',
        manualPriceOnly: editPosition.manualPriceOnly || false,
        unit: editPosition.unit || 'units',
      });
    } else {
      setFormData({
        symbol: '',
        name: '',
        assetType: 'stock',
        quantity: '',
        avgCost: '',
        currentPrice: '',
        isin: '',
        exchange: '',
        manualPriceOnly: false,
        unit: 'units',
      });
    }
    setFetchedQuote(null);
    setIsinResult(null);
    setInputMode('symbol');
  }, [editPosition, open]);

  // ISIN Lookup function
  const lookupISIN = async (isin: string) => {
    if (!isISIN(isin)) return;

    setIsLookingUpISIN(true);
    setIsinResult(null);

    try {
      const response = await fetchWithApiKeys(`/api/isin?isin=${isin}&action=lookup`);
      const data = await response.json();

      if (data.success && data.data) {
        const result = data.data as ISINLookupResult;
        setIsinResult(result);

        const price = Number(result.price) || 0;
        const previousClose = Number(result.previousClose) || price;

        // Auto-fill form with ISIN lookup result
        setFormData(prev => ({
          ...prev,
          symbol: result.symbol,
          name: result.name,
          assetType: result.assetType as AssetType,
          currentPrice: price > 0 ? price.toFixed(2) : prev.currentPrice,
          isin: result.isin,
          exchange: result.exchange,
        }));

        // Always set fetchedQuote to show the price info box
        setFetchedQuote({
          price: price,
          name: result.name,
          previousClose: previousClose,
        });

        toast.success(`Found: ${result.name}`);
      } else {
        toast.error(data.error || 'ISIN not found');
      }
    } catch (error) {
      console.error('ISIN lookup error:', error);
      toast.error('Failed to lookup ISIN');
    } finally {
      setIsLookingUpISIN(false);
    }
  };

  // Auto-detect crypto and commodity symbols and switch asset type
  const handleSymbolChange = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    const isCrypto = CRYPTO_SYMBOLS.has(upperSymbol);
    const isCommodity = COMMODITY_SYMBOLS.has(upperSymbol);

    setFormData(prev => {
      let newAssetType = prev.assetType;
      let newUnit = prev.unit;
      let newManualPriceOnly = prev.manualPriceOnly;
      let newName = prev.name;

      if (isCrypto) {
        newAssetType = 'crypto';
      } else if (isCommodity) {
        newAssetType = 'commodity';
        // Default to grams for physical commodities
        if (prev.unit === 'units') {
          newUnit = 'grams';
        }
        // Auto-fill name for known commodities
        if (!prev.name && COMMODITY_NAMES[upperSymbol]) {
          newName = COMMODITY_NAMES[upperSymbol];
        }
      } else if (prev.assetType === 'crypto' || prev.assetType === 'commodity') {
        newAssetType = 'stock';
        newUnit = 'units';
      }

      return {
        ...prev,
        symbol: upperSymbol,
        name: newName,
        assetType: newAssetType,
        unit: newUnit,
        manualPriceOnly: newManualPriceOnly,
      };
    });
  };

  // Fetch price when symbol changes (with debounce)
  useEffect(() => {
    if (!formData.symbol || formData.symbol.length < 1) {
      setFetchedQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchCurrentPrice(formData.symbol, formData.assetType, formData.unit);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.symbol, formData.assetType, formData.unit]);

  const fetchCurrentPrice = async (symbol: string, assetType: AssetType, unit?: QuantityUnit) => {
    if (!symbol) return;

    setIsFetchingPrice(true);
    try {
      let endpoint: string;

      if (assetType === 'commodity') {
        endpoint = `/api/commodities?symbol=${symbol}&action=quote`;
      } else if (assetType === 'crypto') {
        endpoint = `/api/crypto?symbol=${symbol}&action=quote`;
      } else {
        endpoint = `/api/stocks?symbol=${symbol}&action=quote`;
      }

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success && data.data) {
        let price = data.data.price;

        // For commodities, convert price based on selected unit
        if (assetType === 'commodity' && data.data.pricePerGram) {
          switch (unit) {
            case 'grams':
              price = data.data.pricePerGram;
              break;
            case 'kg':
              price = data.data.pricePerKg;
              break;
            case 'oz':
              price = data.data.pricePerOz;
              break;
            case 'troy_oz':
              price = data.data.pricePerTroyOz;
              break;
            default:
              price = data.data.pricePerGram; // Default to grams
          }
        }

        const numericPrice = Number(price) || 0;

        setFetchedQuote({
          price: numericPrice,
          name: data.data.name,
          previousClose: Number(data.data.previousClose) || numericPrice,
        });

        // Auto-fill name if empty
        if (!formData.name && data.data.name) {
          setFormData(prev => ({ ...prev, name: data.data.name }));
        }

        // Auto-fill current price
        setFormData(prev => ({ ...prev, currentPrice: numericPrice.toFixed(2) }));
      }
    } catch (error) {
      console.error('Failed to fetch price:', error);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleRefreshPrice = () => {
    if (formData.symbol) {
      fetchCurrentPrice(formData.symbol, formData.assetType, formData.unit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!portfolio) {
      toast.error('Please create a portfolio first');
      return;
    }

    if (!formData.symbol || !formData.quantity || !formData.avgCost) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const quantity = parseFloat(formData.quantity) || 0;
      const avgCost = parseFloat(formData.avgCost) || 0;

      // Get current price from multiple sources with fallbacks
      let currentPrice = 0;
      if (formData.currentPrice && !isNaN(parseFloat(formData.currentPrice))) {
        currentPrice = parseFloat(formData.currentPrice);
      } else if (fetchedQuote?.price && !isNaN(fetchedQuote.price) && fetchedQuote.price > 0) {
        currentPrice = fetchedQuote.price;
      } else if (isinResult?.price && !isNaN(Number(isinResult.price)) && Number(isinResult.price) > 0) {
        currentPrice = Number(isinResult.price);
      } else {
        currentPrice = avgCost; // Last fallback
      }

      const previousClose = Number(fetchedQuote?.previousClose) || Number(isinResult?.previousClose) || currentPrice;

      if (editPosition) {
        // Update existing position
        updatePosition(editPosition.id, {
          symbol: formData.symbol.toUpperCase(),
          name: formData.name || formData.symbol.toUpperCase(),
          assetType: formData.assetType,
          quantity,
          avgCost,
          currentPrice,
          previousClose,
          manualPriceOnly: formData.manualPriceOnly,
          isin: formData.isin || undefined,
          exchange: formData.exchange || undefined,
          unit: formData.assetType === 'commodity' ? formData.unit : undefined,
        });
        toast.success('Position updated successfully');
      } else {
        // Add new position
        addPosition(portfolio.id, {
          symbol: formData.symbol.toUpperCase(),
          name: formData.name || formData.symbol.toUpperCase(),
          assetType: formData.assetType,
          quantity,
          avgCost,
          currentPrice,
          previousClose,
          manualPriceOnly: formData.manualPriceOnly,
          isin: formData.isin || undefined,
          exchange: formData.exchange || undefined,
          unit: formData.assetType === 'commodity' ? formData.unit : undefined,
        });

        // Add buy transaction
        addTransaction({
          positionId: '',
          symbol: formData.symbol.toUpperCase(),
          type: 'buy',
          quantity,
          price: avgCost,
          total: quantity * avgCost,
          date: new Date(),
        });

        toast.success('Position added successfully');
      }

      // Reset form
      setFormData({
        symbol: '',
        name: '',
        assetType: 'stock',
        quantity: '',
        avgCost: '',
        currentPrice: '',
        isin: '',
        exchange: '',
        manualPriceOnly: false,
        unit: 'units',
      });
      setFetchedQuote(null);
      setIsinResult(null);
      setInputMode('symbol');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save position');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPosition ? 'Edit Position' : 'Add Position'}</DialogTitle>
          <DialogDescription>
            {editPosition
              ? 'Update the details of your position'
              : 'Add a new asset to your portfolio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              variant={inputMode === 'symbol' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setInputMode('symbol')}
            >
              <Search className="h-4 w-4 mr-2" />
              Symbol
            </Button>
            <Button
              type="button"
              variant={inputMode === 'isin' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setInputMode('isin')}
            >
              <Globe className="h-4 w-4 mr-2" />
              ISIN
            </Button>
          </div>

          {/* ISIN Input Mode */}
          {inputMode === 'isin' && (
            <div className="space-y-2">
              <Label htmlFor="isin">ISIN Code</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="isin"
                    placeholder="US0378331005, IE00B4L5Y983..."
                    value={formData.isin}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      setFormData(prev => ({ ...prev, isin: value }));
                    }}
                    className="uppercase"
                  />
                  {isLookingUpISIN && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => lookupISIN(formData.isin)}
                  disabled={!formData.isin || formData.isin.length !== 12 || isLookingUpISIN}
                >
                  Lookup
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter ISIN to lookup ETFs, Bonds, or international securities
              </p>

              {/* ISIN Lookup Result */}
              {isinResult && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-green-500/20 shrink-0">
                      <Building2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{isinResult.symbol}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {isinResult.exchange}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {isinResult.assetType.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-green-500 font-bold text-lg shrink-0">
                          ${Number(isinResult.price || 0).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{isinResult.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>{isinResult.country}</span>
                        <span>•</span>
                        <span>{isinResult.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Symbol Input Mode */}
          <div className={cn("grid grid-cols-2 gap-4", inputMode === 'isin' && isinResult && "opacity-50")}>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol *</Label>
              <div className="relative">
                <Input
                  id="symbol"
                  placeholder="AAPL, BTC, VOO..."
                  value={formData.symbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  className="uppercase pr-8"
                  disabled={inputMode === 'isin' && !!isinResult}
                />
                {isFetchingPrice && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {formData.exchange && (
                <p className="text-xs text-muted-foreground">
                  Exchange: {formData.exchange}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetType">Asset Type *</Label>
              <Select
                value={formData.assetType}
                onValueChange={(value: AssetType) =>
                  setFormData({ ...formData, assetType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Show fetched price info - hide if ISIN result is showing to avoid duplicate */}
          {fetchedQuote && fetchedQuote.price > 0 && !isinResult && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center gap-3">
                <AssetLogo
                  symbol={formData.symbol}
                  name={fetchedQuote.name}
                  assetType={formData.assetType}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{fetchedQuote.name || formData.symbol}</span>
                    <span className="font-semibold text-green-500 shrink-0">${Number(fetchedQuote.price || 0).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Current Market Price</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              placeholder="Apple Inc."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className={cn("grid gap-4", formData.assetType === 'commodity' ? "grid-cols-3" : "grid-cols-2")}>
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {formData.assetType === 'commodity' ? 'Amount *' : 'Quantity *'}
              </Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                placeholder={formData.assetType === 'commodity' ? '100' : '100'}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            {/* Unit selector for commodities */}
            {formData.assetType === 'commodity' && (
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value: QuantityUnit) =>
                    setFormData({ ...formData, unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quantityUnits.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="avgCost">
                {formData.assetType === 'commodity'
                  ? `Avg Cost ($/${formData.unit === 'units' ? 'unit' : formData.unit}) *`
                  : 'Avg Cost ($) *'
                }
              </Label>
              <Input
                id="avgCost"
                type="number"
                step="any"
                min="0"
                placeholder={formData.assetType === 'commodity' ? '65.00' : '150.00'}
                value={formData.avgCost}
                onChange={(e) => setFormData({ ...formData, avgCost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="currentPrice">
                {formData.assetType === 'commodity'
                  ? `Current Price ($/${formData.unit === 'units' ? 'unit' : formData.unit})`
                  : 'Current Price ($)'
                }
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRefreshPrice}
                disabled={!formData.symbol || isFetchingPrice}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isFetchingPrice ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <Input
              id="currentPrice"
              type="number"
              step="any"
              min="0"
              placeholder="Auto-fetched from market"
              value={formData.currentPrice}
              onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {formData.assetType === 'commodity'
                ? 'Live prices from Metals.live API (Gold, Silver, Platinum, Palladium)'
                : 'Price is fetched automatically. You can also enter manually.'
              }
            </p>
          </div>

          {/* Manual Price Only Toggle */}
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50">
            <Checkbox
              id="manualPriceOnly"
              checked={formData.manualPriceOnly}
              onCheckedChange={(checked) => setFormData({ ...formData, manualPriceOnly: !!checked })}
            />
            <div className="flex-1">
              <Label htmlFor="manualPriceOnly" className="text-sm font-medium cursor-pointer">
                Manual price only
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Disable automatic price updates from API (useful for managed ETFs with incorrect listings)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : editPosition ? 'Update' : 'Add Position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
