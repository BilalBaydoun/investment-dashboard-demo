'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TrendingUp, Brain, PieChart, Target, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();

  // Auto-redirect to dashboard after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      // Uncomment to auto-redirect
      // router.push('/dashboard');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  const features = [
    {
      icon: PieChart,
      title: 'Portfolio Tracking',
      description: 'Track all your investments in one place - stocks, crypto, ETFs, and more.',
    },
    {
      icon: Brain,
      title: 'AI-Powered Insights',
      description: 'Get intelligent buy/sell signals and portfolio optimization recommendations.',
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Data',
      description: 'Access live market data, charts, and technical indicators.',
    },
    {
      icon: Target,
      title: 'Goal Tracking',
      description: 'Set investment goals and track your progress towards financial targets.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrendingUp className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">InvestAI</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Smart Investment Dashboard
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            AI-powered portfolio management with intelligent analysis, buy/sell signals,
            and personalized recommendations to help you achieve your financial goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/analysis">
                Try AI Analysis
                <Brain className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Demo Notice */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            This is a demo application. Market data is simulated.
            <br />
            Configure your API keys in Settings for real-time data.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            <strong>Disclaimer:</strong> This application is for educational purposes only.
            Not financial advice.
          </p>
          <p className="mt-2">
            Built with Next.js, React, Tailwind CSS, and OpenAI
          </p>
        </div>
      </footer>
    </div>
  );
}
