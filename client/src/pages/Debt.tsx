import { useState } from "react";
import Layout from "@/components/Layout";
import { loadData, saveData, computeDebtFreeMonths, formatCurrency, formatMonths, type Debt } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, TrendingDown, Zap, Snowflake, BarChart3, Target, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Strategy = "avalanche" | "snowball" | "hybrid";

interface PayoffEntry {
  month: number;
  name: string;
  balance: number;
}

function runPayoffSimulation(debts: Debt[], extra: number, strategy: Strategy): { months: number; schedule: PayoffEntry[]; totalInterest: number } {
  if (!debts.length) return { months: 0, schedule: [], totalInterest: 0 };

  let remaining = debts.map(d => ({ ...d }));
  let month = 0;
  const schedule: PayoffEntry[] = [];
  let totalInterest = 0;
  const MAX_MONTHS = 600;

  while (remaining.some(d => d.balance > 0) && month < MAX_MONTHS) {
    month++;
    remaining = remaining.map(d => {
      if (d.balance <= 0) return d;
      const interest = d.balance * ((d.apr / 100) / 12);
      totalInterest += interest;
      return { ...d, balance: d.balance + interest };
    });

    const active = remaining.filter(d => d.balance > 0);
    if (strategy === "avalanche") {
      active.sort((a, b) => b.apr - a.apr);
    } else if (strategy === "snowball") {
      active.sort((a, b) => a.balance - b.balance);
    } else {
      const median = active.map(d => d.balance).sort((a, b) => a - b)[Math.floor(active.length / 2)] || 0;
      active.sort((a, b) => {
        const aScore = a.balance < median ? a.apr * 1000 : a.balance;
        const bScore = b.balance < median ? b.apr * 1000 : b.balance;
        return bScore - aScore;
      });
    }

    let pool = extra;
    for (const debt of remaining) {
      if (debt.balance <= 0) continue;
      const min = Math.min(debt.minPayment, debt.balance);
      debt.balance = Math.max(0, debt.balance - min);
    }

    for (const priority of active) {
      if (pool <= 0) break;
      const debt = remaining.find(d => d.id === priority.id);
      if (!debt || debt.balance <= 0) continue;
      const payment = Math.min(pool, debt.balance);
      debt.balance -= payment;
      pool -= payment;
    }

    for (const d of remaining) {
      if (d.balance === 0) {
        const existing = schedule.find(s => s.name === d.name);
        if (!existing) schedule.push({ month, name: d.name, balance: 0 });
      }
    }
  }

  return { months: month, schedule, totalInterest };
}

