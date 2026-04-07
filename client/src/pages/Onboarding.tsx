import { useState, useEffect, useRef, useCallback } from 'react';
import { saveData, type Debt, type Goal } from '@/lib/storage';
import { RotateCcw, Send, ArrowRight, Shield, Home, Plane, Car, TrendingUp, Flame } from 'lucide-react';

// ─── Finn Avatar ───────────────────────────────────────────────────────────────
function FinnAvatar({ size = 34 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white select-none"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: 'linear-gradient(135deg, #01696F 0%, #2E8B8F 100%)',
        boxShadow: '0 2px 8px rgba(1,105,111,0.22)',
      }}>
      F
    </div>
  );
}

// ─── Typing dots ───────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex items-end gap-2.5">
      <FinnAvatar size={30} />
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: 'white', border: '1px solid var(--divider)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex gap-1 items-center" style={{ height: 16 }}>
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

// ─── Goal arc SVG ─────────────────────────────────────────────────────────────
function GoalArc({ pct, size = 120 }: { pct: number; size?: number }) {
  const r = (size / 2) - 10;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -210;
  const endAngle = 30;
  const totalDeg = endAngle - startAngle;
  const arcDeg = totalDeg * Math.min(pct, 1);

  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPath = (deg: number) => {
    const x = cx + r * Math.cos(toRad(deg));
    const y = cy + r * Math.sin(toRad(deg));
    return { x, y };
  };

  const p1 = arcPath(startAngle);
  const p2 = arcPath(startAngle + arcDeg);
  const bg2 = arcPath(endAngle);
  const largeBg = totalDeg > 180 ? 1 : 0;
  const largeArc = arcDeg > 180 ? 1 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <path
        d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeBg} 1 ${bg2.x} ${bg2.y}`}
        fill="none" stroke="rgba(1,105,111,0.12)" strokeWidth="8" strokeLinecap="round"
      />
      {/* Progress */}
      {arcDeg > 0 && (
        <path
          d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`}
          fill="none" stroke="url(#tealGrad)" strokeWidth="8" strokeLinecap="round"
        />
      )}
      <defs>
        <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#01696F" />
          <stop offset="100%" stopColor="#2E8B8F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Savings Calendar (mini 12-week savings dots) ─────────────────────────────
function SavingsCalendar({ weeklyAmt }: { weeklyAmt: number }) {
  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 7);
    return {
      label: d.toLocaleString('default', { month: 'short', day: 'numeric' }),
      saved: i === 0, // first week is "today"
    };
  });

  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        SAVINGS SCHEDULE · NEXT 12 WEEKS
      </p>
      <div className="flex flex-wrap gap-1.5">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: w.saved ? 'var(--teal)' : i < 4 ? 'rgba(1,105,111,0.12)' : 'var(--surface-2)',
                color: w.saved ? 'white' : i < 4 ? 'var(--teal)' : 'var(--text-faint)',
              }}>
              {i + 1}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
        ~${weeklyAmt.toLocaleString()} / week toward your goal
      </p>
    </div>
  );
}

// ─── Message types ─────────────────────────────────────────────────────────────
interface FinnMsg       { kind: 'finn';         text: string }
interface UserMsg       { kind: 'user';         text: string }
interface OptionMsg     {
  kind: 'options';
  text: string;
  options: { label: string; emoji?: string; sub?: string; value: string }[];
  allowCustom?: boolean;
  customPrompt?: string;
  customType?: 'text' | 'number';
  customPlaceholder?: string;
  stageKey: string;
}
interface InlineInputMsg {
  kind: 'inline-input';
  prompt: string;
  inputType: 'text' | 'number';
  placeholder: string;
  stageKey: string;
}
type Msg = FinnMsg | UserMsg | OptionMsg | InlineInputMsg;

// ─── Stage ────────────────────────────────────────────────────────────────────
type Stage =
  | 'intro' | 'ask-name' | 'ask-income'
  | 'ask-debt' | 'debt-type' | 'debt-balance' | 'debt-apr' | 'debt-more'
  | 'ask-goal' | 'goal-amount' | 'goal-contrib' | 'done';

const ROLLBACK: Partial<Record<Stage, Stage>> = {
  'ask-income':   'ask-name',
  'ask-debt':     'ask-income',
  'debt-type':    'ask-debt',
  'debt-balance': 'debt-type',
  'debt-apr':     'debt-balance',
  'debt-more':    'debt-apr',
  'ask-goal':     'debt-more',
  'goal-amount':  'ask-goal',
  'goal-contrib': 'goal-amount',
  'done':         'goal-contrib',
};

// ─── Summary card shown after chat completes ──────────────────────────────────
interface SummaryData {
  firstName: string;
  goalName: string;
  goalTarget: number;
  monthlyContrib: number;
  monthsToGoal: number;
  reachDate: string;
  monthlyIncome: number;
  debts: Debt[];
  goalIcon: string;
}

