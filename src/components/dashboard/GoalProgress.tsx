'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Target } from 'lucide-react';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useGoalsStore } from '@/store/goalsStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import { differenceInDays } from 'date-fns';
import { useEffect } from 'react';
import Link from 'next/link';

export function GoalProgress() {
  const { goal, setGoal, updateGoalProgress } = useWatchlistStore();
  const { getActiveGoal } = useGoalsStore();
  const { getTotalValue } = usePortfolioStore();

  const totalValue = getTotalValue();
  const savedGoal = getActiveGoal();

  useEffect(() => {
    if (goal && goal.currentValue !== totalValue) {
      updateGoalProgress(totalValue);
    }
  }, [totalValue]);

  // Use watchlist goal first, fallback to saved goal from goals page
  if (goal) {
    const targetValue = goal.startingValue * (1 + goal.targetPercentage / 100);
    const currentGainPercent = ((goal.currentValue - goal.startingValue) / goal.startingValue) * 100;
    const progressPercent = Math.min((currentGainPercent / goal.targetPercentage) * 100, 100);
    const remainingToGoal = targetValue - goal.currentValue;

    const daysRemaining = goal.targetDate
      ? differenceInDays(new Date(goal.targetDate), new Date())
      : null;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            {goal.targetPercentage}% Growth Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={currentGainPercent >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                {formatPercent(currentGainPercent)}
              </span>
              <span className="text-muted-foreground">{goal.targetPercentage}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-medium">{formatCurrency(Math.max(0, remainingToGoal))}</p>
            </div>
            {daysRemaining !== null && (
              <div className="text-right">
                <p className="text-muted-foreground">Days Left</p>
                <p className="font-medium">{Math.max(0, daysRemaining)}</p>
              </div>
            )}
          </div>
          {goal.isAchieved && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-green-500 font-medium text-xs">Goal Achieved!</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback: use saved goal from goals page
  if (savedGoal) {
    const targetValue = savedGoal.targetAmount;
    const startingValue = targetValue / (1 + savedGoal.targetGrowth / 100);
    const progressPercent = startingValue !== targetValue
      ? Math.min(Math.max(0, ((totalValue - startingValue) / (targetValue - startingValue)) * 100), 100)
      : 0;
    const remainingToGoal = targetValue - totalValue;
    const monthsRemaining = savedGoal.timelineMonths;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            {savedGoal.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium">{formatCurrency(totalValue)}</span>
              <span className="text-muted-foreground">{formatCurrency(targetValue)}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-medium">{formatCurrency(Math.max(0, remainingToGoal))}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Timeline</p>
              <p className="font-medium">{monthsRemaining} months</p>
            </div>
          </div>
          {totalValue >= targetValue && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-green-500 font-medium text-xs">Goal Achieved!</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // No goal set
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Investment Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        <p className="text-xs text-muted-foreground text-center mb-3">
          Set a growth target
        </p>
        <Link href="/goals">
          <Button size="sm">Set Goal</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
