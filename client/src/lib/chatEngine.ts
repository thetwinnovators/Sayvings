// ─── Sayvings Chat Engine ─────────────────────────────────────────────────────
// Rule-based, non-AI chat assistant. Fully deterministic.

import { ClarityData, formatCurrency, computeNetWorth, computeTotalDebt, computeDebtFreeMonths, computeGoalMonths, formatMonths } from './storage';

type Intent =
  | 'GREETING' | 'GENERAL_STATUS' | 'DEBT_ADVICE' | 'BUDGET_STATUS'
  | 'GOAL_STATUS' | 'WINDFALL_ADVICE' | 'EMERGENCY_EXPENSE' | 'RETIREMENT_ADVICE'
  | 'BILL_INQUIRY' | 'NET_WORTH' | 'SAVINGS_RATE' | 'PAYCHECK_PLANNING'
  | 'MOTIVATION' | 'COMPARISON' | 'WHAT_IF' | 'THANKS' | 'FALLBACK';

interface IntentScore { intent: Intent; score: number; }

const INTENT_MAP: Record<Intent, string[]> = {
  GREETING:          ['hi', 'hello', 'hey', 'good morning', 'morning', "what's up", 'howdy', 'sup'],
  GENERAL_STATUS:    ['how am i doing', 'how am i', 'status', 'overview', 'summary', 'update', 'where do i stand', 'check in', 'catch up'],
  DEBT_ADVICE:       ['debt', 'owe', 'credit card', 'loan', 'balance', 'interest', 'payoff', 'pay off', 'minimum payment', 'apr', 'interest rate', 'borrow'],
  BUDGET_STATUS:     ['budget', 'spending', 'spent', 'how much', 'categories', 'left', 'remaining', 'overspend', 'over budget', 'expenses'],
  GOAL_STATUS:       ['goal', 'saving for', 'savings', 'progress', 'on track', 'how close', 'when will i', 'target', 'milestone'],
  WINDFALL_ADVICE:   ['bonus', 'tax refund', 'extra money', 'inheritance', 'got paid', 'raise', 'overtime', 'side hustle', 'lump sum', 'windfall', 'stimulus', 'refund'],
  EMERGENCY_EXPENSE: ['emergency', 'broke', 'unexpected', 'car', 'medical', 'hospital', 'repair', 'broke down', 'accident', 'urgent', 'broke my'],
  RETIREMENT_ADVICE: ['retirement', '401k', 'retire', 'employer match', 'roth', 'ira', 'investing', 'pension'],
  BILL_INQUIRY:      ['bill', 'due', 'payment due', 'when is', 'upcoming', 'subscription', 'auto pay'],
  NET_WORTH:         ['net worth', 'assets', 'liabilities', 'total', 'wealth', 'worth', 'overall'],
  SAVINGS_RATE:      ['saving enough', 'savings rate', 'how much saving', 'percentage', 'am i saving'],
  PAYCHECK_PLANNING: ['paycheck', 'payday', 'get paid', 'next paycheck', 'allocate', 'what to do with', 'direct deposit'],
  MOTIVATION:        ['struggling', 'hard', 'give up', 'behind', 'discouraged', 'stress', 'worried', 'anxious', 'overwhelmed', 'hopeless', 'scared', 'depressed', "can't do", 'failing'],
  COMPARISON:        ['normal', 'average', 'compared to', 'others', 'everyone else', 'should i be', 'behind everyone'],
  WHAT_IF:           ['what if', 'suppose', 'hypothetically', 'if i', 'imagine', 'scenario', 'would happen', 'could i'],
  THANKS:            ['thank', 'thanks', 'appreciate', 'helpful', 'great job', 'perfect', 'awesome', 'love it'],
  FALLBACK:          [],
};

