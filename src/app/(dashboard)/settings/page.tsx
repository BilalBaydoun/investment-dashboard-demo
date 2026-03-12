'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Moon, Sun, Monitor, Key, Bell, Download, Upload, Trash2, Database, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Cloud, CloudDownload, CloudUpload } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useSync } from '@/hooks/useSync';
import { toast } from 'sonner';

const API_KEYS_STORAGE_KEY = 'investai-api-keys';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function SettingsPage() {
  const { theme, setTheme, preferences, updatePreferences } = useThemeStore();
  const portfolioStore = usePortfolioStore();
  const watchlistStore = useWatchlistStore();

  const [apiKeys, setApiKeys] = useState({
    alphaVantage: '',
    openai: '',
  });
  const [showKeys, setShowKeys] = useState({
    alphaVantage: false,
    openai: false,
  });
  const [testStatus, setTestStatus] = useState<{
    alphaVantage: TestStatus;
    openai: TestStatus;
  }>({
    alphaVantage: 'idle',
    openai: 'idle',
  });
  const { isSyncing, lastSynced, pushToCloud, pullFromCloud } = useSync();
  const [mounted, setMounted] = useState(false);

  // Load API keys from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedKeys = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        setApiKeys({
          alphaVantage: parsed.alphaVantage || '',
          openai: parsed.openai || '',
        });
      } catch (e) {
        console.error('Failed to parse saved API keys');
      }
    }
  }, []);

  const handleSaveApiKeys = () => {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
    toast.success('API keys saved successfully');
  };

  // Test Alpha Vantage API Key (via backend to avoid CORS)
  const testAlphaVantage = async () => {
    if (!apiKeys.alphaVantage) {
      toast.error('Please enter an Alpha Vantage API key first');
      return;
    }

    setTestStatus(prev => ({ ...prev, alphaVantage: 'testing' }));

    try {
      const response = await fetch(`/api/stocks?action=test&testKey=${apiKeys.alphaVantage}`);
      const data = await response.json();

      if (data.success && data.data) {
        setTestStatus(prev => ({ ...prev, alphaVantage: 'success' }));
        toast.success('Alpha Vantage API key is valid!');
      } else if (data.error?.includes('rate limit') || data.error?.includes('Rate limit')) {
        setTestStatus(prev => ({ ...prev, alphaVantage: 'error' }));
        toast.error('API rate limit reached. Try again later.');
      } else {
        setTestStatus(prev => ({ ...prev, alphaVantage: 'error' }));
        toast.error(data.error || 'Invalid Alpha Vantage API key');
      }
    } catch (error) {
      setTestStatus(prev => ({ ...prev, alphaVantage: 'error' }));
      toast.error('Failed to connect to Alpha Vantage');
    }
  };

  // Test OpenAI API Key
  const testOpenAI = async () => {
    if (!apiKeys.openai) {
      toast.error('Please enter an OpenAI API key first');
      return;
    }

    setTestStatus(prev => ({ ...prev, openai: 'testing' }));

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKeys.openai}`,
        },
      });

      if (response.ok) {
        setTestStatus(prev => ({ ...prev, openai: 'success' }));
        toast.success('OpenAI API key is valid!');
      } else if (response.status === 401) {
        setTestStatus(prev => ({ ...prev, openai: 'error' }));
        toast.error('Invalid OpenAI API key');
      } else if (response.status === 429) {
        setTestStatus(prev => ({ ...prev, openai: 'error' }));
        toast.error('OpenAI rate limit reached');
      } else {
        setTestStatus(prev => ({ ...prev, openai: 'error' }));
        toast.error('Failed to validate OpenAI API key');
      }
    } catch (error) {
      setTestStatus(prev => ({ ...prev, openai: 'error' }));
      toast.error('Failed to connect to OpenAI');
    }
  };

  // Get status icon for test result
  const getTestStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const handleExportData = () => {
    const data = {
      portfolios: portfolioStore.portfolios,
      transactions: portfolioStore.transactions,
      watchlist: watchlistStore.items,
      goal: watchlistStore.goal,
      preferences: preferences,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investai-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // Validate the data structure
        if (!data.portfolios && !data.watchlist) {
          toast.error('Invalid backup file format');
          return;
        }

        // Import portfolios
        if (data.portfolios && Array.isArray(data.portfolios)) {
          // Clear existing and set new portfolios
          localStorage.setItem('portfolio-storage', JSON.stringify({
            state: {
              portfolios: data.portfolios,
              activePortfolioId: data.portfolios[0]?.id || null,
              transactions: data.transactions || [],
            },
            version: 0,
          }));
        }

        // Import watchlist
        if (data.watchlist && Array.isArray(data.watchlist)) {
          localStorage.setItem('watchlist-storage', JSON.stringify({
            state: {
              items: data.watchlist,
              goal: data.goal || null,
            },
            version: 0,
          }));
        }

        // Import preferences
        if (data.preferences) {
          updatePreferences(data.preferences);
        }

        toast.success('Data imported successfully. Refreshing...');

        // Reload to apply changes
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Failed to import data. Invalid file format.');
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Settings"
        subtitle="Manage your preferences and API keys"
      />

      <div className="p-3 md:p-6 max-w-3xl space-y-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how the dashboard looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  System
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={preferences.currency}
                onValueChange={(value) => updatePreferences({ currency: value })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="JPY">JPY (¥)</SelectItem>
                  <SelectItem value="CAD">CAD ($)</SelectItem>
                  <SelectItem value="AUD">AUD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Price Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when watchlist items hit target prices
                </p>
              </div>
              <Switch
                checked={preferences.notifications.priceAlerts}
                onCheckedChange={(checked) =>
                  updatePreferences({
                    notifications: { ...preferences.notifications, priceAlerts: checked },
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>News Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about significant news for your holdings
                </p>
              </div>
              <Switch
                checked={preferences.notifications.newsAlerts}
                onCheckedChange={(checked) =>
                  updatePreferences({
                    notifications: { ...preferences.notifications, newsAlerts: checked },
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Goal Progress</Label>
                <p className="text-sm text-muted-foreground">
                  Get updates on your investment goal progress
                </p>
              </div>
              <Switch
                checked={preferences.notifications.goalProgress}
                onCheckedChange={(checked) =>
                  updatePreferences({
                    notifications: { ...preferences.notifications, goalProgress: checked },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Configure your API keys for real-time data and AI features.
              Keys are stored locally and never sent to our servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alphaVantage">Alpha Vantage API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="alphaVantage"
                    type={showKeys.alphaVantage ? 'text' : 'password'}
                    placeholder="Enter your Alpha Vantage API key"
                    value={apiKeys.alphaVantage}
                    onChange={(e) => {
                      setApiKeys({ ...apiKeys, alphaVantage: e.target.value });
                      setTestStatus(prev => ({ ...prev, alphaVantage: 'idle' }));
                    }}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys({ ...showKeys, alphaVantage: !showKeys.alphaVantage })}
                  >
                    {showKeys.alphaVantage ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAlphaVantage}
                  disabled={!apiKeys.alphaVantage || testStatus.alphaVantage === 'testing'}
                  className="w-20"
                >
                  {testStatus.alphaVantage === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Test {getTestStatusIcon(testStatus.alphaVantage)}</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Primary data provider for stocks, crypto, news, and market data.{' '}
                Get a key at{' '}
                <a
                  href="https://www.alphavantage.co/support/#api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  alphavantage.co
                </a>
                {testStatus.alphaVantage === 'success' && <span className="text-green-500 ml-2">✓ Verified</span>}
                {testStatus.alphaVantage === 'error' && <span className="text-red-500 ml-2">✗ Invalid</span>}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai">OpenAI API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="openai"
                    type={showKeys.openai ? 'text' : 'password'}
                    placeholder="Enter your OpenAI API key"
                    value={apiKeys.openai}
                    onChange={(e) => {
                      setApiKeys({ ...apiKeys, openai: e.target.value });
                      setTestStatus(prev => ({ ...prev, openai: 'idle' }));
                    }}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
                  >
                    {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testOpenAI}
                  disabled={!apiKeys.openai || testStatus.openai === 'testing'}
                  className="w-20"
                >
                  {testStatus.openai === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Test {getTestStatusIcon(testStatus.openai)}</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get a key at{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com
                </a>
                {testStatus.openai === 'success' && <span className="text-green-500 ml-2">✓ Verified</span>}
                {testStatus.openai === 'error' && <span className="text-red-500 ml-2">✗ Invalid</span>}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveApiKeys}>
                Save API Keys
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (apiKeys.alphaVantage) testAlphaVantage();
                  if (apiKeys.openai) testOpenAI();
                }}
                disabled={
                  (!apiKeys.alphaVantage && !apiKeys.openai) ||
                  testStatus.alphaVantage === 'testing' ||
                  testStatus.openai === 'testing'
                }
              >
                Test All Keys
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cloud Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Cloud Sync
            </CardTitle>
            <CardDescription>
              Sync your portfolio data across devices (phone, laptop, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={pushToCloud} disabled={isSyncing}>
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4 mr-2" />
                )}
                Push to Cloud
              </Button>
              <Button variant="outline" onClick={pullFromCloud} disabled={isSyncing}>
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudDownload className="h-4 w-4 mr-2" />
                )}
                Pull from Cloud
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Push</strong> uploads your current data to the cloud.
              <strong> Pull</strong> downloads and replaces local data with cloud data.
              {lastSynced && (
                <span className="block mt-1 text-xs">
                  Last synced: {new Date(lastSynced).toLocaleString()}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>Export, import, or clear your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>

              <div className="relative">
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </Button>
              </div>

              <Button variant="destructive" onClick={handleClearAllData}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Your data is stored locally in your browser. Export regularly to keep a backup.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About InvestAI Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              InvestAI is an AI-powered investment portfolio dashboard designed to help you
              track your investments and make informed decisions.
            </p>
            <p>
              <strong>Disclaimer:</strong> This application is for educational and informational
              purposes only. It is not intended to be investment advice. Always do your own
              research and consult with a qualified financial advisor before making investment
              decisions.
            </p>
            <p className="pt-2">
              Version 1.0.0 | Built with Next.js, React, and GPT-4
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
