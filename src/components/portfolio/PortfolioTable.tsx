'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { AssetLogo } from '@/components/ui/asset-logo';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';
import type { Position } from '@/types';

interface PortfolioTableProps {
  onEdit?: (position: Position) => void;
  onDelete?: (positionId: string) => void;
}

const assetTypeColors: Record<string, string> = {
  stock: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  crypto: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  etf: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  bond: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  real_estate: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

export function PortfolioTable({ onEdit, onDelete }: PortfolioTableProps) {
  const router = useRouter();
  const { getActivePortfolio, removePosition } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const handleAnalyze = (symbol: string) => {
    router.push(`/analysis?symbol=${symbol}`);
  };

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">No positions in your portfolio yet</p>
        <p className="text-sm text-muted-foreground">
          Add your first position to start tracking your investments
        </p>
      </div>
    );
  }

  const handleDelete = (positionId: string) => {
    if (onDelete) {
      onDelete(positionId);
    } else {
      removePosition(positionId);
    }
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Avg Cost</TableHead>
            <TableHead className="text-right">Current Price</TableHead>
            <TableHead className="text-right">Market Value</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead className="text-right">Day Change</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {portfolio.positions.map((position) => {
            // Ensure all values are valid numbers
            const quantity = Number(position.quantity) || 0;
            const currentPrice = Number(position.currentPrice) || 0;
            const avgCost = Number(position.avgCost) || 0;
            const previousClose = Number(position.previousClose) || currentPrice;

            const marketValue = quantity * currentPrice;
            const costBasis = quantity * avgCost;
            const pnl = marketValue - costBasis;
            const pnlPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
            const dayChange = currentPrice - previousClose;
            const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;
            const isPnlPositive = pnl >= 0;
            const isDayChangePositive = dayChange >= 0;

            return (
              <TableRow
                key={position.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleAnalyze(position.symbol)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AssetLogo
                      symbol={position.symbol}
                      name={position.name}
                      assetType={position.assetType}
                      size="md"
                    />
                    <div>
                      <p className="font-medium">{position.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {position.name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('capitalize', assetTypeColors[position.assetType])}
                  >
                    {position.assetType.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {quantity.toLocaleString()}{position.unit && position.unit !== 'units' ? ` ${position.unit}` : ''}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(avgCost)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(currentPrice)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatCurrency(marketValue)}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className={cn(
                      'flex items-center justify-end gap-1',
                      isPnlPositive ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {isPnlPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <div className="text-right">
                      <p className="font-mono font-medium">{formatCurrency(pnl)}</p>
                      <p className="text-xs">{formatPercent(pnlPercent)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono',
                    isDayChangePositive ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {formatPercent(dayChangePercent)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAnalyze(position.symbol)}>
                        <Brain className="mr-2 h-4 w-4" />
                        Analyze
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(position)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(position.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
