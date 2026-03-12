'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportOptions {
  includeTransactions: boolean;
  includePerformance: boolean;
  includeCostBasis: boolean;
  dateRange: 'all' | 'ytd' | 'year' | 'month';
}

export function PortfolioExport() {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeTransactions: true,
    includePerformance: true,
    includeCostBasis: true,
    dateRange: 'all',
  });

  const {
    getActivePortfolio,
    getTotalValue,
    getTotalCost,
    getTotalGain,
    getTotalGainPercent,
    transactions,
  } = usePortfolioStore();

  const portfolio = getActivePortfolio();

  const generateCSV = () => {
    if (!portfolio) return '';

    const headers = [
      'Symbol',
      'Name',
      'Asset Type',
      'Quantity',
      'Unit',
      options.includeCostBasis ? 'Avg Cost' : null,
      'Current Price',
      'Market Value',
      options.includePerformance ? 'Gain/Loss ($)' : null,
      options.includePerformance ? 'Gain/Loss (%)' : null,
    ].filter(Boolean);

    const rows = portfolio.positions.map((pos) => {
      const quantity = Number(pos.quantity) || 0;
      const avgCost = Number(pos.avgCost) || 0;
      const currentPrice = Number(pos.currentPrice) || 0;
      const marketValue = quantity * currentPrice;
      const gain = (currentPrice - avgCost) * quantity;
      const gainPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

      return [
        pos.symbol,
        `"${pos.name}"`,
        pos.assetType,
        quantity.toString(),
        pos.unit || 'units',
        options.includeCostBasis ? avgCost.toFixed(2) : null,
        currentPrice.toFixed(2),
        marketValue.toFixed(2),
        options.includePerformance ? gain.toFixed(2) : null,
        options.includePerformance ? gainPercent.toFixed(2) : null,
      ].filter((v) => v !== null);
    });

    // Add summary row
    const totalValue = getTotalValue();
    const totalCost = getTotalCost();
    const totalGain = getTotalGain();
    const totalGainPercent = getTotalGainPercent();

    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Value', '', '', '', '', '', '', totalValue.toFixed(2)]);
    if (options.includeCostBasis) {
      rows.push(['Total Cost', '', '', '', '', totalCost.toFixed(2)]);
    }
    if (options.includePerformance) {
      rows.push(['Total Gain/Loss', '', '', '', '', '', '', '', totalGain.toFixed(2), totalGainPercent.toFixed(2)]);
    }

    // Add transactions if selected
    if (options.includeTransactions && transactions.length > 0) {
      rows.push([]);
      rows.push(['Transactions']);
      rows.push(['Date', 'Symbol', 'Type', 'Quantity', 'Price', 'Total', 'Notes']);

      const filteredTransactions = filterTransactionsByDate(transactions);
      filteredTransactions.forEach((tx) => {
        rows.push([
          new Date(tx.date).toLocaleDateString(),
          tx.symbol,
          tx.type,
          tx.quantity.toString(),
          tx.price.toFixed(2),
          tx.total.toFixed(2),
          tx.notes ? `"${tx.notes}"` : '',
        ]);
      });
    }

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  };

  const generateJSON = () => {
    if (!portfolio) return '';

    const data = {
      portfolioName: portfolio.name,
      exportDate: new Date().toISOString(),
      summary: {
        totalValue: getTotalValue(),
        totalCost: options.includeCostBasis ? getTotalCost() : undefined,
        totalGain: options.includePerformance ? getTotalGain() : undefined,
        totalGainPercent: options.includePerformance ? getTotalGainPercent() : undefined,
        positionCount: portfolio.positions.length,
        cashBalance: portfolio.cashBalance,
      },
      positions: portfolio.positions.map((pos) => {
        const quantity = Number(pos.quantity) || 0;
        const avgCost = Number(pos.avgCost) || 0;
        const currentPrice = Number(pos.currentPrice) || 0;

        return {
          symbol: pos.symbol,
          name: pos.name,
          assetType: pos.assetType,
          quantity,
          unit: pos.unit || 'units',
          avgCost: options.includeCostBasis ? avgCost : undefined,
          currentPrice,
          marketValue: quantity * currentPrice,
          gain: options.includePerformance ? (currentPrice - avgCost) * quantity : undefined,
          gainPercent: options.includePerformance && avgCost > 0
            ? ((currentPrice - avgCost) / avgCost) * 100
            : undefined,
        };
      }),
      transactions: options.includeTransactions
        ? filterTransactionsByDate(transactions)
        : undefined,
    };

    return JSON.stringify(data, null, 2);
  };

  const generatePDFContent = () => {
    if (!portfolio) return '';

    const totalValue = getTotalValue();
    const totalCost = getTotalCost();
    const totalGain = getTotalGain();
    const totalGainPercent = getTotalGainPercent();

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Portfolio Report - ${portfolio.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #333; margin-top: 30px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
          .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
          .summary-card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
          .summary-card .value { font-size: 24px; font-weight: bold; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f8f9fa; font-weight: 600; }
          tr:hover { background: #f8f9fa; }
          .text-right { text-align: right; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Portfolio Report: ${portfolio.name}</h1>
        <p style="color: #666;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>

        <div class="summary">
          <div class="summary-card">
            <h3>Total Value</h3>
            <div class="value">${formatCurrency(totalValue)}</div>
          </div>
          ${options.includeCostBasis ? `
          <div class="summary-card">
            <h3>Total Cost Basis</h3>
            <div class="value">${formatCurrency(totalCost)}</div>
          </div>
          ` : ''}
          ${options.includePerformance ? `
          <div class="summary-card">
            <h3>Total Gain/Loss</h3>
            <div class="value ${totalGain >= 0 ? 'positive' : 'negative'}">
              ${formatCurrency(totalGain)} (${formatPercent(totalGainPercent)})
            </div>
          </div>
          ` : ''}
        </div>

        <h2>Holdings (${portfolio.positions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Type</th>
              <th class="text-right">Quantity</th>
              ${options.includeCostBasis ? '<th class="text-right">Avg Cost</th>' : ''}
              <th class="text-right">Price</th>
              <th class="text-right">Value</th>
              ${options.includePerformance ? '<th class="text-right">Gain/Loss</th>' : ''}
            </tr>
          </thead>
          <tbody>
    `;

    portfolio.positions.forEach((pos) => {
      const quantity = Number(pos.quantity) || 0;
      const avgCost = Number(pos.avgCost) || 0;
      const currentPrice = Number(pos.currentPrice) || 0;
      const marketValue = quantity * currentPrice;
      const gain = (currentPrice - avgCost) * quantity;
      const gainPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

      html += `
        <tr>
          <td><strong>${pos.symbol}</strong></td>
          <td>${pos.name}</td>
          <td>${pos.assetType}</td>
          <td class="text-right">${quantity.toLocaleString()} ${pos.unit && pos.unit !== 'units' ? pos.unit : ''}</td>
          ${options.includeCostBasis ? `<td class="text-right">${formatCurrency(avgCost)}</td>` : ''}
          <td class="text-right">${formatCurrency(currentPrice)}</td>
          <td class="text-right">${formatCurrency(marketValue)}</td>
          ${options.includePerformance ? `
          <td class="text-right ${gain >= 0 ? 'positive' : 'negative'}">
            ${formatCurrency(gain)}<br>
            <small>(${formatPercent(gainPercent)})</small>
          </td>
          ` : ''}
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
    `;

    if (options.includeTransactions && transactions.length > 0) {
      const filteredTransactions = filterTransactionsByDate(transactions);
      if (filteredTransactions.length > 0) {
        html += `
          <h2>Transaction History</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Type</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Price</th>
                <th class="text-right">Total</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
        `;

        filteredTransactions.forEach((tx) => {
          html += `
            <tr>
              <td>${new Date(tx.date).toLocaleDateString()}</td>
              <td><strong>${tx.symbol}</strong></td>
              <td style="text-transform: capitalize;">${tx.type}</td>
              <td class="text-right">${tx.quantity.toLocaleString()}</td>
              <td class="text-right">${formatCurrency(tx.price)}</td>
              <td class="text-right">${formatCurrency(tx.total)}</td>
              <td>${tx.notes || '-'}</td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
        `;
      }
    }

    html += `
        <div class="footer">
          <p>This report is for informational purposes only and should not be considered financial advice.</p>
          <p>Generated by InvestAI Portfolio Dashboard</p>
        </div>
      </body>
      </html>
    `;

    return html;
  };

  const filterTransactionsByDate = (txs: typeof transactions) => {
    const now = new Date();
    let startDate: Date;

    switch (options.dateRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        return txs;
    }

    return txs.filter((tx) => new Date(tx.date) >= startDate);
  };

  const handleExport = async () => {
    if (!portfolio) {
      toast.error('No portfolio to export');
      return;
    }

    setIsExporting(true);

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = portfolio.name.replace(/[^a-z0-9]/gi, '_');

      switch (format) {
        case 'csv':
          content = generateCSV();
          filename = `${safeName}_${dateStr}.csv`;
          mimeType = 'text/csv';
          break;
        case 'json':
          content = generateJSON();
          filename = `${safeName}_${dateStr}.json`;
          mimeType = 'application/json';
          break;
        case 'pdf':
          content = generatePDFContent();
          // Open in new window for printing
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.print();
          }
          toast.success('PDF opened for printing');
          setIsOpen(false);
          setIsExporting(false);
          return;
        default:
          throw new Error('Invalid format');
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Portfolio exported as ${format.toUpperCase()}`);
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export portfolio');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Portfolio</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={format === 'csv' ? 'default' : 'outline'}
                onClick={() => setFormat('csv')}
                className="flex flex-col h-auto py-4"
              >
                <FileSpreadsheet className="h-6 w-6 mb-1" />
                <span>CSV</span>
                <span className="text-xs text-muted-foreground">For Excel</span>
              </Button>
              <Button
                variant={format === 'json' ? 'default' : 'outline'}
                onClick={() => setFormat('json')}
                className="flex flex-col h-auto py-4"
              >
                <FileText className="h-6 w-6 mb-1" />
                <span>JSON</span>
                <span className="text-xs text-muted-foreground">Raw data</span>
              </Button>
              <Button
                variant={format === 'pdf' ? 'default' : 'outline'}
                onClick={() => setFormat('pdf')}
                className="flex flex-col h-auto py-4"
              >
                <FileText className="h-6 w-6 mb-1" />
                <span>PDF</span>
                <span className="text-xs text-muted-foreground">Print</span>
              </Button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label>Include in Export</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="costBasis"
                  checked={options.includeCostBasis}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includeCostBasis: !!checked }))
                  }
                />
                <label htmlFor="costBasis" className="text-sm">
                  Cost Basis (Average Cost)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="performance"
                  checked={options.includePerformance}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includePerformance: !!checked }))
                  }
                />
                <label htmlFor="performance" className="text-sm">
                  Performance (Gain/Loss)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transactions"
                  checked={options.includeTransactions}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includeTransactions: !!checked }))
                  }
                />
                <label htmlFor="transactions" className="text-sm">
                  Transaction History
                </label>
              </div>
            </div>
          </div>

          {/* Date Range for Transactions */}
          {options.includeTransactions && (
            <div className="space-y-2">
              <Label>Transaction Date Range</Label>
              <Select
                value={options.dateRange}
                onValueChange={(v) =>
                  setOptions((o) => ({ ...o, dateRange: v as ExportOptions['dateRange'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                  <SelectItem value="year">Last 12 Months</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleExport} className="w-full" disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export {format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