function detectIntent(message: string, lastIntent: Intent | null): Intent {
  const lower = message.toLowerCase();
  const scores: IntentScore[] = [];

  for (const [intent, keywords] of Object.entries(INTENT_MAP) as [Intent, string[]][]) {
    if (intent === 'FALLBACK') continue;
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += kw.split(' ').length > 1 ? 3 : 1;
    }
    // Context boost: if last was DEBT_ADVICE and message mentions a loan/card
    if (lastIntent === 'DEBT_ADVICE' && intent === 'DEBT_ADVICE') score += 2;
    if (lastIntent === 'WHAT_IF' && intent === 'WHAT_IF') score += 2;
    if (score > 0) scores.push({ intent, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.length > 0 && scores[0].score >= 1 ? scores[0].intent : 'FALLBACK';
}

function parseAmount(message: string): number | null {
  const patterns = [
    /\$([0-9,]+(?:\.[0-9]{1,2})?)/,
    /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:dollars?|bucks?)/i,
    /([0-9]+(?:\.[0-9]+)?)\s*k\b/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)/,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m) {
      let val = parseFloat(m[1].replace(/,/g, ''));
      if (message.match(/\bk\b/i) && !message.startsWith('$')) val *= 1000;
      return val;
    }
  }
  return null;
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getHour(): number { return new Date().getHours(); }
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = getHour();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function allocateWindfall(amount: number, data: ClarityData): { items: {label: string; amount: number; reason: string}[]; } {
  const items: {label: string; amount: number; reason: string}[] = [];
  let remaining = amount;

  // 1. High-interest debt (>15%)
  const highDebt = data.debts.filter(d => d.apr > 15).sort((a,b) => b.apr - a.apr);
  for (const d of highDebt) {
    if (remaining <= 0) break;
    const pay = Math.min(remaining, d.balance);
    if (pay > 50) {
      items.push({ label: `Pay ${d.name}`, amount: pay, reason: `${d.apr}% APR, highest return guaranteed` });
      remaining -= pay;
    }
  }

  // 2. Emergency fund gap
  const emergencyGoal = data.goals.find(g => g.icon === 'emergency');
  if (emergencyGoal && remaining > 0) {
    const gap = emergencyGoal.targetAmount - emergencyGoal.currentAmount;
    if (gap > 0) {
      const contribute = Math.min(remaining * 0.5, gap);
      if (contribute > 50) {
        items.push({ label: `Emergency fund`, amount: Math.round(contribute), reason: `Build your safety net to ${formatCurrency(emergencyGoal.targetAmount)}` });
        remaining -= contribute;
      }
    }
  }

  // 3. Medium debt (8-15%)
  const medDebt = data.debts.filter(d => d.apr >= 8 && d.apr <= 15).sort((a,b) => b.apr - a.apr);
  for (const d of medDebt) {
    if (remaining <= 100) break;
    const pay = Math.min(remaining * 0.6, d.balance);
    if (pay > 50) {
      items.push({ label: `Pay ${d.name}`, amount: Math.round(pay), reason: `${d.apr}% APR, good return` });
      remaining -= pay;
    }
  }

  // 4. Other goals
  if (remaining > 100) {
    const otherGoal = data.goals.find(g => g.icon !== 'emergency');
    if (otherGoal) {
      items.push({ label: otherGoal.name, amount: Math.round(remaining), reason: `Put the rest toward your goal` });
      remaining = 0;
    } else {
      items.push({ label: `High-yield savings`, amount: Math.round(remaining), reason: `Earn 4-5% APY while you decide` });
    }
  }

  return { items };
}

// ─── Response generators ─────────────────────────────────────────────────────

