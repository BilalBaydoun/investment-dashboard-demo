'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency } from '@/lib/api/stocks';
import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RecentTransactions() {
  const { transactions } = usePortfolioStore();

  // Get the 5 most recent transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const getIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'dividend':
        return <Coins className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'buy':
        return 'default';
      case 'sell':
        return 'destructive';
      case 'dividend':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getIcon(tx.type)}
                  <div>
                    <p className="font-medium">{tx.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.quantity} @ {formatCurrency(tx.price)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={getBadgeVariant(tx.type)} className="capitalize">
                    {tx.type}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(tx.date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
