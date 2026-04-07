import { useState } from "react";
import Layout from "@/components/Layout";
import { loadData, saveData, computeGoalMonths, formatCurrency, formatMonths, type Goal } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Target, Trophy, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GOAL_ICONS: Record<string, string> = {
  emergency: "🛡️", vacation: "✈️", home: "🏠", car: "🚗",
  wedding: "💍", education: "🎓", retirement: "🌅", other: "🎯",
};

function ProgressRing({ pct, size = 72, color = "#01696F" }: { pct: number; size?: number; color?: string }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} className="shrink-0" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="font-mono" fill="#1A202C" fontSize={size > 60 ? 12 : 10} fontWeight="700">
        {Math.min(Math.round(pct), 100)}%
      </text>
    </svg>
  );
}

export default function GoalsPage() {
  const [data, setData] = useState(loadData());
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "", targetAmount: "", currentAmount: "", monthlyContribution: "", icon: "other", priority: "medium" as Goal["priority"],
  });
  const { toast } = useToast();

  const goals = data.goals || [];
  const completed = goals.filter(g => g.currentAmount >= g.targetAmount);
  const active = goals.filter(g => g.currentAmount < g.targetAmount);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  function addGoal() {
    const ta = parseFloat(newGoal.targetAmount);
    const ca = parseFloat(newGoal.currentAmount || "0");
    const mc = parseFloat(newGoal.monthlyContribution || "0");
    if (!newGoal.name || isNaN(ta) || ta <= 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const goal: Goal = {
      id: Date.now().toString(),
      name: newGoal.name,
      targetAmount: ta,
      currentAmount: ca,
      monthlyContribution: mc,
      icon: newGoal.icon,
      priority: newGoal.priority,
    };
    const updated = { ...data, goals: [...goals, goal] };
    saveData(updated);
    setData(updated);
    setNewGoal({ name: "", targetAmount: "", currentAmount: "", monthlyContribution: "", icon: "other", priority: "medium" });
    setShowAdd(false);
    toast({ title: "Goal added", description: `${goal.name} added to your goals.` });
  }

  function addContribution(id: string, amount: number) {
    const updated = {
      ...data,
      goals: goals.map(g => g.id === id ? { ...g, currentAmount: Math.min(g.currentAmount + amount, g.targetAmount) } : g)
    };
    saveData(updated);
    setData(updated);
    toast({ title: "Contribution recorded" });
  }

  function removeGoal(id: string) {
    const updated = { ...data, goals: goals.filter(g => g.id !== id) };
    saveData(updated);
    setData(updated);
  }

  const priorityColor = { high: "#DC2626", medium: "#D97706", low: "#01696F" };

  function GoalCard({ goal }: { goal: Goal }) {
    const [contributing, setContributing] = useState(false);
    const [amount, setAmount] = useState("");
    const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const months = computeGoalMonths(goal);
    const remaining = goal.targetAmount - goal.currentAmount;
    const done = pct >= 100;

    return (
      <div
        className="py-5"
        style={{ borderBottom: '1px solid var(--divider)' }}
        data-testid={`card-goal-${goal.id}`}
      >
        <div className="flex items-start gap-4">
          <ProgressRing pct={pct} color={done ? "#16A34A" : priorityColor[goal.priority] || "#01696F"} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg leading-none">{GOAL_ICONS[goal.icon] || "🎯"}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{goal.name}</span>
                  {done && <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--success-color)' }} />}
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                  style={{
                    background: goal.priority === 'high' ? '#FEE2E2' : goal.priority === 'medium' ? '#FEF3C7' : 'var(--teal-pale)',
                    color: priorityColor[goal.priority],
                  }}
                >
                  {goal.priority} priority
                </span>
              </div>
              <button onClick={() => removeGoal(goal.id)} data-testid={`button-remove-goal-${goal.id}`} className="mt-1">
                <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600 transition-colors" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Saved</p>
                <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--success-color)' }}>{formatCurrency(goal.currentAmount)}</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Target</p>
                <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{formatCurrency(goal.targetAmount)}</p>
              </div>
              {!done && (
                <>
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Still needed</p>
                    <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--warning-color)' }}>{formatCurrency(remaining)}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>ETA</p>
                    <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--teal)' }}>{months > 0 ? formatMonths(months) : "--"}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {!done && (
          <div className="mt-4 pl-[88px]">
            {contributing ? (
              <div className="flex items-center gap-2">
                <Input
                  data-testid={`input-contribution-${goal.id}`}
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <Button size="sm" className="h-8 px-3" onClick={() => {
                  const v = parseFloat(amount);
                  if (!isNaN(v) && v > 0) { addContribution(goal.id, v); setContributing(false); setAmount(""); }
                }} data-testid={`button-confirm-contribution-${goal.id}`}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setContributing(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setContributing(true)} data-testid={`button-add-contribution-${goal.id}`}>
                  <Plus className="w-3 h-3 mr-1" /> Add Contribution
                </Button>
                {goal.monthlyContribution > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{formatCurrency(goal.monthlyContribution)}/mo</span>
                )}
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="mt-3 pl-[88px]">
            <span className="text-xs font-medium" style={{ color: 'var(--success-color)' }}>Goal achieved! 🎉</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="text-goals-title">Goals</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track your savings milestones</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-add-goal">
                <Plus className="w-4 h-4" /> Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Goal Name</Label>
                    <Input data-testid="input-goal-name" value={newGoal.name} onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))} placeholder="Emergency Fund" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Type</Label>
                    <Select value={newGoal.icon} onValueChange={v => setNewGoal(p => ({ ...p, icon: v }))}>
                      <SelectTrigger data-testid="select-goal-type" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(GOAL_ICONS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Priority</Label>
                  <Select value={newGoal.priority} onValueChange={v => setNewGoal(p => ({ ...p, priority: v as Goal["priority"] }))}>
                    <SelectTrigger data-testid="select-goal-priority" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 High</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Target ($)</Label>
                    <Input data-testid="input-goal-target" type="number" value={newGoal.targetAmount} onChange={e => setNewGoal(p => ({ ...p, targetAmount: e.target.value }))} placeholder="10000" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Saved ($)</Label>
                    <Input data-testid="input-goal-current" type="number" value={newGoal.currentAmount} onChange={e => setNewGoal(p => ({ ...p, currentAmount: e.target.value }))} placeholder="0" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Monthly ($)</Label>
                    <Input data-testid="input-goal-monthly" type="number" value={newGoal.monthlyContribution} onChange={e => setNewGoal(p => ({ ...p, monthlyContribution: e.target.value }))} placeholder="200" className="mt-1.5" />
                  </div>
                </div>
                <Button onClick={addGoal} className="w-full" data-testid="button-confirm-add-goal">Create Goal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-0" style={{ borderBottom: '1px solid var(--divider)', paddingBottom: '1.5rem' }}>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Total Saved</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--success-color)' }} data-testid="text-total-saved">{formatCurrency(totalSaved)}</p>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid var(--divider)', borderRight: '1px solid var(--divider)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Total Target</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalTarget)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Completed</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--teal)' }} data-testid="text-goals-completed">{completed.length} / {goals.length}</p>
          </div>
        </div>

        {/* Active Goals */}
        {active.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 mb-1" style={{ color: 'var(--text-faint)' }}>
              <TrendingUp className="w-3.5 h-3.5" /> Active ({active.length})
            </h2>
            {active.map(g => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}

        {/* Completed Goals */}
        {completed.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 mb-1" style={{ color: 'var(--text-faint)' }}>
              <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--success-color)' }} /> Achieved ({completed.length})
            </h2>
            {completed.map(g => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}

        {/* Empty state */}
        {goals.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--teal-pale)' }}>
              <Target className="w-7 h-7" style={{ color: 'var(--teal)' }} />
            </div>
            <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>No goals yet</p>
            <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>Start with an emergency fund -- 3–6 months of expenses.</p>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> Set First Goal
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
