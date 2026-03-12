'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Target,
  TrendingUp,
  DollarSign,
  BarChart3,
  Percent,
  Calculator,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useGoalsStore } from '@/store/goalsStore';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/api/stocks';
import type { SavedGoal } from '@/types';

interface SimulationResult {
  percentile5: number[];
  percentile25: number[];
  percentile50: number[];
  percentile75: number[];
  percentile95: number[];
  successProbability: number;
  expectedFinalValue: number;
  monthlyData: { month: number; p5: number; p25: number; p50: number; p75: number; p95: number }[];
}

function runMonteCarloSimulation(
  currentValue: number,
  targetValue: number,
  monthlyContribution: number,
  months: number,
  expectedReturn: number = 0.08,
  volatility: number = 0.15,
  simulations: number = 1000
): SimulationResult {
  const monthlyReturn = expectedReturn / 12;
  const monthlyVolatility = volatility / Math.sqrt(12);

  const allSimulations: number[][] = [];
  let successCount = 0;

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [currentValue];
    let value = currentValue;

    for (let month = 1; month <= months; month++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const monthReturn = monthlyReturn + monthlyVolatility * z;

      value = value * (1 + monthReturn) + monthlyContribution;
      path.push(Math.max(0, value));
    }

    allSimulations.push(path);
    if (path[path.length - 1] >= targetValue) {
      successCount++;
    }
  }

  const monthlyData: SimulationResult['monthlyData'] = [];

  for (let month = 0; month <= months; month++) {
    const valuesAtMonth = allSimulations.map(sim => sim[month]).sort((a, b) => a - b);
    monthlyData.push({
      month,
      p5: valuesAtMonth[Math.floor(simulations * 0.05)],
      p25: valuesAtMonth[Math.floor(simulations * 0.25)],
      p50: valuesAtMonth[Math.floor(simulations * 0.50)],
      p75: valuesAtMonth[Math.floor(simulations * 0.75)],
      p95: valuesAtMonth[Math.floor(simulations * 0.95)],
    });
  }

  const finalValues = allSimulations.map(sim => sim[sim.length - 1]).sort((a, b) => a - b);

  return {
    percentile5: allSimulations[Math.floor(simulations * 0.05)],
    percentile25: allSimulations[Math.floor(simulations * 0.25)],
    percentile50: allSimulations[Math.floor(simulations * 0.50)],
    percentile75: allSimulations[Math.floor(simulations * 0.75)],
    percentile95: allSimulations[Math.floor(simulations * 0.95)],
    successProbability: (successCount / simulations) * 100,
    expectedFinalValue: finalValues[Math.floor(simulations * 0.50)],
    monthlyData,
  };
}

function calculateRequiredContribution(
  currentValue: number,
  targetValue: number,
  months: number,
  expectedReturn: number = 0.08
): number {
  const monthlyRate = expectedReturn / 12;
  const fvCurrent = currentValue * Math.pow(1 + monthlyRate, months);
  const amountNeeded = targetValue - fvCurrent;
  if (amountNeeded <= 0) return 0;
  const pmt = amountNeeded * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
  return Math.max(0, pmt);
}

interface GoalFormData {
  name: string;
  targetAmount: number;
  targetGrowth: number;
  timelineMonths: number;
  monthlyContribution: number;
  expectedReturn: number;
  volatility: number;
}