export default function DebtPage() {
  const [data, setData] = useState(loadData());
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDebt, setNewDebt] = useState({ name: "", balance: "", apr: "", minPayment: "", type: "credit_card" });
  const { toast } = useToast();

  const debts = data.debts || [];
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const sim = runPayoffSimulation(debts, extra, strategy);
  const simNoExtra = runPayoffSimulation(debts, 0, strategy);

  const monthsSaved = simNoExtra.months - sim.months;
  const interestSaved = simNoExtra.totalInterest - sim.totalInterest;

  function addDebt() {
    const b = parseFloat(newDebt.balance);
    const a = parseFloat(newDebt.apr);
    const m = parseFloat(newDebt.minPayment);
    if (!newDebt.name || isNaN(b) || isNaN(a) || isNaN(m)) {
      toast({ title: "Missing fields", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    const debt: Debt = {
      id: Date.now().toString(),
      name: newDebt.name,
      balance: b,
      apr: a,
      minPayment: m,
      type: newDebt.type as Debt["type"],
    };
    const updated = { ...data, debts: [...debts, debt] };
    saveData(updated);
    setData(updated);
    setNewDebt({ name: "", balance: "", apr: "", minPayment: "", type: "credit_card" });
    setShowAdd(false);
    toast({ title: "Debt added", description: `${debt.name} added to your tracker.` });
  }

  function removeDebt(id: string) {
    const updated = { ...data, debts: debts.filter(d => d.id !== id) };
    saveData(updated);
    setData(updated);
    toast({ title: "Debt removed" });
  }

  const strategies = [
    { id: "avalanche" as Strategy, icon: Zap, label: "Avalanche", emoji: "⚡", desc: "Pay highest APR first. Saves the most money in interest." },
    { id: "snowball" as Strategy, icon: Snowflake, label: "Snowball", emoji: "❄️", desc: "Pay smallest balance first. Builds momentum and motivation." },
    { id: "hybrid" as Strategy, icon: BarChart3, label: "Hybrid", emoji: "📊", desc: "Pay high-APR small debts first, then attack largest balances." },
  ];

  const activeStrategy = strategies.find(s => s.id === strategy)!;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="text-debt-title">Debt Eliminator</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Attack your debt with a proven strategy</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-add-debt">
                <Plus className="w-4 h-4" /> Add Debt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Debt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Debt Name</Label>
                  <Input data-testid="input-debt-name" value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} placeholder="Chase Sapphire" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Type</Label>
                  <Select value={newDebt.type} onValueChange={v => setNewDebt(p => ({ ...p, type: v }))}>
                    <SelectTrigger data-testid="select-debt-type" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="student_loan">Student Loan</SelectItem>
                      <SelectItem value="auto">Auto Loan</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="personal">Personal Loan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Balance ($)</Label>
                    <Input data-testid="input-debt-balance" type="number" value={newDebt.balance} onChange={e => setNewDebt(p => ({ ...p, balance: e.target.value }))} placeholder="5000" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>APR (%)</Label>
                    <Input data-testid="input-debt-apr" type="number" value={newDebt.apr} onChange={e => setNewDebt(p => ({ ...p, apr: e.target.value }))} placeholder="24.9" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Min Pay ($)</Label>
                    <Input data-testid="input-debt-minpay" type="number" value={newDebt.minPayment} onChange={e => setNewDebt(p => ({ ...p, minPayment: e.target.value }))} placeholder="150" className="mt-1.5" />
                  </div>
                </div>
                <Button onClick={addDebt} className="w-full mt-2" data-testid="button-confirm-add-debt">Add Debt</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-0" style={{ borderBottom: '1px solid var(--divider)', paddingBottom: '1.5rem' }}>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Total Debt</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--danger-color)' }} data-testid="text-total-debt">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid var(--divider)', borderRight: '1px solid var(--divider)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Debt Free In</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }} data-testid="text-debt-free">{sim.months > 0 ? formatMonths(sim.months) : "--"}</p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Interest Cost</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--warning-color)' }} data-testid="text-interest-cost">{sim.totalInterest > 0 ? formatCurrency(sim.totalInterest) : "--"}</p>
          </div>
        </div>

        {/* Strategy Selector */}
        <div>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payoff Strategy</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {strategies.map(s => (
              <button
                key={s.id}
                data-testid={`button-strategy-${s.id}`}
                onClick={() => setStrategy(s.id)}
                className="rounded-xl px-3 py-3 text-xs font-medium capitalize transition-all border"
                style={{
                  background: strategy === s.id ? 'var(--teal-pale)' : 'var(--surface-2)',
                  color: strategy === s.id ? 'var(--teal)' : 'var(--text-secondary)',
                  borderColor: strategy === s.id ? 'var(--teal-dim)' : 'var(--divider)',
                  fontWeight: strategy === s.id ? 600 : 400,
                }}
              >
                <div className="text-lg mb-1">{s.emoji}</div>
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs px-1 mb-5" style={{ color: 'var(--text-secondary)' }}>{activeStrategy.desc}</p>

          {/* Extra Payment Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Extra Monthly Payment</Label>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--teal)' }} data-testid="text-extra-payment">{formatCurrency(extra)}</span>
            </div>
            <input
              data-testid="slider-extra-payment"
              type="range"
              min={0}
              max={1000}
              step={25}
              value={extra}
              onChange={e => setExtra(Number(e.target.value))}
              className="w-full accent-[#01696F] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
              <span>$0</span><span>$500</span><span>$1,000</span>
            </div>
          </div>

          {/* Impact Banner */}
          {extra > 0 && monthsSaved > 0 && (
            <div className="mt-4 rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--teal-pale)', border: '1px solid var(--teal-dim)' }}>
              <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} />
              <div className="text-xs">
                <p className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Adding {formatCurrency(extra)}/mo saves you:</p>
                <p style={{ color: 'var(--teal)' }}>{formatMonths(monthsSaved)} sooner · {formatCurrency(interestSaved)} less interest</p>
              </div>
            </div>
          )}
        </div>

        {/* Payoff Timeline */}
        {sim.schedule.length > 0 && (
          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '1.5rem' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Target className="w-4 h-4" style={{ color: 'var(--teal)' }} /> Payoff Timeline
            </h2>
            <div className="space-y-3">
              {sim.schedule.map((entry, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                  <span
                    className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--success-pale)', color: 'var(--success-color)' }}
                  >
                    Month {entry.month}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debt List */}
        <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '1.5rem' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)' }}>Your Debts ({debts.length})</h2>
          {debts.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--danger-pale)' }}>
                <TrendingDown className="w-7 h-7" style={{ color: 'var(--danger-color)', opacity: 0.5 }} />
              </div>
              <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>No debts tracked</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Add one above to start your elimination plan.</p>
            </div>
          )}
          <div className="space-y-0">
            {debts.map(debt => {
              const pct = Math.min(100, ((debt.minPayment * 12) / debt.balance) * 100);
              const isExpanded = expandedId === debt.id;
              const aprColor = debt.apr >= 20 ? 'var(--danger-color)' : debt.apr >= 10 ? 'var(--warning-color)' : 'var(--success-color)';
              const aprBg = debt.apr >= 20 ? 'var(--danger-pale)' : debt.apr >= 10 ? 'var(--warning-pale)' : 'var(--success-pale)';
              return (
                <div key={debt.id} style={{ borderBottom: '1px solid var(--divider)' }} data-testid={`card-debt-${debt.id}`}>
                  <button
                    className="w-full py-4 flex items-center gap-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : debt.id)}
                    data-testid={`button-expand-debt-${debt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{debt.name}</span>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0"
                          style={{ background: aprBg, color: aprColor }}
                        >
                          {debt.apr}% APR
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--danger-color)' }}>{formatCurrency(debt.balance)}</span>
                        <span className="text-xs capitalize" style={{ color: 'var(--text-faint)' }}>{debt.type.replace("_", " ")}</span>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--text-faint)' }} />
                      : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-faint)' }} />
                    }
                  </button>
                  {isExpanded && (
                    <div className="pb-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p style={{ color: 'var(--text-faint)' }}>Min Payment</p>
                          <p className="font-mono font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{formatCurrency(debt.minPayment)}/mo</p>
                        </div>
                        <div>
                          <p style={{ color: 'var(--text-faint)' }}>Monthly Interest</p>
                          <p className="font-mono font-bold mt-0.5" style={{ color: 'var(--warning-color)' }}>{formatCurrency((debt.balance * debt.apr / 100) / 12)}</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-faint)' }}>
                          <span>Annual paydown progress</span><span>{pct.toFixed(0)}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => removeDebt(debt.id)}
                        data-testid={`button-remove-debt-${debt.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Debt
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