function buildResponse(intent: Intent, message: string, data: ClarityData, lastIntent: Intent | null): { content: string; chips: string[] } {
  const name = data.profile?.firstName || 'there';
  const tod = getTimeOfDay();
  const netWorth = computeNetWorth(data);
  const totalDebt = computeTotalDebt(data.debts);
  const monthlyIncome = data.profile?.monthlyIncome || 0;

  switch (intent) {
    case 'GREETING': {
      const greetings = {
        morning: [
          `Morning ${name}! ☀️ Ready to make moves today?`,
          `Hey ${name}! You're up early! Let's see where things stand.`,
          `Good morning ${name}! Finn here. What are we working on today?`,
        ],
        afternoon: [
          `Hey ${name}! 👋 How's the afternoon going?`,
          `What's up ${name}! Checking in on your money situation?`,
        ],
        evening: [
          `Hey ${name}! Good time to check in before tomorrow.`,
          `Evening ${name}, wrapping up the day? Let's take a look at your numbers.`,
        ],
        night: [
          `Hey ${name}, still up? I got you. What's on your mind?`,
          `Late night check-in, ${name}? Whatever it is, let's sort it out.`,
        ],
      };
      const greeting = pick(greetings[tod]);
      const hook = totalDebt > 0
        ? ` You're currently ${formatCurrency(Math.abs(netWorth))} away from a positive net worth.`
        : netWorth > 0
          ? ` Your net worth is ${formatCurrency(netWorth)} and growing.`
          : '';
      return {
        content: greeting + hook,
        chips: ['How am I doing overall?', 'Check my debt', 'What should I focus on?', 'Show my goals'],
      };
    }

    case 'GENERAL_STATUS': {
      const debtCount = data.debts.length;
      const goalCount = data.goals.length;
      const debtFreeMonths = debtCount > 0 ? computeDebtFreeMonths(data.debts) : 0;
      const savingsRate = monthlyIncome > 0
        ? Math.round((data.goals.reduce((s,g) => s + g.monthlyContribution, 0) / monthlyIncome) * 100)
        : 0;

      const parts: string[] = [];
      parts.push(`Here's your full picture, ${name}:`);
      parts.push(`\n\n**Net worth:** ${formatCurrency(netWorth)} ${netWorth >= 0 ? '📈' : ''}`);
      if (debtCount > 0) parts.push(`**Total debt:** ${formatCurrency(totalDebt)} across ${debtCount} account${debtCount > 1 ? 's' : ''} , debt-free in **${formatMonths(debtFreeMonths)}** at current pace`);
      if (goalCount > 0) parts.push(`**Goals:** ${goalCount} active goal${goalCount > 1 ? 's' : ''} in progress`);
      if (savingsRate > 0) parts.push(`**Savings rate:** ${savingsRate}% of income`);
      if (data.profile?.streak && data.profile.streak > 1) parts.push(`\n✓ You've been on plan for **${data.profile.streak} days** straight.`);

      return {
        content: parts.join('\n'),
        chips: ['Show my debt plan', 'Check my budget', 'View my goals', 'What should I do today?'],
      };
    }

    case 'DEBT_ADVICE': {
      if (!data.debts.length) {
        return {
          content: `You have no debts recorded yet, ${name}! That's either great news or we haven't added them yet. Want to add your debts so I can build you a payoff plan?`,
          chips: ['Add my debts', 'Check my goals', 'How am I doing?'],
        };
      }
      const sorted = [...data.debts].sort((a, b) => b.apr - a.apr);
      const topDebt = sorted[0];
      const monthlyInterest = topDebt.balance * (topDebt.apr / 100 / 12);
      const debtFreeMonths = computeDebtFreeMonths(data.debts);
      const acceleratedMonths = computeDebtFreeMonths(data.debts, 200);

      const variants = [
        `Your highest-cost debt is your **${topDebt.name}** at **${topDebt.apr}% APR**, costing you **${formatCurrency(monthlyInterest)}/month** in interest alone.\n\nAt your current payment rate, you'll be debt-free in **${formatMonths(debtFreeMonths)}**. Adding just $200/month extra cuts that to **${formatMonths(acceleratedMonths)}** and saves you significant interest.`,
        `Let me break down your debt picture. Your **${topDebt.name}** has the highest interest rate at **${topDebt.apr}%**. Every month you carry that balance costs you **${formatCurrency(monthlyInterest)}** in interest.\n\nWith the avalanche method (highest rate first), you're debt-free in **${formatMonths(debtFreeMonths)}**.`,
      ];

      return {
        content: pick(variants),
        chips: ['What if I paid $200 more/month?', 'Show avalanche vs snowball', 'Which debt costs the most?', 'Can my budget handle more?'],
      };
    }

    case 'BUDGET_STATUS': {
      if (!data.budget?.categories?.length) {
        return {
          content: `You haven't set up your budget categories yet, ${name}. That's the first step, takes about 2 minutes. Want to set it up now?`,
          chips: ['Set up my budget', 'How am I doing overall?'],
        };
      }
      const { totalBudgeted, totalSpent, remaining } = {
        totalBudgeted: data.budget?.categories?.reduce((s,c) => s+c.budgeted, 0) ?? 0,
        totalSpent: data?.budget?.categories?.reduce((s,c) => s+c.spent, 0) ?? 0,
        remaining: data?.budget?.categories?.reduce((s,c) => s+c.budgeted-c.spent, 0) ?? 0,
      };
      const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
      const dailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;
      const overCategories = data.budget?.categories?.filter(c => c.spent > c.budgeted);

      let response = `You've spent **${formatCurrency(totalSpent)}** of your **${formatCurrency(totalBudgeted)}** monthly budget.\n\n`;
      response += `**${formatCurrency(remaining)} remaining** with ${daysLeft} days left, that's **${formatCurrency(dailyBudget)}/day** to stay on track.`;
      if (overCategories.length) {
        response += `\n\n⚠️ Over budget in: ${overCategories.map(c => `**${c.name}** (+${formatCurrency(c.spent - c.budgeted)})`).join(', ')}`;
      } else {
        response += `\n\n✓ All categories on track. Well done.`;
      }

      return {
        content: response,
        chips: ['Where am I overspending?', 'Show daily budget', "What's due this week?", 'Log a transaction'],
      };
    }

    case 'GOAL_STATUS': {
      if (!data.goals.length) {
        return {
          content: `You haven't set any goals yet, ${name}. Goals are literally the whole point of Sayvings. Want to add your first one? Even something simple like an emergency fund.`,
          chips: ['Add emergency fund goal', 'Add house down payment goal', 'See goal options'],
        };
      }
      const goalLines = data.goals.map(g => {
        const months = computeGoalMonths(g);
        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
        return `**${g.name}:** ${formatCurrency(g.currentAmount)} of ${formatCurrency(g.targetAmount)} (${pct}%), ${formatMonths(months)} to go`;
      });
      return {
        content: `Here's how your goals are tracking, ${name}:\n\n${goalLines.join('\n')}`,
        chips: ['Which goal should I prioritize?', 'Add more to a goal', 'Update goal contribution', 'Add a new goal'],
      };
    }

    case 'WINDFALL_ADVICE': {
      const amount = parseAmount(message);
      if (!amount) {
        return {
          content: `Nice, extra money is always an opportunity! How much are we working with? Tell me the amount and I'll show you the best way to split it based on your situation.`,
          chips: ['$500', '$1,000', '$2,000', '$5,000'],
        };
      }
      const allocation = allocateWindfall(amount, data);
      let response = `Here's how I'd recommend allocating **${formatCurrency(amount)}** based on your current situation:\n\n`;
      for (const item of allocation.items) {
        response += `• **${formatCurrency(item.amount)} → ${item.label}**: ${item.reason}\n`;
      }
      response += `\nThis order maximizes your financial progress, highest guaranteed return first, then safety net, then goals.`;
      return {
        content: response,
        chips: ['What if I put it all on debt?', 'Update my plan with this', 'Show interest I would save', 'What about investing it?'],
      };
    }

    case 'EMERGENCY_EXPENSE': {
      const emergencyGoal = data.goals.find(g => g.icon === 'emergency');
      const amount = parseAmount(message);
      if (emergencyGoal && emergencyGoal.currentAmount > 0) {
        const coverage = monthlyIncome > 0 ? (emergencyGoal.currentAmount / monthlyIncome).toFixed(1) : '?';
        return {
          content: `Hey ${name}, this is exactly what your emergency fund is for. You have **${formatCurrency(emergencyGoal.currentAmount)}** saved (${coverage} months of coverage).\n\n${amount ? `For a **${formatCurrency(amount)}** expense, that leaves you **${formatCurrency(emergencyGoal.currentAmount - amount)}** after.` : ''}\n\nUse the emergency fund. That's not a setback, that's the system working. Then we rebuild it together.`,
          chips: ['How do I rebuild fast?', 'Update my emergency fund balance', 'Adjust my monthly contribution'],
        };
      }
      return {
        content: `That's stressful, ${name}, and I want to help you handle it without derailing your plan.\n\nYou don't have an emergency fund recorded yet. For right now: pause any extra debt payments this month and redirect that cash to cover this expense. Then let's make building a $1,000 safety cushion your top priority. It'll protect you next time.`,
        chips: ['Add emergency fund goal', 'How much should I pause?', 'See my options'],
      };
    }

    case 'RETIREMENT_ADVICE': {
      const r = data.retirement;
      if (!r) {
        return {
          content: `Let's get your retirement picture set up, ${name}. I need a few numbers: your current 401k balance, your contribution rate, and whether your employer offers a match. Once I have those, I can tell you exactly whether you're on track.`,
          chips: ['Set up retirement profile', 'What is employer match?', 'How much should I contribute?'],
        };
      }
      const yearsToRetire = (r.retireAge ?? 65) - (r.currentAge ?? 30);
      const contribMonthly = r.monthlyContribution ?? 0;
      const matchPct = r.employerMatchPct ?? 0;
      let response = `Your 401k picture, ${name}:\n\n`;
      response += `**Current balance:** ${formatCurrency(r.currentBalance ?? 0)}\n`;
      response += `**Monthly contribution:** ${formatCurrency(contribMonthly)}/mo\n`;
      response += `**Years to retirement:** ${yearsToRetire}\n\n`;
      if (matchPct > 0 && contribMonthly * 12 < (data.profile?.monthlyIncome ?? 0) * 12 * matchPct / 100) {
        response += `⚠️ You may be leaving **employer match** on the table. Your employer matches up to ${matchPct}%, so contributing at least that amount is an **instant 50-100% return**.`;
      } else {
        response += `✓ You're capturing your full employer match, which is the most important first step.`;
      }
      return {
        content: response,
        chips: ['Am I on track to retire?', 'What if I increase my contribution?', 'Explain employer match', 'Show retirement projection'],
      };
    }

    case 'BILL_INQUIRY': {
      if (!data.bills.length) {
        return {
          content: `You haven't added any bills yet, ${name}. Adding your recurring bills lets me send you reminders and factor them into your cash flow. Want to add them now?`,
          chips: ['Add my bills', 'View financial calendar'],
        };
      }
      const upcoming = data.bills
        .filter(b => !b.recurring)
        .map(b => ({ ...b, daysUntil: b.dueDay - new Date().getDate() }))
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 4);
      const billLines = upcoming.map(b => {
        const urgency = b.daysUntil <= 2 ? '🔴' : b.daysUntil <= 5 ? '🟡' : '🟢';
        return `${urgency} **${b.name}**, ${formatCurrency(b.amount)} due in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`;
      });
      return {
        content: `Here are your upcoming bills:\n\n${billLines.join('\n')}`,
        chips: ['Mark a bill as paid', 'Add a bill', 'View all bills', 'Show this month total'],
      };
    }

    case 'NET_WORTH': {
      const assets = data.goals.reduce((s, g) => s + g.currentAmount, 0);
      return {
        content: `Your net worth snapshot, ${name}:\n\n**Assets (savings):** ${formatCurrency(assets)}\n**Liabilities (debts):** ${formatCurrency(totalDebt)}\n**Net worth:** ${formatCurrency(netWorth)}\n\n${netWorth < 0 ? `You're ${formatCurrency(Math.abs(netWorth))} from zero. Every payment and contribution moves that number up.` : `Positive net worth! Keep building.`}`,
        chips: ['How do I improve this?', 'Show my debt plan', 'Check my savings'],
      };
    }

    case 'WHAT_IF': {
      const amount = parseAmount(message);
      const isDebt = /debt|loan|credit|card/i.test(message);
      const isIncome = /raise|income|earn|salary/i.test(message);

      if (amount && isDebt && data.debts.length > 0) {
        const current = computeDebtFreeMonths(data.debts);
        const accelerated = computeDebtFreeMonths(data.debts, amount);
        const saved = current - accelerated;
        return {
          content: `Great question. If you put an extra **${formatCurrency(amount)}/month** toward debt:\n\n• **Current path:** debt-free in ${formatMonths(current)}\n• **With extra payment:** debt-free in ${formatMonths(accelerated)}\n• **You'd save:** ${saved} month${saved !== 1 ? 's' : ''}\n\nWant me to check if your budget can absorb that extra ${formatCurrency(amount)}?`,
          chips: ['Yes, check my budget', 'What if it was more?', 'Show full debt plan'],
        };
      }
      if (amount && isIncome) {
        const extraAnnual = amount * 12;
        return {
          content: `A ${formatCurrency(amount)}/month raise adds **${formatCurrency(extraAnnual)}/year** to your income. Here's how I'd recommend allocating it:\n\n• Capture any uncaptured 401k match first\n• Then accelerate your highest-interest debt\n• Then boost your emergency fund if under 3 months\n• Remainder toward your top goal\n\nWant me to build a specific allocation plan for that raise?`,
          chips: ['Build allocation plan', 'How much goes to debt?', 'What about taxes?'],
        };
      }
      return {
        content: `I can run that scenario for you, just give me a bit more detail. What number are you thinking about changing, and by how much?`,
        chips: ['Extra $200/month on debt', 'What if I got a $500 raise?', 'What if I cut expenses $300?'],
      };
    }

    case 'MOTIVATION': {
      const wins: string[] = [];
      if (data.profile?.streak && data.profile.streak > 1) wins.push(`${data.profile.streak} days on your plan`);
      if (totalDebt > 0) wins.push(`you've chosen to face your debt head-on, most people don't`);
      if (data.goals.length > 0) wins.push(`you have ${data.goals.length} active goal${data.goals.length > 1 ? 's' : ''} in motion`);

      const winStr = wins.length > 0 ? `\n\nHere's what's true right now: ${wins.join(', ')}.` : '';
      return {
        content: `Hey ${name}, real talk: money stress is heavy and I get it. You're not alone in this.${winStr}\n\nHere's the move: forget the whole plan for a second. What's just the ONE next thing you can do today? Not tomorrow, today. That's it. That's the whole goal right now.`,
        chips: ["What's my one thing today?", 'Show me a win', 'How close am I to a goal?', 'Just talk'],
      };
    }

    case 'COMPARISON': {
      const savingsRate = monthlyIncome > 0
        ? Math.round((data.goals.reduce((s,g) => s + g.monthlyContribution, 0) / monthlyIncome) * 100)
        : 0;
      return {
        content: `Here's some real context, ${name}:\n\n• **Average US savings rate:** ~3.5%, ${savingsRate >= 3 ? `you're at ${savingsRate}%, which is ${savingsRate > 3.5 ? 'above' : 'around'} average` : `a goal to work toward`}\n• **Average credit card debt:** ~$6,500\n• **Average emergency fund coverage:** 1.2 months\n\nComparisons are tricky, they show you the middle, not the direction. What matters is whether *your* numbers are moving the right way. And based on what you've shared, you're working on it.`,
        chips: ['Am I saving enough?', 'How do I improve my savings rate?', 'Show my net worth progress'],
      };
    }

    case 'SAVINGS_RATE': {
      const totalContributions = data.goals.reduce((s,g) => s + g.monthlyContribution, 0);
      const savingsRate = monthlyIncome > 0 ? Math.round((totalContributions / monthlyIncome) * 100) : 0;
      const target = 20;
      return {
        content: `Your current savings rate is **${savingsRate}%** of your monthly income.\n\n${savingsRate >= target ? `✓ You're at or above the recommended ${target}%, solid.` : `The recommended target is ${target}%. You're contributing ${formatCurrency(totalContributions)}/month, and increasing by ${formatCurrency(Math.round((monthlyIncome * (target / 100)) - totalContributions))} more would get you there.`}`,
        chips: ['How do I save more?', 'What should I cut?', 'Show my budget gaps'],
      };
    }

    case 'PAYCHECK_PLANNING': {
      const debtPayments = data.debts.reduce((s,d) => s + d.minPayment, 0);
      const goalContributions = data.goals.reduce((s,g) => s + g.monthlyContribution, 0);
      const bills = data.bills.reduce((s,b) => s + b.amount, 0);
      const discretionary = monthlyIncome - debtPayments - goalContributions - bills;
      return {
        content: `Here's how to think about your next paycheck of **${formatCurrency(monthlyIncome)}**:\n\n1. **Bills & fixed expenses:** ${formatCurrency(bills)}\n2. **Debt minimum payments:** ${formatCurrency(debtPayments)}\n3. **Goal contributions:** ${formatCurrency(goalContributions)}\n4. **Remaining for discretionary:** ${formatCurrency(Math.max(0, discretionary))}\n\n${discretionary < 0 ? `⚠️ Your fixed obligations exceed your income, let's look at where to adjust.` : `✓ Your obligations are covered with ${formatCurrency(discretionary)} left for flexible spending.`}`,
        chips: ['Can I increase my debt payment?', 'How do I optimize this?', 'Add extra to a goal', 'Show my budget'],
      };
    }

    case 'THANKS': {
      return {
        content: pick([
          `Anytime, ${name}! That's literally what I'm here for. What else you got?`,
          `Of course! You're doing great, seriously. What else is on your mind?`,
          `Always. You're making moves, ${name}. Keep it up. Anything else?`,
        ]),
        chips: ['How am I doing overall?', 'Check my debt', 'View my goals'],
      };
    }

    default: {
      return {
        content: pick([
          `Hmm, I'm not sure I got that one, but I'm really good at money stuff, ${name}. What do you want to check?`,
          `Ha, that one's a bit out of my lane! I stick to your finances. What do you want to dig into?`,
          `I didn't catch that, but I'm here for your money questions. What's on your mind?`,
        ]),
        chips: ['How am I doing?', 'Check my debt', 'Check my budget', 'View my goals'],
      };
    }
  }
}