function FormWithCalculation({ form, setForm, currentValue }: {
  form: GoalFormData;
  setForm: (f: GoalFormData) => void;
  currentValue: number;
}) {
  // Auto-calculate required monthly contribution
  const monthlyRate = form.expectedReturn / 100 / 12;
  const months = form.timelineMonths;
  const target = form.targetAmount;

  // Future value of current assets with compound growth
  const futureValueOfAssets = currentValue * Math.pow(1 + monthlyRate, months);
  const growthFromAssets = futureValueOfAssets - currentValue;

  // Gap remaining after asset growth
  const gap = Math.max(0, target - futureValueOfAssets);

  // Required monthly contribution (PMT formula for future value of annuity)
  const calculatedContribution = gap > 0 && monthlyRate > 0
    ? gap * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)
    : 0;

  // Total contributions over the period
  const totalContributions = calculatedContribution * months;

  // Auto-update monthly contribution when target/timeline/return changes
  useEffect(() => {
    setForm({ ...form, monthlyContribution: Math.round(calculatedContribution) });
  }, [form.targetAmount, form.timelineMonths, form.expectedReturn]);

  return (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label>Goal Name</Label>
        <Input
          placeholder="e.g., Retirement Fund, House Down Payment..."
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Target Amount ($)</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={form.targetAmount || ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              setForm({
                ...form,
                targetAmount: val,
                targetGrowth: currentValue > 0 ? Math.round(((val - currentValue) / currentValue) * 100) : form.targetGrowth,
              });
            }}
            className="pl-9"
            placeholder="0"
          />
        </div>
        {currentValue > 0 && form.targetAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            {(((form.targetAmount - currentValue) / currentValue) * 100).toFixed(1)}% growth from current {formatCurrency(currentValue)}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Timeline</Label>
          <span className="text-sm font-medium">
            {form.timelineMonths} months ({(form.timelineMonths / 12).toFixed(1)} yrs)
          </span>
        </div>
        <Slider
          value={[form.timelineMonths]}
          onValueChange={(v) => setForm({ ...form, timelineMonths: v[0] })}
          min={3}
          max={120}
          step={1}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Expected Annual Return</Label>
          <span className="text-sm font-medium">{form.expectedReturn}%</span>
        </div>
        <Slider
          value={[form.expectedReturn]}
          onValueChange={(v) => setForm({ ...form, expectedReturn: v[0] })}
          min={1}
          max={20}
          step={0.5}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Market Volatility</Label>
          <span className="text-sm font-medium">{form.volatility}%</span>
        </div>
        <Slider
          value={[form.volatility]}
          onValueChange={(v) => setForm({ ...form, volatility: v[0] })}
          min={5}
          max={40}
          step={1}
        />
      </div>

      {/* Auto-calculated breakdown */}
      {form.targetAmount > 0 && currentValue > 0 && (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4 text-primary" />
            Breakdown
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current assets</span>
              <span>{formatCurrency(currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Growth from assets ({form.expectedReturn}%/yr)</span>
              <span className="text-green-500">+{formatCurrency(growthFromAssets)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assets at end of {months} months</span>
              <span>{formatCurrency(futureValueOfAssets)}</span>
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gap to target</span>
              <span className={gap > 0 ? 'text-amber-500' : 'text-green-500'}>
                {gap > 0 ? formatCurrency(gap) : 'Already covered!'}
              </span>
            </div>
            {gap > 0 && (
              <>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Required monthly contribution</span>
                  <span className="text-primary">{formatCurrency(calculatedContribution)}/mo</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total contributions over {months} months</span>
                  <span>{formatCurrency(totalContributions)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual override for monthly contribution */}
      <div className="space-y-2">
        <Label>Monthly Contribution (auto-calculated, editable)</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={form.monthlyContribution}
            onChange={(e) => setForm({ ...form, monthlyContribution: Number(e.target.value) })}
            className="pl-9"
          />
        </div>
        {form.monthlyContribution < calculatedContribution && form.targetAmount > 0 && gap > 0 && (
          <p className="text-xs text-amber-500">
            Below the required {formatCurrency(calculatedContribution)}/mo — you may not reach your target
          </p>
        )}
        {form.monthlyContribution >= calculatedContribution && form.targetAmount > 0 && gap > 0 && (
          <p className="text-xs text-green-500">
            On track to reach your goal
          </p>
        )}
      </div>
    </div>
  );
}

const defaultForm: GoalFormData = {
  name: '',
  targetAmount: 0,
  targetGrowth: 10,
  timelineMonths: 12,
  monthlyContribution: 500,
  expectedReturn: 8,
  volatility: 15,
};

export default function GoalsPage() {
  const { getTotalValue, getTotalCost } = usePortfolioStore();
  const { goals, activeGoalId, addGoal, updateGoal, removeGoal, setActiveGoal } = useGoalsStore();

  const [mounted, setMounted] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavedGoal | null>(null);
  const [form, setForm] = useState<GoalFormData>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const currentValue = mounted ? getTotalValue() : 0;
  const totalCost = mounted ? getTotalCost() : 0;
  const currentGain = currentValue - totalCost;
  const currentGainPercent = totalCost > 0 ? (currentGain / totalCost) * 100 : 0;

  const activeGoal = goals.find(g => g.id === activeGoalId) || goals[0] || null;

  const targetValue = activeGoal
    ? (activeGoal.targetAmount > 0 ? activeGoal.targetAmount : currentValue * (1 + activeGoal.targetGrowth / 100))
    : currentValue;

  const amountToGain = targetValue - currentValue;
  const progressPercent = activeGoal && activeGoal.targetGrowth > 0
    ? Math.min(100, Math.max(0, (currentGainPercent / activeGoal.targetGrowth) * 100))
    : 0;

  const requiredContribution = useMemo(() => {
    if (!activeGoal || currentValue <= 0) return 0;
    return calculateRequiredContribution(currentValue, targetValue, activeGoal.timelineMonths, activeGoal.expectedReturn / 100);
  }, [activeGoal, currentValue, targetValue]);

  // Run simulation when active goal changes
  useEffect(() => {
    if (!mounted || !activeGoal || currentValue <= 0) {
      setSimulationResult(null);
      return;
    }

    setIsSimulating(true);
    setTimeout(() => {
      const result = runMonteCarloSimulation(
        currentValue,
        targetValue,
        activeGoal.monthlyContribution,
        activeGoal.timelineMonths,
        activeGoal.expectedReturn / 100,
        activeGoal.volatility / 100,
        1000
      );
      setSimulationResult(result);
      setIsSimulating(false);
    }, 100);
  }, [mounted, activeGoal, currentValue, targetValue]);

  const openAddDialog = () => {
    setEditingGoal(null);
    setForm({
      ...defaultForm,
      targetAmount: Math.round(currentValue * 1.1),
    });
    setShowDialog(true);
  };

  const openEditDialog = (goal: SavedGoal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetGrowth: goal.targetGrowth,
      timelineMonths: goal.timelineMonths,
      monthlyContribution: goal.monthlyContribution,
      expectedReturn: goal.expectedReturn,
      volatility: goal.volatility,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        name: form.name.trim(),
        targetAmount: form.targetAmount,
        targetGrowth: form.targetGrowth,
        timelineMonths: form.timelineMonths,
        monthlyContribution: form.monthlyContribution,
        expectedReturn: form.expectedReturn,
        volatility: form.volatility,
      });
    } else {
      addGoal({
        name: form.name.trim(),
        targetAmount: form.targetAmount,
        targetGrowth: form.targetGrowth,
        timelineMonths: form.timelineMonths,
        monthlyContribution: form.monthlyContribution,
        expectedReturn: form.expectedReturn,
        volatility: form.volatility,
      });
    }

    setShowDialog(false);
    setEditingGoal(null);
  };

  const handleDelete = (id: string) => {
    removeGoal(id);
    setDeleteConfirm(null);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header title="Goal Tracker" subtitle="Set and track your investment goals" />
        <div className="p-3 md:p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-64 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Goal Tracker"
        subtitle="Set targets, track progress, and project future growth"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Current Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-primary/10">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Current Value</p>
                  <p className="text-lg md:text-2xl font-bold">{formatCurrency(currentValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-green-500/10">
                  <Target className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Target</p>
                  <p className="text-lg md:text-2xl font-bold">{formatCurrency(targetValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={cn("p-1.5 md:p-2 rounded-full", currentGain >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
                  <TrendingUp className={cn("h-4 w-4 md:h-5 md:w-5", currentGain >= 0 ? "text-green-500" : "text-red-500")} />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Current P/L</p>
                  <p className={cn("text-lg md:text-2xl font-bold", currentGain >= 0 ? "text-green-500" : "text-red-500")}>
                    {currentGain >= 0 ? '+' : ''}{formatCurrency(currentGain)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-blue-500/10">
                  <Percent className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Progress</p>
                  <p className="text-lg md:text-2xl font-bold">{progressPercent.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Goals List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                My Goals
              </CardTitle>
              <Button size="sm" onClick={openAddDialog} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Goal</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No goals yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first investment goal to start tracking progress</p>
                <Button onClick={openAddDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Goal
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {goals.map((goal) => {
                  const goalTarget = goal.targetAmount > 0 ? goal.targetAmount : currentValue * (1 + goal.targetGrowth / 100);
                  const goalProgress = goalTarget > 0 ? Math.min(100, Math.max(0, (currentValue / goalTarget) * 100)) : 0;
                  const isActive = goal.id === (activeGoalId || goals[0]?.id);

                  return (
                    <div
                      key={goal.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-all",
                        isActive ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      )}
                      onClick={() => setActiveGoal(goal.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{goal.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {goal.timelineMonths} months • {goal.expectedReturn}% return
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(goal); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(goal.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Target</span>
                          <span className="font-medium">{formatCurrency(goalTarget)}</span>
                        </div>
                        <Progress value={goalProgress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{goalProgress.toFixed(0)}% reached</span>
                          <span>{formatCurrency(monthlyContrib(goal))} / mo needed</span>
                        </div>
                      </div>

                      {isActive && (
                        <Badge className="mt-2 bg-primary/10 text-primary border-primary/20">
                          Active
                        </Badge>
                      )}
                    </div>
                  );

                  function monthlyContrib(g: SavedGoal) {
                    const gt = g.targetAmount > 0 ? g.targetAmount : currentValue * (1 + g.targetGrowth / 100);
                    return calculateRequiredContribution(currentValue, gt, g.timelineMonths, g.expectedReturn / 100);
                  }
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Goal Details */}
        {activeGoal && (
          <>
            {/* Goal Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {activeGoal.name}: {activeGoal.targetGrowth}% Growth
                </CardTitle>
                <CardDescription>
                  You need to gain {formatCurrency(amountToGain)} to reach your target of {formatCurrency(targetValue)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={progressPercent} className="h-4" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Start: {formatCurrency(totalCost)}</span>
                    <span className="font-medium">Current: {formatCurrency(currentValue)}</span>
                    <span className="text-muted-foreground">Target: {formatCurrency(targetValue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monte Carlo Simulation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Monte Carlo Projection
                  <Badge variant="outline" className="ml-2">1,000 simulations</Badge>
                </CardTitle>
                <CardDescription>
                  Probability distribution of potential outcomes over {activeGoal.timelineMonths} months
                </CardDescription>
              </CardHeader>
              <CardContent>
                {simulationResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {simulationResult.successProbability >= 70 ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : simulationResult.successProbability >= 40 ? (
                          <AlertTriangle className="h-6 w-6 text-yellow-500" />
                        ) : (
                          <AlertTriangle className="h-6 w-6 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">Probability of Reaching Goal</p>
                          <p className={cn(
                            "text-2xl font-bold",
                            simulationResult.successProbability >= 70 ? "text-green-500" :
                            simulationResult.successProbability >= 40 ? "text-yellow-500" : "text-red-500"
                          )}>
                            {simulationResult.successProbability.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Expected Value</p>
                        <p className="text-xl font-semibold">{formatCurrency(simulationResult.expectedFinalValue)}</p>
                      </div>
                    </div>

                    <div className="h-[250px] md:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={simulationResult.monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                          <XAxis dataKey="month" tickFormatter={(m) => `M${m}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(m) => `Month ${m}`}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <ReferenceLine y={targetValue} stroke="#ef4444" strokeDasharray="5 5" />
                          <Area type="monotone" dataKey="p95" stackId="1" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.1} name="95th Percentile" />
                          <Area type="monotone" dataKey="p75" stackId="2" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.2} name="75th Percentile" />
                          <Area type="monotone" dataKey="p50" stackId="3" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.3} name="Median" />
                          <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Median Path" />
                          <Line type="monotone" dataKey="p5" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="3 3" dot={false} name="5th Percentile" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <p className="text-xs md:text-sm text-muted-foreground">Worst (5%)</p>
                        <p className="font-semibold">{formatCurrency(simulationResult.monthlyData[simulationResult.monthlyData.length - 1].p5)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10">
                        <p className="text-xs md:text-sm text-muted-foreground">Likely (50%)</p>
                        <p className="font-semibold">{formatCurrency(simulationResult.monthlyData[simulationResult.monthlyData.length - 1].p50)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <p className="text-xs md:text-sm text-muted-foreground">Best (95%)</p>
                        <p className="font-semibold">{formatCurrency(simulationResult.monthlyData[simulationResult.monthlyData.length - 1].p95)}</p>
                      </div>
                    </div>
                  </div>
                ) : isSimulating ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Running simulation...
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Add positions to your portfolio to run simulations
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Required Contribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Required Monthly Contribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Required</p>
                    <p className="text-2xl md:text-3xl font-bold text-primary">{formatCurrency(requiredContribution)}/mo</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      At {activeGoal.expectedReturn}% annual return
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Your Contribution</p>
                    <p className="text-2xl md:text-3xl font-bold">{formatCurrency(activeGoal.monthlyContribution)}/mo</p>
                    <p className={cn(
                      "text-xs mt-2",
                      activeGoal.monthlyContribution >= requiredContribution ? "text-green-500" : "text-yellow-500"
                    )}>
                      {activeGoal.monthlyContribution >= requiredContribution
                        ? "On track!"
                        : `Need ${formatCurrency(requiredContribution - activeGoal.monthlyContribution)} more/mo`}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Total Over {activeGoal.timelineMonths} Months</p>
                    <p className="text-2xl md:text-3xl font-bold">{formatCurrency(activeGoal.monthlyContribution * activeGoal.timelineMonths)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Plus current {formatCurrency(currentValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add/Edit Goal Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
          </DialogHeader>

          <FormWithCalculation form={form} setForm={setForm} currentValue={currentValue} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Goal?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this goal. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
