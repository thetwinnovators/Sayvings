import { useState } from "react";
import Layout from "@/components/Layout";
import { loadData, saveData, computeBudgetTotals, formatCurrency, type BudgetCategory } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Trash2, TrendingUp, DollarSign, PieChart, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_ICONS: Record<string, string> = {
  housing: "🏠", food: "🍔", transport: "🚗", utilities: "⚡",
  entertainment: "🎬", health: "💊", savings: "💰", clothing: "👕",
  personal: "✂️", education: "📚", subscriptions: "📱", other: "📦",
};

const BUDGET_RULES = [
  { label: "Needs", pct: 50, color: "#01696F", desc: "Housing, food, transport" },
  { label: "Wants", pct: 30, color: "#D97706", desc: "Entertainment, clothing, dining" },
  { label: "Savings", pct: 20, color: "#16A34A", desc: "Emergency fund, goals, debt payoff" },
];

export default function BudgetPage() {
  const [data, setData] = useState(loadData());
  const [showAdd, setShowAdd] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState(String(data.profile?.monthlyIncome || ""));
  const [activeTab, setActiveTab] = useState("overview");
  const [scenarioExtra, setScenarioExtra] = useState(0);
  const [newCat, setNewCat] = useState({ name: "", budgeted: "", spent: "", type: "need" as BudgetCategory["type"], icon: "other" });
  const { toast } = useToast();

  const categories = data.budget?.categories || [];
  const income = data.profile?.monthlyIncome || 0;
  const totals = computeBudgetTotals(categories);

  const needs = categories.filter(c => c.type === "need");
  const wants = categories.filter(c => c.type === "want");
  const savings = categories.filter(c => c.type === "savings");

  const needsSpent = needs.reduce((s, c) => s + c.spent, 0);
  const wantsSpent = wants.reduce((s, c) => s + c.spent, 0);
  const savingsSpent = savings.reduce((s, c) => s + c.spent, 0);

  const remaining = income - totals.totalSpent;
  const savingsRate = income > 0 ? ((savingsSpent / income) * 100).toFixed(1) : "0";

  function saveIncome() {
    const v = parseFloat(incomeInput);
    if (isNaN(v) || v < 0) return;
    const updated = { ...data, profile: { ...(data.profile || {}), monthlyIncome: v } as any };
    saveData(updated);
    setData(updated);
    setEditingIncome(false);
    toast({ title: "Income updated" });
  }

  function addCategory() {
    const b = parseFloat(newCat.budgeted);
    const s = parseFloat(newCat.spent || "0");
    if (!newCat.name || isNaN(b)) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    const cat: BudgetCategory = {
      id: Date.now().toString(),
      name: newCat.name,
      budgeted: b,
      spent: s,
      type: newCat.type,
      icon: newCat.icon,
    };
    const updated = { ...data, budget: { ...(data.budget || { month: "", year: 0 }), categories: [...categories, cat] } };
    saveData(updated);
    setData(updated);
    setNewCat({ name: "", budgeted: "", spent: "", type: "need", icon: "other" });
    setShowAdd(false);
    toast({ title: "Category added" });
  }

  function updateSpent(id: string, val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    const updated = {
      ...data,
      budget: {
        ...(data.budget || { month: "", year: 0 }),
        categories: categories.map(c => c.id === id ? { ...c, spent: n } : c)
      }
    };
    saveData(updated);
    setData(updated);
  }

  function removeCategory(id: string) {
    const updated = { ...data, budget: { ...(data.budget || { month: "", year: 0 }), categories: categories.filter(c => c.id !== id) } };
    saveData(updated);
    setData(updated);
  }

  function CategorySection({ title, items, color }: { title: string; items: BudgetCategory[]; color: string }) {
    const spent = items.reduce((s, c) => s + c.spent, 0);
    const budgeted = items.reduce((s, c) => s + c.budgeted, 0);
    const pct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
    const over = spent > budgeted && budgeted > 0;
    return (
      <div style={{ borderBottom: '1px solid var(--divider)' }} className="pb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <div className="flex items-center gap-2">
            {over && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-xs font-mono" style={{ color: over ? 'var(--danger-color)' : 'var(--text-faint)' }}>
              {formatCurrency(spent)} / {formatCurrency(budgeted)}
            </span>
          </div>
        </div>
        <Progress value={pct} className="h-1.5 mb-4" style={{ "--progress-color": over ? "var(--danger-color)" : color } as any} />
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-xs py-2" style={{ color: 'var(--text-faint)' }}>No categories yet.</p>
          )}
          {items.map(cat => {
            const catPct = cat.budgeted > 0 ? Math.min(100, (cat.spent / cat.budgeted) * 100) : 0;
            const catOver = cat.spent > cat.budgeted && cat.budgeted > 0;
            return (
              <div key={cat.id} className="flex items-center gap-3 py-1" data-testid={`row-budget-${cat.id}`}>
                <span className="text-lg">{CATEGORY_ICONS[cat.icon] || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                    <span className="text-xs font-mono" style={{ color: catOver ? 'var(--danger-color)' : 'var(--text-faint)' }}>
                      {formatCurrency(cat.spent)} / {formatCurrency(cat.budgeted)}
                    </span>
                  </div>
                  <Progress value={catPct} className="h-1" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    data-testid={`input-spent-${cat.id}`}
                    type="number"
                    defaultValue={cat.spent}
                    onBlur={e => updateSpent(cat.id, e.target.value)}
                    className="w-20 h-7 text-xs text-right"
                    placeholder="Spent"
                  />
                  <button onClick={() => removeCategory(cat.id)} data-testid={`button-remove-cat-${cat.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600 transition-colors" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="text-budget-title">Budget</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track income, spending, and savings</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-add-category">
                <Plus className="w-4 h-4" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Budget Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Name</Label>
                    <Input data-testid="input-cat-name" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} placeholder="Groceries" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Icon</Label>
                    <Select value={newCat.icon} onValueChange={v => setNewCat(p => ({ ...p, icon: v }))}>
                      <SelectTrigger data-testid="select-cat-icon" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_ICONS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Type</Label>
                  <Select value={newCat.type} onValueChange={v => setNewCat(p => ({ ...p, type: v as any }))}>
                    <SelectTrigger data-testid="select-cat-type" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="need">Need (50%)</SelectItem>
                      <SelectItem value="want">Want (30%)</SelectItem>
                      <SelectItem value="savings">Savings (20%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Budget ($)</Label>
                    <Input data-testid="input-cat-budget" type="number" value={newCat.budgeted} onChange={e => setNewCat(p => ({ ...p, budgeted: e.target.value }))} placeholder="500" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Spent so far ($)</Label>
                    <Input data-testid="input-cat-spent" type="number" value={newCat.spent} onChange={e => setNewCat(p => ({ ...p, spent: e.target.value }))} placeholder="0" className="mt-1.5" />
                  </div>
                </div>
                <Button onClick={addCategory} className="w-full" data-testid="button-confirm-add-category">Add Category</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Income Row */}
        <div style={{ borderBottom: '1px solid var(--divider)' }} className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--teal-pale)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'var(--teal)' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Income</span>
            </div>
            {editingIncome ? (
              <div className="flex items-center gap-2">
                <Input data-testid="input-income" type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)} className="w-28 h-8 text-right font-mono" />
                <Button size="sm" onClick={saveIncome} data-testid="button-save-income">Save</Button>
              </div>
            ) : (
              <button onClick={() => setEditingIncome(true)} data-testid="button-edit-income" className="text-right">
                <span className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }} data-testid="text-income">{formatCurrency(income)}</span>
                <span className="text-xs block mt-0.5" style={{ color: 'var(--teal)' }}>tap to edit</span>
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Budgeted</p>
              <p className="font-mono font-bold text-base" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.totalBudgeted)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Spent</p>
              <p className="font-mono font-bold text-base" style={{ color: remaining < 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>{formatCurrency(totals.totalSpent)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Remaining</p>
              <p className="font-mono font-bold text-base" style={{ color: remaining >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} data-testid="text-remaining">{formatCurrency(remaining)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1 text-xs" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="scenario" className="flex-1 text-xs" data-testid="tab-scenario">What If</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* 50/30/20 Rule */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <PieChart className="w-4 h-4" style={{ color: 'var(--teal)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>50/30/20 Rule</h2>
              </div>
              <div className="space-y-5">
                {BUDGET_RULES.map(rule => {
                  const target = income * (rule.pct / 100);
                  const actual = rule.label === "Needs" ? needsSpent : rule.label === "Wants" ? wantsSpent : savingsSpent;
                  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
                  const over = actual > target && target > 0;
                  return (
                    <div key={rule.label}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <div>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{rule.label}</span>
                          <span className="ml-2" style={{ color: 'var(--text-faint)' }}>{rule.desc}</span>
                        </div>
                        <span className="font-mono" style={{ color: over ? 'var(--danger-color)' : 'var(--text-faint)' }}>
                          {formatCurrency(actual)} / {formatCurrency(target)}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Savings Rate */}
            <div className="flex items-center gap-4 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--success-pale)' }}>
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--success-color)' }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Current Savings Rate</p>
                <p className="text-3xl font-bold font-mono mt-0.5" style={{ color: 'var(--success-color)' }} data-testid="text-savings-rate">{savingsRate}%</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {Number(savingsRate) >= 20 ? "You're hitting the 20% goal 🎉" : `${(20 - Number(savingsRate)).toFixed(1)}% below the 20% target`}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-6 space-y-6">
            <CategorySection title="🏠 Needs" items={needs} color="#01696F" />
            <CategorySection title="🎬 Wants" items={wants} color="#D97706" />
            <CategorySection title="💰 Savings & Debt" items={savings} color="#16A34A" />
          </TabsContent>

          <TabsContent value="scenario" className="mt-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>What If Scenario Tester</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>See how cutting spending or increasing income changes your savings.</p>

              <div>
                <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cut monthly wants spending by</Label>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    data-testid="slider-scenario"
                    type="range"
                    min={0}
                    max={Math.max(500, wantsSpent)}
                    step={25}
                    value={scenarioExtra}
                    onChange={e => setScenarioExtra(Number(e.target.value))}
                    className="flex-1 accent-[#01696F]"
                  />
                  <span className="text-sm font-mono font-bold w-20 text-right" style={{ color: 'var(--teal)' }} data-testid="text-scenario-cut">{formatCurrency(scenarioExtra)}/mo</span>
                </div>
              </div>

              {scenarioExtra > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>New savings rate</p>
                    <p className="font-mono font-bold text-lg" style={{ color: 'var(--success-color)' }}>
                      {income > 0 ? (((savingsSpent + scenarioExtra) / income) * 100).toFixed(1) : "0"}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Extra saved yearly</p>
                    <p className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{formatCurrency(scenarioExtra * 12)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>5-year savings boost</p>
                    <p className="font-mono font-bold text-lg" style={{ color: 'var(--teal)' }}>{formatCurrency(scenarioExtra * 60)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Investment (7% return)</p>
                    <p className="font-mono font-bold text-lg" style={{ color: 'var(--warning-color)' }}>
                      {formatCurrency(scenarioExtra * 12 * ((Math.pow(1.07, 5) - 1) / 0.07))}
                    </p>
                  </div>
                  <p className="col-span-2 text-xs mt-2" style={{ color: 'var(--text-faint)' }}>*Investment estimate assumes 7% annual return, compounded monthly over 5 years.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
