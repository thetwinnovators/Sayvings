// ─── Clarity localStorage Data Layer ────────────────────────────────────────
// All persistence via localStorage. No backend required.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  firstName: string;
  lastName?: string;
  email?: string;
  monthlyIncome: number;
  incomeFrequency: 'monthly' | 'biweekly' | 'weekly';
  onboardingComplete: boolean;
  createdAt: string;
  streak: number;
  lastActiveDate: string;
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;            // annual percentage rate
  minPayment: number;
  type: 'credit_card' | 'student_loan' | 'auto' | 'medical' | 'personal' | 'other';
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  targetDate?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
  type: 'need' | 'want' | 'savings';
  icon: string;
}

export interface Budget {
  month: string;   // e.g. "2025-01"
  year: number;
  categories: BudgetCategory[];
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;       // day of month 1-31
  category: 'housing' | 'utilities' | 'subscriptions' | 'insurance' | 'loan' | 'internet' | 'phone' | 'other';
  recurring: boolean;
}

export interface RetirementData {
  currentAge?: number;
  retireAge?: number;
  currentBalance?: number;
  monthlyContribution?: number;
  employerMatchPct?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  chips?: string[];
}

export interface ClarityData {
  profile: UserProfile | null;
  debts: Debt[];
  goals: Goal[];
  budget: Budget | null;
  bills: Bill[];
  retirement: RetirementData;
  chatHistory: ChatMessage[];
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'sayvings_v1';

function getDefaultData(): ClarityData {
  const now = new Date();
  return {
    profile: null,
    debts: [],
    goals: [],
    budget: {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      year: now.getFullYear(),
      categories: [],
    },
    bills: [],
    retirement: {},
    chatHistory: [],
  };
}

export function loadData(): ClarityData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultData();
    return {
      ...defaults,
      ...parsed,
      retirement: parsed.retirement || {},
      budget: parsed.budget || defaults.budget,
    };
  } catch {
    return getDefaultData();
  }
}

export function saveData(data: ClarityData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// ─── Computed helpers ─────────────────────────────────────────────────────────

export function computeNetWorth(data: ClarityData): number {
  const totalDebt = data.debts.reduce((s, d) => s + d.balance, 0);
  const totalSavings = data.goals.reduce((s, g) => s + g.currentAmount, 0);
  return totalSavings - totalDebt;
}

export function computeTotalDebt(debts: Debt[]): number {
  return debts.reduce((s, d) => s + d.balance, 0);
}

export function computeMonthlyDebtPayments(debts: Debt[]): number {
  return debts.reduce((s, d) => s + d.minPayment, 0);
}

export function computeBudgetTotals(categories: BudgetCategory[]) {
  const totalBudgeted = categories.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);
  return { totalBudgeted, totalSpent, remaining: totalBudgeted - totalSpent };
}

export function computeDebtFreeMonths(debts: Debt[], extraPayment = 0): number {
  if (!debts.length) return 0;
  // Avalanche method simulation
  let remaining = debts.map(d => ({ ...d })).sort((a, b) => b.apr - a.apr);
  const totalMinimum = remaining.reduce((s, d) => s + d.minPayment, 0);
  const totalPayment = totalMinimum + extraPayment;
  let months = 0;
  while (remaining.some(d => d.balance > 0) && months < 600) {
    months++;
    let availableExtra = extraPayment;
    for (const debt of remaining) {
      if (debt.balance <= 0) continue;
      const interest = debt.balance * (debt.apr / 100 / 12);
      debt.balance += interest;
      const pay = Math.min(debt.minPayment, debt.balance);
      debt.balance -= pay;
    }
    const target = remaining.find(d => d.balance > 0);
    if (target && availableExtra > 0) {
      target.balance = Math.max(0, target.balance - availableExtra);
    }
  }
  return months;
}

export function computeGoalMonths(goal: Goal): number {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return 0;
  if (!goal.monthlyContribution || goal.monthlyContribution <= 0) return 999;
  return Math.ceil(remaining / goal.monthlyContribution);
}

export function formatCurrency(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      notation: 'compact', maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonths(months: number): string {
  if (months <= 0) return 'Done!';
  if (months >= 999) return 'Set a contribution';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}yr`;
  return `${years}yr ${rem}mo`;
}

export function getDaysUntil(dayOfMonth: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (target.getTime() < now.getTime()) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function updateStreak(profile: UserProfile): UserProfile {
  const today = new Date().toDateString();
  if (profile.lastActiveDate === today) return profile;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const newStreak = profile.lastActiveDate === yesterday.toDateString()
    ? profile.streak + 1 : 1;
  return { ...profile, streak: newStreak, lastActiveDate: today };
}

// ─── Windfall allocator (used by chat engine) ─────────────────────────────────
export function allocateWindfall(amount: number, data: ClarityData): string {
  const debts = data.debts || [];
  const goals = data.goals || [];
  const lines: string[] = [];
  let remaining = amount;

  // 1. Emergency fund check
  const emergency = goals.find(g => g.icon === 'emergency');
  const emergencyTarget = (data.profile?.monthlyIncome || 0) * 3;
  if (emergency && emergency.currentAmount < emergencyTarget) {
    const need = Math.min(remaining, emergencyTarget - emergency.currentAmount);
    lines.push(`${formatCurrency(need)} → Emergency Fund`);
    remaining -= need;
  }

  // 2. High-APR debts
  const highDebt = debts.filter(d => d.apr > 15).sort((a, b) => b.apr - a.apr);
  for (const d of highDebt) {
    if (remaining <= 0) break;
    const pay = Math.min(remaining, d.balance);
    lines.push(`${formatCurrency(pay)} → ${d.name} (${d.apr}% APR)`);
    remaining -= pay;
  }

  // 3. Goals
  if (remaining > 0 && goals.length) {
    const active = goals.filter(g => g.currentAmount < g.targetAmount);
    if (active.length > 0) {
      lines.push(`${formatCurrency(remaining)} → Split across your goals`);
      remaining = 0;
    }
  }

  if (remaining > 0) lines.push(`${formatCurrency(remaining)} → General savings`);
  return lines.join('\n');
}