function CompletionDashboard({ data, onEnter }: { data: SummaryData; onEnter: () => void }) {
  const pct = 0; // starts at 0
  const weeklyAmt = Math.round(data.monthlyContrib / 4.33);
  const totalDebt = data.debts.reduce((s, d) => s + d.balance, 0);

  const GoalIcon = data.goalIcon === 'emergency' ? Shield
    : data.goalIcon === 'home' ? Home
    : data.goalIcon === 'vacation' ? Plane
    : data.goalIcon === 'car' ? Car
    : TrendingUp;

  // Build 6-month savings projection
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      saved: Math.min((i + 1) * data.monthlyContrib, data.goalTarget),
    };
  });
  const maxSaved = data.goalTarget;

  return (
    <div className="mx-1 mb-4 rounded-3xl overflow-hidden"
      style={{ background: 'white', border: '1px solid var(--divider)', boxShadow: '0 4px 24px rgba(1,105,111,0.10)' }}>

      {/* ── Hero: goal arc ── */}
      <div className="px-5 pt-5 pb-4"
        style={{ background: 'linear-gradient(160deg, #E0F2F2 0%, #F7FFFE 100%)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--teal)', color: 'white' }}>
            <GoalIcon size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--teal)' }}>Your Goal</p>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.goalName}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>target</p>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              ${data.goalTarget.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Arc + center stat */}
        <div className="flex items-center justify-center" style={{ position: 'relative', height: 120 }}>
          <GoalArc pct={pct} size={120} />
          <div className="absolute flex flex-col items-center" style={{ top: 28 }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--teal)', lineHeight: 1 }}>$0</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>saved so far</p>
          </div>
        </div>

        {/* Reach date badge */}
        <div className="flex items-center justify-center mt-2">
          <span className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: 'rgba(1,105,111,0.12)', color: 'var(--teal)' }}>
            🎯 On track to reach by {data.reachDate}
          </span>
        </div>
      </div>

      {/* ── 6-month bar chart ── */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--divider)' }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
          6-Month Savings Projection
        </p>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {months.map((m, i) => {
            const h = Math.round((m.saved / maxSaved) * 48);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md"
                  style={{
                    height: Math.max(4, h),
                    background: i === months.length - 1 && m.saved >= maxSaved
                      ? 'var(--teal)'
                      : `rgba(1,105,111,${0.15 + i * 0.12})`,
                  }} />
                <span className="text-xs" style={{ color: 'var(--text-faint)', fontSize: 10 }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Savings calendar ── */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
        <SavingsCalendar weeklyAmt={weeklyAmt} />
      </div>

      {/* ── Today's budget task ── */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
          Today's Task
        </p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(234,179,8,0.12)', color: '#ca8a04' }}>
            💡
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Set up your first budget category
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Takes 2 minutes and helps Finn give you better advice
            </p>
          </div>
        </div>
      </div>

      {/* ── Debt snapshot (if any) ── */}
      {data.debts.length > 0 && (
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
            Debt Overview
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                ${totalDebt.toLocaleString()}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                across {data.debts.length} debt{data.debts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-1.5">
              {data.debts.slice(0, 3).map((d, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: d.apr >= 20 ? 'rgba(239,68,68,0.1)' : d.apr >= 10 ? 'rgba(234,179,8,0.1)' : 'rgba(1,105,111,0.1)',
                    color: d.apr >= 20 ? '#ef4444' : d.apr >= 10 ? '#ca8a04' : 'var(--teal)',
                  }}>
                  {d.apr}% APR
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Streak ── */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Flame size={18} color="#f97316" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Day 1 streak started 🔥</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Come back tomorrow to keep it going
            </p>
          </div>
          <span className="ml-auto text-lg font-bold" style={{ color: '#f97316' }}>1</span>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-5 py-4">
        <button
          onClick={onEnter}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
          style={{
            background: 'linear-gradient(135deg, #01696F 0%, #2E8B8F 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(1,105,111,0.28)',
          }}>
          Let's go, {data.firstName} 🚀
          <ArrowRight size={16} />
        </button>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-faint)' }}>
          Your data lives on this device, always private
        </p>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [stage, setStage]       = useState<Stage>('intro');
  const [isTyping, setIsTyping] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  // Collected data
  const [firstName,   setFirstName]   = useState('');
  const [income,      setIncome]      = useState(0); // yearly salary
  const [debts,       setDebts]       = useState<Debt[]>([]);
  const pendingDebt = useRef({ name: '', balance: 0, apr: 0 });
  const [goalName,    setGoalName]    = useState('Emergency Fund');
  const [goalTarget,  setGoalTarget]  = useState(1000);

  // Inline input
  const [inputValue,  setInputValue]  = useState('');
  const [inputActive, setInputActive] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── helpers ───────────────────────────────────────────────────────────────
  const push = (msg: Msg) => setMsgs(m => [...m, msg]);

  const say = useCallback((text: string, delay = 700) => new Promise<void>(resolve => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); push({ kind: 'finn', text }); resolve(); }, delay);
  }), []);

  const ask = useCallback((
    text: string,
    options: OptionMsg['options'],
    stageKey: string,
    delay = 700,
    extra?: Pick<OptionMsg, 'allowCustom' | 'customPrompt' | 'customType' | 'customPlaceholder'>
  ) => new Promise<void>(resolve => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      push({ kind: 'options', text, options, stageKey, ...extra });
      resolve();
    }, delay);
  }), []);

  const showInlineInput = useCallback((
    prompt: string,
    inputType: 'text' | 'number',
    placeholder: string,
    stageKey: string,
    delay = 500
  ) => new Promise<void>(resolve => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      push({ kind: 'inline-input', prompt, inputType, placeholder, stageKey });
      setInputActive(true);
      resolve();
      setTimeout(() => inputRef.current?.focus(), 80);
    }, delay);
  }), []);

  const collapseInteractive = () =>
    setMsgs(m => m.map((msg): Msg => {
      if (msg.kind === 'options')      return { kind: 'finn', text: msg.text };
      if (msg.kind === 'inline-input') return { kind: 'finn', text: msg.prompt };
      return msg;
    }));

  // ── Undo ─────────────────────────────────────────────────────────────────
  const [rollbackCount, setRollbackCount] = useState(0);
  const rollbackStageRef = useRef<Stage | null>(null);

  const handleUndo = () => {
    setMsgs(m => {
      const lastUserIdx = m.map(x => x.kind).lastIndexOf('user');
      if (lastUserIdx === -1) return m;
      let cutFrom = lastUserIdx;
      for (let i = lastUserIdx - 1; i >= 0; i--) {
        if (m[i].kind === 'finn' || m[i].kind === 'options') { cutFrom = i; break; }
      }
      return m.slice(0, cutFrom);
    });
    setInputActive(false);
    setInputValue('');
    const target = (ROLLBACK[stage] as Stage) || stage;
    rollbackStageRef.current = target;
    setStage(target);
    setRollbackCount(c => c + 1);
  };

  // ── Stage re-run on rollback ──────────────────────────────────────────────
  useEffect(() => {
    if (rollbackCount === 0) return;
    const s = rollbackStageRef.current;
    if (s && s !== 'intro') runStage(s);
  }, [rollbackCount]);

  // ── Kick off ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      await say("Hey! I'm Finn 👋 Think of me as that one friend who's actually good with money, but way less annoying about it 😄", 900);
      setStage('ask-name');
    };
    run();
  }, []);

  // ── Per-stage prompts (re-used on rollback) ───────────────────────────────
  const runStage = async (s: Stage) => {
    if (s === 'ask-name') {
      await showInlineInput("What's your name?", 'text', 'Type your first name…', 'ask-income', 500);
    }
    if (s === 'ask-income') {
      await ask(`${firstName || 'hey'}! What's your yearly salary (before tax)?`, [
        { label: 'Under $30k', value: '25000' },
        { label: '$30k – $50k', value: '40000' },
        { label: '$50k – $75k', value: '62500' },
        { label: '$75k – $100k', value: '87500' },
        { label: '$100k – $150k', value: '125000' },
        { label: 'Over $150k', value: '175000' },
        { label: 'Enter exact', value: '__custom__' },
      ], 'ask-debt', 600, {
        allowCustom: true, customPrompt: "What's your yearly salary?",
        customType: 'number', customPlaceholder: 'e.g. 65000',
      });
    }
    if (s === 'ask-debt') {
      const monthly = Math.round(income / 12);
      await say(`So about $${monthly.toLocaleString()} a month before tax - got it. 💪`, 700);
      await ask("Any debts right now? Credit cards, loans… no judgment here, I promise.", [
        { label: "Yeah, a few 💳", value: 'yes' },
        { label: "Just one", value: 'one' },
        { label: "Nope, debt-free! 🙌", value: 'no' },
      ], 'debt-type', 1000);
    }
    if (s === 'debt-type') {
      await ask("What kind?", [
        { label: 'Credit card', emoji: '💳', value: 'Credit Card' },
        { label: 'Student loan', emoji: '🎓', value: 'Student Loan' },
        { label: 'Car loan', emoji: '🚗', value: 'Car Loan' },
        { label: 'Personal loan', emoji: '📋', value: 'Personal Loan' },
        { label: 'Medical debt', emoji: '🏥', value: 'Medical Debt' },
        { label: 'Something else…', value: '__custom__' },
      ], 'debt-balance', 600, {
        allowCustom: true, customPrompt: "What's it called? (e.g. Chase Sapphire card)",
        customType: 'text', customPlaceholder: 'e.g. Chase Sapphire card…',
      });
    }
    if (s === 'debt-balance') {
      const name = pendingDebt.current.name;
      await ask(`What's the balance on your ${name}?`, [
        { label: 'Under $1,000', value: '800' },
        { label: '$1,000 – $3,000', value: '2000' },
        { label: '$3,000 – $7,000', value: '5000' },
        { label: '$7,000 – $15,000', value: '10000' },
        { label: 'Over $15,000', value: '18000' },
        { label: 'Enter exact', value: '__custom__' },
      ], 'debt-apr', 600, {
        allowCustom: true, customPrompt: "What's the exact balance?",
        customType: 'number', customPlaceholder: 'e.g. 4500',
      });
    }
    if (s === 'debt-apr') {
      await ask("What's the interest rate?", [
        { label: '0%',  sub: 'Promo / interest-free', value: '0' },
        { label: '~6%', sub: 'Student loans', value: '6' },
        { label: '~10%', sub: 'Auto / personal', value: '10' },
        { label: '~20%', sub: 'Typical credit card', value: '20' },
        { label: '~27%', sub: 'High-rate card', value: '27' },
        { label: "Not sure 🤷", value: '20' },
      ], 'debt-more', 600, {
        allowCustom: true, customPrompt: "What's the APR?",
        customType: 'number', customPlaceholder: 'e.g. 22.5',
      });
    }
    if (s === 'debt-more') {
      await ask("Any other debts?", [
        { label: 'Add another ➕', value: 'yes' },
        { label: "That's all ✅", value: 'no' },
      ], 'ask-goal', 600);
    }
    if (s === 'ask-goal') {
      await ask("What's the main thing you're saving for?", [
        { label: 'Emergency fund', emoji: '🛡️', sub: 'Safety net everyone needs', value: 'Emergency Fund' },
        { label: 'House / down payment', emoji: '🏠', value: 'House Down Payment' },
        { label: 'Vacation', emoji: '✈️', value: 'Vacation' },
        { label: 'New car', emoji: '🚗', value: 'New Car' },
        { label: 'Pay off debt faster', emoji: '💸', value: 'Pay Off Debt' },
        { label: 'Something else…', value: '__custom__' },
      ], 'goal-amount', 800, {
        allowCustom: true, customPrompt: "What are you saving for?",
        customType: 'text', customPlaceholder: 'e.g. Wedding fund, new laptop…',
      });
    }
    if (s === 'goal-amount') {
      const defaults: Record<string, Array<{label: string; value: string}>> = {
        'Emergency Fund':     [{label:'$500',value:'500'},{label:'$1,000',value:'1000'},{label:'$3,000',value:'3000'},{label:'$5,000',value:'5000'}],
        'House Down Payment': [{label:'$10k',value:'10000'},{label:'$20k',value:'20000'},{label:'$50k',value:'50000'}],
        'Vacation':           [{label:'$500',value:'500'},{label:'$1,500',value:'1500'},{label:'$3,000',value:'3000'},{label:'$5,000',value:'5000'}],
        'New Car':            [{label:'$3,000',value:'3000'},{label:'$8,000',value:'8000'},{label:'$15,000',value:'15000'}],
        'Pay Off Debt':       [{label:'$2,000',value:'2000'},{label:'$5,000',value:'5000'},{label:'$10,000',value:'10000'}],
      };
      const amounts = defaults[goalName] || [{label:'$1,000',value:'1000'},{label:'$5,000',value:'5000'},{label:'$10,000',value:'10000'}];
      await ask(`${goalName} Nice. How much are you aiming for?`, [
        ...amounts,
        { label: 'My own number', value: '__custom__' },
      ], 'goal-contrib', 700, {
        allowCustom: true, customPrompt: "What's the target amount?",
        customType: 'number', customPlaceholder: 'e.g. 7500',
      });
    }
    if (s === 'goal-contrib') {
      const monthly = Math.round(income / 12);
      const s5  = Math.max(25,  Math.round(monthly * 0.05 / 25)  * 25);
      const s10 = Math.max(50,  Math.round(monthly * 0.10 / 50)  * 50);
      const s15 = Math.max(75,  Math.round(monthly * 0.15 / 50)  * 50);
      await ask(`$${goalTarget.toLocaleString()} Love it. How much can you put toward this each month?`, [
        { label: `$${s5.toLocaleString()}`,  sub: '~5% of income',  value: String(s5)  },
        { label: `$${s10.toLocaleString()}`, sub: '~10% of income', value: String(s10) },
        { label: `$${s15.toLocaleString()}`, sub: '~15% of income', value: String(s15) },
        { label: 'Set my own', value: '__custom__' },
      ], 'done', 700, {
        allowCustom: true, customPrompt: "How much per month works for you?",
        customType: 'number', customPlaceholder: 'e.g. 200',
      });
    }
  };

  // ── Handle picking a pill ─────────────────────────────────────────────────
  const handlePick = async (value: string, label: string, stageKey: string, customPrompt?: string, customType?: 'text' | 'number', customPlaceholder?: string) => {
    if (value === '__custom__') {
      collapseInteractive();
      await showInlineInput(customPrompt || "What's your answer?", customType || 'text', customPlaceholder || 'Type here…', stageKey);
      return;
    }
    collapseInteractive();
    setInputActive(false);
    await processAnswer(label, value, stageKey as Stage);
  };

  // ── Submit inline input ───────────────────────────────────────────────────
  const handleInlineSubmit = async (stageKey: string) => {
    const raw = inputValue.trim();
    if (!raw) return;
    setInputValue('');
    setInputActive(false);
    collapseInteractive();
    await processAnswer(raw, raw, stageKey as Stage);
  };

  // ── Core answer processor ─────────────────────────────────────────────────
  const processAnswer = async (label: string, value: string, s: Stage) => {
    push({ kind: 'user', text: label });

    // intro / ready
    if (s === 'ask-name') {
      if (value === 'explain') {
        await say("Just your name, income, any debts, and what you want to save. Nothing ever leaves your phone.", 800);
      }
      await showInlineInput("What's your name?", 'text', 'Type your first name…', 'ask-income', 600);
      setStage('ask-income');
      return;
    }

    // name → income
    if (s === 'ask-income' && firstName === '') {
      const name = label;
      setFirstName(name);
      await ask(`${name}! Great name. 😄 What's your yearly salary (before tax)?`, [
        { label: 'Under $30k', value: '25000' },
        { label: '$30k – $50k', value: '40000' },
        { label: '$50k – $75k', value: '62500' },
        { label: '$75k – $100k', value: '87500' },
        { label: '$100k – $150k', value: '125000' },
        { label: 'Over $150k', value: '175000' },
        { label: 'Enter exact', value: '__custom__' },
      ], 'ask-debt', 700, {
        allowCustom: true, customPrompt: "What's your yearly salary?",
        customType: 'number', customPlaceholder: 'e.g. 65000',
      });
      setStage('ask-debt');
      return;
    }

    // income (rollback path)
    if (s === 'ask-income') {
      setIncome(parseFloat(value) || 0);
      setStage('ask-debt');
      return;
    }

    // income → debt
    if (s === 'ask-debt') {
      const yearly = parseFloat(value) || 0;
      setIncome(yearly);
      const monthly = Math.round(yearly / 12);
      await ask(`Nice, about $${monthly.toLocaleString()}/mo before tax. Any debts right now? Credit cards, loans, no judgment at all 😊`, [
        { label: "Yeah, a few 💳", value: 'yes' },
        { label: "Just one", value: 'one' },
        { label: "Nope, debt-free! 🙌", value: 'no' },
      ], 'debt-type', 1000);
      setStage('debt-type');
      return;
    }

    // has debt?
    if (s === 'debt-type') {
      if (value === 'no') {
        setStage('ask-goal');
        return;
      }
      await ask("What kind of debt?", [
        { label: 'Credit card', emoji: '💳', value: 'Credit Card' },
        { label: 'Student loan', emoji: '🎓', value: 'Student Loan' },
        { label: 'Car loan', emoji: '🚗', value: 'Car Loan' },
        { label: 'Personal loan', emoji: '📋', value: 'Personal Loan' },
        { label: 'Medical debt', emoji: '🏥', value: 'Medical Debt' },
        { label: 'Something else…', value: '__custom__' },
      ], 'debt-balance', 600, {
        allowCustom: true, customPrompt: "What's it called?",
        customType: 'text', customPlaceholder: 'e.g. Chase Sapphire card…',
      });
      setStage('debt-balance');
      return;
    }

    // debt type → balance
    if (s === 'debt-balance') {
      pendingDebt.current = { ...pendingDebt.current, name: value };
      await ask(`What's the balance on your ${value}?`, [
        { label: 'Under $1,000', value: '800' },
        { label: '$1,000 – $3,000', value: '2000' },
        { label: '$3,000 – $7,000', value: '5000' },
        { label: '$7,000 – $15,000', value: '10000' },
        { label: 'Over $15,000', value: '18000' },
        { label: 'Enter exact', value: '__custom__' },
      ], 'debt-apr', 700, {
        allowCustom: true, customPrompt: "What's the exact balance?",
        customType: 'number', customPlaceholder: 'e.g. 4500',
      });
      setStage('debt-apr');
      return;
    }

    // balance → APR
    if (s === 'debt-apr') {
      pendingDebt.current = { ...pendingDebt.current, balance: parseFloat(value) || 2000 };
      await ask("What's the interest rate?", [
        { label: '0%',  sub: 'Promo / interest-free', value: '0' },
        { label: '~6%', sub: 'Student loans', value: '6' },
        { label: '~10%', sub: 'Auto / personal', value: '10' },
        { label: '~20%', sub: 'Typical credit card', value: '20' },
        { label: '~27%', sub: 'High-rate card', value: '27' },
        { label: "Not sure 🤷", value: '20' },
      ], 'debt-more', 600, {
        allowCustom: true, customPrompt: "What's the APR?",
        customType: 'number', customPlaceholder: 'e.g. 22.5',
      });
      setStage('debt-more');
      return;
    }

    // APR → log + more?
    if (s === 'debt-more') {
      const apr = parseFloat(value) || 20;
      const debt = pendingDebt.current;
      const newDebt: Debt = {
        id: crypto.randomUUID(), name: debt.name, balance: debt.balance, apr,
        minPayment: Math.max(25, Math.round(debt.balance * 0.02)), type: 'credit_card',
      };
      setDebts(prev => [...prev, newDebt]);
      await ask(`${debt.name} at ${apr}% logged 📝 Any other debts?`, [
        { label: 'Add another ➕', value: 'yes' },
        { label: "That's all ✅", value: 'no' },
      ], 'ask-goal', 700);
      setStage('ask-goal');
      return;
    }

    // more debts?
    if (s === 'ask-goal') {
      if (value === 'yes') {
        pendingDebt.current = { name: '', balance: 0, apr: 0 };
        await ask("What kind this time?", [
          { label: 'Credit card', emoji: '💳', value: 'Credit Card' },
          { label: 'Student loan', emoji: '🎓', value: 'Student Loan' },
          { label: 'Car loan', emoji: '🚗', value: 'Car Loan' },
          { label: 'Personal loan', emoji: '📋', value: 'Personal Loan' },
          { label: 'Something else…', value: '__custom__' },
        ], 'debt-balance', 600, {
          allowCustom: true, customPrompt: "What's it called?",
          customType: 'text', customPlaceholder: 'Debt name…',
        });
        setStage('debt-balance');
        return;
      }
      const total = debts.length;
      const debtAck = total > 0 ? `Got it, ${total} debt${total !== 1 ? 's' : ''} logged. Now the fun part: ` : '';
      await ask(`${debtAck}What's the main thing you're saving for?`, [
        { label: 'Emergency fund', emoji: '🛡️', sub: 'Safety net everyone needs', value: 'Emergency Fund' },
        { label: 'House / down payment', emoji: '🏠', value: 'House Down Payment' },
        { label: 'Vacation', emoji: '✈️', value: 'Vacation' },
        { label: 'New car', emoji: '🚗', value: 'New Car' },
        { label: 'Pay off debt faster', emoji: '💸', value: 'Pay Off Debt' },
        { label: 'Something else…', value: '__custom__' },
      ], 'goal-amount', 800, {
        allowCustom: true, customPrompt: "What are you saving for?",
        customType: 'text', customPlaceholder: 'e.g. Wedding fund, new laptop…',
      });
      setStage('goal-amount');
      return;
    }

    // goal type → amount
    if (s === 'goal-amount') {
      const gName = label;
      setGoalName(gName);
      const defaults: Record<string, Array<{label: string; value: string}>> = {
        'Emergency Fund':     [{label:'$500',value:'500'},{label:'$1,000',value:'1000'},{label:'$3,000',value:'3000'},{label:'$5,000',value:'5000'}],
        'House Down Payment': [{label:'$10k',value:'10000'},{label:'$20k',value:'20000'},{label:'$50k',value:'50000'}],
        'Vacation':           [{label:'$500',value:'500'},{label:'$1,500',value:'1500'},{label:'$3,000',value:'3000'},{label:'$5,000',value:'5000'}],
        'New Car':            [{label:'$3,000',value:'3000'},{label:'$8,000',value:'8000'},{label:'$15,000',value:'15000'}],
        'Pay Off Debt':       [{label:'$2,000',value:'2000'},{label:'$5,000',value:'5000'},{label:'$10,000',value:'10000'}],
      };
      const amounts = defaults[gName] || [{label:'$1,000',value:'1000'},{label:'$5,000',value:'5000'},{label:'$10,000',value:'10000'}];
      await ask(`${gName} solid choice! How much are you aiming for?`, [
        ...amounts,
        { label: 'My own number', value: '__custom__' },
      ], 'goal-contrib', 700, {
        allowCustom: true, customPrompt: "What's the target amount?",
        customType: 'number', customPlaceholder: 'e.g. 7500',
      });
      setStage('goal-contrib');
      return;
    }

    // goal amount → contribution
    if (s === 'goal-contrib') {
      const target = parseFloat(value) || 1000;
      setGoalTarget(target);
      const monthly = Math.round(income / 12);
      const s5  = Math.max(25,  Math.round(monthly * 0.05 / 25)  * 25);
      const s10 = Math.max(50,  Math.round(monthly * 0.10 / 50)  * 50);
      const s15 = Math.max(75,  Math.round(monthly * 0.15 / 50)  * 50);
      await ask(`$${target.toLocaleString()} Love it. How much can you put toward this each month?`, [
        { label: `$${s5.toLocaleString()}`,  sub: '~5% of income',  value: String(s5)  },
        { label: `$${s10.toLocaleString()}`, sub: '~10% of income', value: String(s10) },
        { label: `$${s15.toLocaleString()}`, sub: '~15% of income', value: String(s15) },
        { label: 'Set my own', value: '__custom__' },
      ], 'done', 700, {
        allowCustom: true, customPrompt: "How much per month works for you?",
        customType: 'number', customPlaceholder: 'e.g. 200',
      });
      setStage('done');
      return;
    }

    // Final -- save data + show completion dashboard
    if (s === 'done') {
      const contrib = parseFloat(value) || 100;
      const months = Math.ceil(goalTarget / contrib);
      const reachDate = new Date();
      reachDate.setMonth(reachDate.getMonth() + months);
      const reachDateStr = reachDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      await say(`At $${contrib}/mo you'll hit your goal by ${reachDateStr}. ${months <= 6 ? "That's so close!" : "Totally doable."} 🎯 Here's your plan, ${firstName || 'friend'} 👇`, 1000);

      const now = new Date();
      const monthly = Math.round(income / 12);
      const icon = goalName.toLowerCase().includes('emergency') ? 'emergency'
        : goalName.toLowerCase().includes('house') ? 'home'
        : goalName.toLowerCase().includes('vacation') ? 'vacation'
        : goalName.toLowerCase().includes('car') ? 'car'
        : 'other';

      const defaultGoal: Goal = {
        id: crypto.randomUUID(), name: goalName, targetAmount: goalTarget,
        currentAmount: 0, monthlyContribution: contrib, icon, priority: 'high',
      };

      saveData({
        profile: {
          firstName, lastName: '', email: '',
          monthlyIncome: monthly, incomeFrequency: 'monthly',
          onboardingComplete: true, createdAt: now.toISOString(),
          streak: 1, lastActiveDate: new Date().toDateString(),
        },
        debts,
        goals: [defaultGoal],
        budget: {
          month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          year: now.getFullYear(),
          categories: [],
        },
        bills: [], retirement: {}, chatHistory: [],
      });

      setSummaryData({
        firstName, goalName, goalTarget, monthlyContrib: contrib,
        monthsToGoal: months, reachDate: reachDateStr,
        monthlyIncome: monthly, debts, goalIcon: icon,
      });

      setStage('done');
    }
  };

  // ── Free question handler (mid-onboarding) ─────────────────────────────
  const [freeQ, setFreeQ] = useState('');
  const freeQRef = useRef<HTMLInputElement>(null);

  const finnQuickAnswer = (q: string): string => {
    const lower = q.toLowerCase();
    if (/\bwhy\b.*(name|called)/.test(lower) || /what.*sayvings/.test(lower))
      return 'Sayvings is a play on "sayings" and "savings". The idea is that your money intentions should match what you actually do. Simple as that 😄';
    if (/what.*(need|ask|collect|data|info)/.test(lower) || /why.*asking/.test(lower))
      return 'Just your name, income, any debts, and a savings goal. Nothing leaves your device, ever.';
    if (/private|safe|secure|data|stored|share/.test(lower))
      return 'Everything stays on your device, stored locally. No account, no server, no sharing. Just you and your numbers 🔒';
    if (/how long|take long|quick|fast|2 min/.test(lower))
      return 'About 2 minutes, maybe less if you tap fast 😄 Just a handful of questions.';
    if (/debt|owe|loan|credit/.test(lower))
      return "No worries about debt, I don't judge. Once you tell me what you have, I'll help you build a payoff plan that actually works.";
    if (/income|salary|pay|earn/.test(lower))
      return "I ask for your yearly salary so I can estimate a realistic monthly budget and savings plan. I won't share it with anyone.";
    if (/goal|saving for|save/.test(lower))
      return "Your goal is the whole point. Once I know what you're working toward, everything else in the app organises around it.";
    if (/skip|optional|must|have to/.test(lower))
      return "You can always update things later inside the app, so just give me your best estimate for now. Nothing is set in stone.";
    if (/hi|hello|hey/.test(lower))
      return "Hey! Ask me anything while we set up, I'm here 👋";
    return "Good question! I'm best at answering things about your finances once we're done setting up. But if you have a quick question about this process, fire away.";
  };

  const handleFreeQuestion = async () => {
    const q = freeQ.trim();
    if (!q) return;
    setFreeQ('');
    push({ kind: 'user', text: q });
    const answer = finnQuickAnswer(q);
    await say(answer, 700);
  };

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [msgs, isTyping, inputActive, summaryData]);

  useEffect(() => {
    if (inputActive) setTimeout(() => inputRef.current?.focus(), 80);
  }, [inputActive]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-5 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #E0F2F2 0%, #F0FAFA 55%, #ffffff 100%)' }}>
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#01696F" strokeWidth="2"/>
            <path d="M9 14.5C9 11.5 11.2 9 14 9s5 2.5 5 5.5" stroke="#01696F" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="14" cy="19" r="2.2" fill="#01696F"/>
            <line x1="14" y1="14.5" x2="14" y2="17" stroke="#01696F" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>Sayvings</span>
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(1,105,111,0.1)', color: 'var(--teal)' }}>
            {stage === 'done' ? 'All set ✓' : 'Getting started'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-shrink-0">
            <FinnAvatar size={46} />
            <span style={{ position:'absolute',bottom:0,right:0,width:13,height:13,borderRadius:'50%',background:'#22c55e',border:'2px solid white' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Finn</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your Sayvings buddy, always here for you</p>
          </div>
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

        {msgs.map((msg, i) => {

          if (msg.kind === 'finn') return (
            <div key={i} className="flex items-end gap-2.5">
              <FinnAvatar size={30} />
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
                style={{ background:'white', border:'1px solid var(--divider)', color:'var(--text-primary)', lineHeight:1.55, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', maxWidth:'82%' }}>
                {msg.text}
              </div>
            </div>
          );

          if (msg.kind === 'user') {
            const isLastUser = !msgs.slice(i + 1).some(m => m.kind === 'user');
            return (
              <div key={i} className="flex justify-end items-end gap-2">
                {isLastUser && stage !== 'done' && (
                  <button onClick={handleUndo}
                    className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 transition-colors active:scale-95"
                    style={{ color:'var(--text-faint)', background:'var(--surface-2)' }}>
                    <RotateCcw size={10} /> Edit
                  </button>
                )}
                <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-medium"
                  style={{ background:'rgba(1,105,111,0.09)', color:'var(--teal)', maxWidth:'75%', border:'1.5px solid rgba(1,105,111,0.15)' }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.kind === 'options') return (
            <div key={i} className="space-y-2.5">
              <div className="flex items-end gap-2.5">
                <FinnAvatar size={30} />
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
                  style={{ background:'white', border:'1px solid var(--divider)', color:'var(--text-primary)', lineHeight:1.55, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', maxWidth:'82%' }}>
                  {msg.text}
                </div>
              </div>
              <div className="pl-10 flex flex-row flex-wrap gap-2">
                {msg.options.map(opt => (
                  <button key={opt.value}
                    onClick={() => handlePick(opt.value, opt.label, msg.stageKey, msg.customPrompt, msg.customType, msg.customPlaceholder)}
                    className="text-sm font-medium rounded-full px-4 py-2 transition-all active:scale-95"
                    style={{ background:'rgba(1,105,111,0.09)', color:'var(--teal)', border:'1.5px solid rgba(1,105,111,0.15)', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                    {opt.emoji && <span style={{ fontSize:14 }}>{opt.emoji}</span>}
                    <span>
                      {opt.label}
                      {opt.sub && <span style={{ opacity:0.6, fontWeight:400, marginLeft:4, fontSize:11 }}> · {opt.sub}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );

          if (msg.kind === 'inline-input') return (
            <div key={i} className="space-y-2.5">
              <div className="flex items-end gap-2.5">
                <FinnAvatar size={30} />
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
                  style={{ background:'white', border:'1px solid var(--divider)', color:'var(--text-primary)', lineHeight:1.55, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', maxWidth:'82%' }}>
                  {msg.prompt}
                </div>
              </div>
              <div className="flex justify-end">
                <div className="flex items-center gap-2 rounded-2xl rounded-tr-sm"
                  style={{ background:'white', border:'1.5px solid var(--teal)', boxShadow:'0 2px 8px rgba(1,105,111,0.12)', maxWidth:'85%', width:'100%' }}>
                  <input
                    ref={inputRef}
                    type={msg.inputType}
                    inputMode={msg.inputType === 'number' ? 'numeric' : 'text'}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInlineSubmit(msg.stageKey)}
                    placeholder={msg.placeholder}
                    className="flex-1 bg-transparent text-sm px-4 py-3 outline-none"
                    style={{ color:'var(--text-primary)', minWidth:0 }}
                  />
                  <button onClick={() => handleInlineSubmit(msg.stageKey)} disabled={!inputValue.trim()}
                    className="mr-2 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                    style={{ background: inputValue.trim() ? 'var(--teal)' : 'var(--surface-2)', color: inputValue.trim() ? 'white' : 'var(--text-faint)' }}>
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          );

          return null;
        })}

        {isTyping && <TypingBubble />}

        {/* Completion dashboard */}
        {summaryData && !isTyping && (
          <CompletionDashboard data={summaryData} onEnter={onComplete} />
        )}

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Free question bar */}
      {stage !== 'done' && (
        <div className="flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid var(--divider)', background: 'white' }}>
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--divider)' }}>
            <input
              ref={freeQRef}
              type="text"
              value={freeQ}
              onChange={e => setFreeQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFreeQuestion()}
              placeholder="Ask Finn anything..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleFreeQuestion}
              disabled={!freeQ.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              style={{
                background: freeQ.trim() ? 'var(--teal)' : 'transparent',
                color: freeQ.trim() ? 'white' : 'var(--text-faint)',
              }}>
              <Send size={14} />
            </button>
          </div>
          <p className="text-center text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>Got a question? Just ask</p>
        </div>
      )}
    </div>
  );
}