// ─── Main exported function ──────────────────────────────────────────────────

export interface ChatResponse {
  content: string;
  chips: string[];
  delay: number;
}

let lastIntent: Intent | null = null;

export function processMessage(message: string, data: ClarityData): Promise<ChatResponse> {
  const intent = detectIntent(message, lastIntent);
  lastIntent = intent;

  const { content, chips } = buildResponse(intent, message, data, lastIntent);

  // Simulate natural typing delay
  const delay = Math.min(Math.max(content.length * 18, 600), 2200);

  return new Promise(resolve => {
    setTimeout(() => resolve({ content, chips, delay: 0 }), delay);
  });
}

export function getWelcomeMessage(data: ClarityData): { content: string; chips: string[] } {
  const name = data.profile?.firstName || 'there';
  const tod = getTimeOfDay();
  const netWorth = computeNetWorth(data);
  const totalDebt = computeTotalDebt(data.debts);

  const greeting = tod === 'morning' ? `Morning ${name}! ☀️`
    : tod === 'afternoon' ? `Hey ${name}!`
    : tod === 'evening' ? `Evening ${name}!`
    : `Hey ${name}, late night, I see 👀`;

  const hook = totalDebt > 0
    ? ` You're ${formatCurrency(Math.abs(netWorth))} away from a positive net worth. We'll get there. What do you want to tackle?`
    : ` Your net worth is sitting at ${formatCurrency(netWorth)} and climbing. Nice work. What's on your mind?`;

  return {
    content: greeting + hook,
    chips: ['How am I doing overall?', 'Check my debt', 'Check my budget', 'Show my goals'],
  };
}
