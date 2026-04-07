import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  loadData, saveData, computeNetWorth, computeTotalDebt,
  computeDebtFreeMonths, computeGoalMonths, formatCurrency,
  formatMonths, getDaysUntil, updateStreak, type ClarityData
} from '@/lib/storage';
import { TrendingUp, TrendingDown, ChevronRight, MessageCircle } from 'lucide-react';

// ── Donut ring ─────────────────────────────────────────────────────────────
function DonutRing({ pct, size = 52, stroke = 5, color = 'var(--teal)', bg = 'var(--surface-3)' }: {
  pct: number; size?: number; stroke?: number; color?: string; bg?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} />
    </svg>
  );
}

// ── Wavy SVG decoration ────────────────────────────────────────────────────
function WaveDecor() {
  return (
    <svg viewBox="0 0 200 60" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 40, opacity: 0.12 }}>
      <path d="M0 30 Q50 0 100 30 Q150 60 200 30 L200 60 L0 60 Z" fill="white" />
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ClarityData>(() => loadData());

  useEffect(() => {
    const d = loadData();
    if (d.profile) {
      const updated = updateStreak(d.profile);
      if (updated !== d.profile) {
        saveData({ ...d, profile: updated });
        setData({ ...d, profile: updated });
      }
    }
  }, []);

  const { profile, debts, goals, bills } = data;
  const netWorth = computeNetWorth(data);
  const totalDebt = computeTotalDebt(debts);
  const totalSavings = goals.reduce((s, g) => s + g.currentAmount, 0);
  const debtFreeMonths = debts.length > 0 ? computeDebtFreeMonths(debts) : 0;
  const topDebt = [...debts].sort((a, b) => b.apr - a.apr)[0];
  const upcomingBills = bills
    .filter(b => b.recurring)
    .map(b => ({ ...b, daysUntil: getDaysUntil(b.dueDay) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  const tod = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  })();

  const isPositive = netWorth >= 0;
  const savingsProgress = totalSavings + totalDebt > 0
    ? Math.round((totalSavings / (totalSavings + totalDebt)) * 100)
    : 0;

  const GOAL_EMOJI: Record<string, string> = {
    emergency: '🛡️', vacation: '✈️', home: '🏠', car: '🚗',
    wedding: '💍', education: '🎓', retirement: '🌅', other: '🎯',
  };

  return (
    <div className="max-w-xl mx-auto overflow-x-hidden animate-fade-in">

      {/* ── Hero banner ── */}
      <div className="relative px-5 pt-8 pb-10 overflow-hidden"
        style={{
          background: isPositive
            ? 'linear-gradient(135deg, #01696F 0%, #2E8B8F 60%, #4FA8AD 100%)'
            : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        }}>
        <WaveDecor />

        {/* Greeting */}
        <p className="text-sm font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Good {tod}{profile?.firstName ? `, ${profile.firstName}` : ''} 👋
        </p>

        {/* Net worth big number */}
        <div className="flex items-end gap-3 mb-1">
          <span className="text-4xl font-bold stat-number text-white leading-none">
            {formatCurrency(netWorth)}
          </span>
          <span className="text-sm font-medium mb-0.5 flex items-center gap-1"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            Net Worth
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 mb-4" style={{ height: 5, borderRadius: 9999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 9999,
            background: 'rgba(255,255,255,0.85)',
            width: `${Math.max(3, savingsProgress)}%`,
            transition: 'width 1s ease',
          }} />
        </div>

        {/* Sub-stats */}
        <div className="flex gap-6">
          {[
            { label: 'Income /mo', value: formatCurrency(profile?.monthlyIncome || 0, true) },
            { label: 'Saved', value: formatCurrency(totalSavings, true) },
            { label: 'Debt', value: formatCurrency(totalDebt, true) },
          ].map(s => (
            <div key={s.label}>
              <p className="stat-number text-base font-semibold text-white">{s.value}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Streak badge */}
        {profile?.streak && profile.streak > 1 && (
          <div className="absolute top-6 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(8px)' }}>
            🔥 {profile.streak} day streak
          </div>
        )}
      </div>

      <div className="px-5 py-6 space-y-7">

        {/* ── KPI tiles (2×2 grid) ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Savings rate */}
          <div className="sv-tile" style={{ background: 'var(--teal-pale)' }}>
            <span className="sv-tile-icon">💰</span>
            <p className="text-xs font-medium" style={{ color: 'var(--teal)' }}>Savings rate</p>
            <p className="text-2xl font-bold stat-number" style={{ color: 'var(--teal)' }}>
              {profile?.monthlyIncome
                ? `${Math.round((goals.reduce((s, g) => s + g.monthlyContribution, 0) / profile.monthlyIncome) * 100)}%`
                : '--'}
            </p>
            <p className="text-xs" style={{ color: 'var(--teal-light)' }}>of monthly income</p>
          </div>

          {/* Debt-free in */}
          <div className="sv-tile" style={{ background: debts.length ? 'var(--warning-pale)' : 'var(--success-pale)' }}>
            <span className="sv-tile-icon">{debts.length ? '📉' : '🎉'}</span>
            <p className="text-xs font-medium" style={{ color: debts.length ? 'var(--warning-color)' : 'var(--success-color)' }}>
              {debts.length ? 'Debt-free in' : 'Debt'}
            </p>
            <p className="text-2xl font-bold stat-number" style={{ color: debts.length ? 'var(--warning-color)' : 'var(--success-color)' }}>
              {debts.length ? formatMonths(debtFreeMonths) : 'Clear!'}
            </p>
            <p className="text-xs" style={{ color: debts.length ? '#B45309' : '#15803D' }}>
              {debts.length ? `${debts.length} account${debts.length > 1 ? 's' : ''}` : 'No debts recorded'}
            </p>
          </div>

          {/* Goals progress */}
          <div className="sv-tile" style={{ background: 'var(--purple-pale)' }}>
            <span className="sv-tile-icon">🎯</span>
            <p className="text-xs font-medium" style={{ color: 'var(--purple-color)' }}>Goals</p>
            <p className="text-2xl font-bold stat-number" style={{ color: 'var(--purple-color)' }}>
              {goals.length > 0 ? `${goals.filter(g => g.currentAmount >= g.targetAmount).length}/${goals.length}` : '--'}
            </p>
            <p className="text-xs" style={{ color: '#6D28D9' }}>
              {goals.length > 0 ? 'complete' : 'no goals yet'}
            </p>
          </div>

          {/* Net worth direction */}
          <div className="sv-tile" style={{ background: isPositive ? 'var(--success-pale)' : 'var(--danger-pale)' }}>
            <span className="sv-tile-icon">{isPositive ? '📈' : '📊'}</span>
            <p className="text-xs font-medium" style={{ color: isPositive ? 'var(--success-color)' : 'var(--danger-color)' }}>
              Net worth
            </p>
            <p className="text-xl font-bold stat-number leading-tight" style={{ color: isPositive ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {isPositive ? 'Positive' : `−${formatCurrency(Math.abs(netWorth), true)}`}
            </p>
            <p className="text-xs" style={{ color: isPositive ? '#15803D' : '#B91C1C' }}>
              {isPositive ? 'Keep building 💪' : 'working on it'}
            </p>
          </div>
        </div>

        {/* ── Goals section ── */}
        {goals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="sv-section-label" style={{ marginBottom: 0 }}>Your goals</p>
              <Link href="/goals" className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                See all →
              </Link>
            </div>

            <div className="space-y-2.5">
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                const months = computeGoalMonths(g);
                const emoji = GOAL_EMOJI[g.icon] || '🎯';
                const done = pct >= 100;
                return (
                  <div key={g.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                    style={{
                      background: done ? 'var(--success-pale)' : 'var(--surface-1)',
                      borderColor: done ? 'rgba(22,163,74,0.2)' : 'var(--divider)',
                    }}>
                    {/* Emoji + ring */}
                    <div className="relative flex-shrink-0">
                      <DonutRing pct={pct} size={48} stroke={4.5}
                        color={done ? 'var(--success-color)' : 'var(--teal)'}
                        bg={done ? 'rgba(22,163,74,0.15)' : 'var(--surface-3)'} />
                      <span style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%,-50%)', fontSize: 14,
                      }}>{emoji}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{g.name}</p>
                      <div className="mt-1 sv-progress-track" style={{ height: 4 }}>
                        <div className="sv-progress-fill" style={{
                          width: `${pct}%`,
                          background: done ? 'var(--success-color)' : 'var(--teal)',
                        }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                        {formatCurrency(g.currentAmount)} of {formatCurrency(g.targetAmount)}
                        {!done && months > 0 && ` · ${formatMonths(months)} left`}
                        {done && ' · Done! 🎉'}
                      </p>
                    </div>

                    <span className="text-sm font-bold stat-number flex-shrink-0"
                      style={{ color: done ? 'var(--success-color)' : 'var(--teal)' }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Debt section ── */}
        {debts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="sv-section-label" style={{ marginBottom: 0 }}>Debt tracker</p>
              <Link href="/debt" className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                Payoff plan →
              </Link>
            </div>

            <div className="space-y-2">
              {debts.slice(0, 3).map(d => {
                const danger = d.apr >= 20;
                const warn = d.apr >= 10 && d.apr < 20;
                const accent = danger ? 'var(--danger-color)' : warn ? 'var(--warning-color)' : 'var(--success-color)';
                const bg = danger ? 'var(--danger-pale)' : warn ? 'var(--warning-pale)' : 'var(--success-pale)';
                const monthlyCost = Math.round(d.balance * d.apr / 100 / 12);
                return (
                  <div key={d.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--divider)' }}>
                    {/* APR badge */}
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center"
                      style={{ background: bg }}>
                      <p className="text-xs font-bold stat-number leading-none" style={{ color: accent }}>{d.apr}%</p>
                      <p className="text-[9px] font-medium" style={{ color: accent }}>APR</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{d.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {formatCurrency(monthlyCost)}/mo in interest
                      </p>
                    </div>

                    <p className="stat-number text-sm font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(d.balance, true)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Upcoming bills ── */}
        {upcomingBills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="sv-section-label" style={{ marginBottom: 0 }}>Coming up</p>
              <Link href="/calendar" className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                Calendar →
              </Link>
            </div>

            <div className="space-y-2">
              {upcomingBills.map(b => {
                const urgent = b.daysUntil <= 3;
                return (
                  <div key={b.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{
                      background: urgent ? 'var(--danger-pale)' : 'var(--surface-2)',
                      border: `1px solid ${urgent ? 'rgba(220,38,38,0.15)' : 'var(--divider)'}`,
                    }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: urgent ? 'rgba(220,38,38,0.12)' : 'var(--surface-3)' }}>
                      {urgent ? '⚠️' : '📅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs" style={{ color: urgent ? 'var(--danger-color)' : 'var(--text-faint)' }}>
                        Due in {b.daysUntil} day{b.daysUntil !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="stat-number text-sm font-bold">{formatCurrency(b.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Ask Finn CTA ── */}
        <Link href="/chat"
          className="flex items-center gap-3 px-4 py-4 rounded-2xl transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 100%)',
            textDecoration: 'none',
          }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            F
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Ask Finn</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {topDebt
                ? `Your ${topDebt.name} costs ${formatCurrency(Math.round(topDebt.balance * topDebt.apr / 100 / 12))}/mo`
                : 'What do you want to focus on today?'}
            </p>
          </div>
          <MessageCircle size={18} color="rgba(255,255,255,0.7)" />
        </Link>

      </div>
    </div>
  );
}
