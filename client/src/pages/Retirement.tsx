import { useState } from "react";
import Layout from "@/components/Layout";
import { loadData, saveData, formatCurrency } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Shield, Info, Target, DollarSign, PiggyBank } from "lucide-react";

const CONTRIBUTION_LIMIT_2024 = 23000; // 401k
const CATCHUP_LIMIT_AGE_50 = 7500;
const IRA_LIMIT = 7000;
const ROTH_INCOME_LIMIT_SINGLE = 146000;
const ROTH_INCOME_LIMIT_MFJ = 230000;

function futureValue(monthlyContrib: number, currentBalance: number, years: number, annualRate: number): number {
  if (years <= 0) return currentBalance;
  const r = annualRate / 12;
  const n = years * 12;
  const fvContribs = monthlyContrib * ((Math.pow(1 + r, n) - 1) / r);
  const fvCurrent = currentBalance * Math.pow(1 + r, n);
  return fvContribs + fvCurrent;
}

function calcReplacement(retirementBalance: number, withdrawalRate: number = 0.04): number {
  return retirementBalance * withdrawalRate / 12;
}

export default function RetirementPage() {
  const [data, setData] = useState(loadData());
  const [tab, setTab] = useState("calculator");
  const { toast } = useToast();

  const profile = data.profile;
  const income = profile?.monthlyIncome || 0;
  const annualIncome = income * 12;

  // Retirement state
  const retirement = data.retirement || {};
  const [currentAge, setCurrentAge] = useState(String(retirement.currentAge || ""));
  const [retireAge, setRetireAge] = useState(String(retirement.retireAge || "65"));
  const [currentBalance, setCurrentBalance] = useState(String(retirement.currentBalance || "0"));
  const [monthlyContrib, setMonthlyContrib] = useState(String(retirement.monthlyContribution || ""));
  const [employerMatch, setEmployerMatch] = useState(String(retirement.employerMatchPct || "3"));
  const [returnRate, setReturnRate] = useState("7");
  const [savedAge, setSavedAge] = useState(false);

  const age = parseInt(currentAge) || 30;
  const retAge = parseInt(retireAge) || 65;
  const balance = parseFloat(currentBalance) || 0;
  const contrib = parseFloat(monthlyContrib) || 0;
  const matchPct = parseFloat(employerMatch) || 0;
  const rate = parseFloat(returnRate) / 100;
  const years = Math.max(0, retAge - age);
  const matchAmount = annualIncome * (matchPct / 100);
  const totalMonthlyContrib = contrib + matchAmount / 12;

  const projectedBalance = futureValue(totalMonthlyContrib, balance, years, rate);
  const monthlyInRetirement = calcReplacement(projectedBalance);
  const incomeReplacement = income > 0 ? (monthlyInRetirement / income) * 100 : 0;

  const contribAnnual = contrib * 12;
  const limit = age >= 50 ? CONTRIBUTION_LIMIT_2024 + CATCHUP_LIMIT_AGE_50 : CONTRIBUTION_LIMIT_2024;
  const contribPct = limit > 0 ? Math.min(100, (contribAnnual / limit) * 100) : 0;
  const incomeContribRate = annualIncome > 0 ? ((contribAnnual / annualIncome) * 100).toFixed(1) : "0";
  const isOnTrack = incomeReplacement >= 70;

  function saveRetirement() {
    if (!currentAge || parseInt(currentAge) < 18 || parseInt(currentAge) > 80) {
      toast({ title: "Enter a valid age (18–80)", variant: "destructive" });
      return;
    }
    const updated = {
      ...data,
      retirement: {
        currentAge: parseInt(currentAge),
        retireAge: parseInt(retireAge),
        currentBalance: parseFloat(currentBalance) || 0,
        monthlyContribution: parseFloat(monthlyContrib) || 0,
        employerMatchPct: parseFloat(employerMatch) || 0,
      }
    };
    saveData(updated);
    setData(updated);
    setSavedAge(true);
    toast({ title: "Retirement profile saved" });
  }

  // Advice rules
  function getAdvice(): { title: string; body: string; type: "good" | "warn" | "action" }[] {
    const advice = [];

    if (contribAnnual < limit * 0.5) {
      advice.push({
        title: "Increase 401k contributions",
        body: `You're at ${incomeContribRate}% of income. Financial experts recommend 15%+ total. Aim to max out your employer match first (free money).`,
        type: "action" as const,
      });
    }
    if (matchPct > 0 && contribAnnual < matchAmount) {
      advice.push({
        title: "Leave no employer match on the table",
        body: `Your employer matches up to ${matchPct}% of salary (${formatCurrency(matchAmount / 12)}/mo). Contribute at least this amount.`,
        type: "warn" as const,
      });
    }
    if (incomeReplacement >= 80) {
      advice.push({
        title: "You're on track 🎉",
        body: `Your projected balance of ${formatCurrency(projectedBalance)} would replace ${incomeReplacement.toFixed(0)}% of your monthly income in retirement.`,
        type: "good" as const,
      });
    }
    if (age >= 50 && contribAnnual < CONTRIBUTION_LIMIT_2024 + CATCHUP_LIMIT_AGE_50) {
      advice.push({
        title: "Use your catch-up contribution",
        body: `At 50+, you can contribute an extra $7,500/year to your 401k. Max out: ${formatCurrency(CONTRIBUTION_LIMIT_2024 + CATCHUP_LIMIT_AGE_50)}/yr.`,
        type: "action" as const,
      });
    }
    if (annualIncome < ROTH_INCOME_LIMIT_SINGLE && years > 10) {
      advice.push({
        title: "Consider a Roth IRA",
        body: `Your income (${formatCurrency(annualIncome)}/yr) qualifies for a Roth IRA. Contribute up to ${formatCurrency(IRA_LIMIT)}/yr for tax-free growth.`,
        type: "action" as const,
      });
    }
    if (balance < income * 3 && age > 35) {
      advice.push({
        title: "Accelerate savings now",
        body: "Industry benchmark: have 1× salary saved by 30, 3× by 40, 6× by 50. Small increases now compound significantly by retirement.",
        type: "warn" as const,
      });
    }
    return advice.length > 0 ? advice : [{ title: "Set up your profile", body: "Enter your age and contribution details to get personalized 401k advice.", type: "action" as const }];
  }

  const adviceItems = getAdvice();

  const scenarioRates = [5, 7, 10];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white" data-testid="text-retirement-title">401k Advisor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Project your retirement and optimize your contributions</p>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-[#141a20] border border-[#1a2028]">
            <TabsTrigger value="calculator" className="flex-1 text-xs" data-testid="tab-calculator">Calculator</TabsTrigger>
            <TabsTrigger value="advice" className="flex-1 text-xs" data-testid="tab-advice">Advice</TabsTrigger>
            <TabsTrigger value="scenarios" className="flex-1 text-xs" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          </TabsList>

          {/* Calculator Tab */}
          <TabsContent value="calculator" className="mt-4 space-y-4">
            {/* Profile inputs */}
            <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Your Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Current Age</Label>
                  <Input data-testid="input-current-age" type="number" value={currentAge} onChange={e => setCurrentAge(e.target.value)} placeholder="32" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Retire At</Label>
                  <Input data-testid="input-retire-age" type="number" value={retireAge} onChange={e => setRetireAge(e.target.value)} placeholder="65" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Current 401k Balance ($)</Label>
                  <Input data-testid="input-current-balance" type="number" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} placeholder="25000" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monthly Contribution ($)</Label>
                  <Input data-testid="input-monthly-contrib" type="number" value={monthlyContrib} onChange={e => setMonthlyContrib(e.target.value)} placeholder="500" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Employer Match (%)</Label>
                  <Input data-testid="input-employer-match" type="number" value={employerMatch} onChange={e => setEmployerMatch(e.target.value)} placeholder="3" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expected Return (%/yr)</Label>
                  <Input data-testid="input-return-rate" type="number" value={returnRate} onChange={e => setReturnRate(e.target.value)} placeholder="7" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                </div>
              </div>
              <Button onClick={saveRetirement} className="w-full" data-testid="button-save-retirement">Calculate Projection</Button>
            </div>

            {/* Projection results */}
            {(savedAge || retirement.currentAge) && (
              <>
                <div className={`bg-[#141a20] rounded-xl border p-4 space-y-3 ${isOnTrack ? "border-[#22c55e]/30" : "border-[#f59e0b]/30"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className={`w-4 h-4 ${isOnTrack ? "text-[#22c55e]" : "text-[#f59e0b]"}`} />
                    <h2 className="text-sm font-semibold text-white">Projection at {retAge}</h2>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${isOnTrack ? "text-[#22c55e] border-[#22c55e]/30" : "text-[#f59e0b] border-[#f59e0b]/30"}`}>
                      {isOnTrack ? "On Track" : "Needs Attention"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0f1419] rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Projected Balance</p>
                      <p className="text-lg font-bold font-mono text-white mt-0.5" data-testid="text-projected-balance">{formatCurrency(projectedBalance)}</p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Monthly Income</p>
                      <p className="text-lg font-bold font-mono text-[#22c55e] mt-0.5" data-testid="text-monthly-retirement">{formatCurrency(monthlyInRetirement)}</p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Income Replacement</p>
                      <p className={`text-lg font-bold font-mono mt-0.5 ${incomeReplacement >= 70 ? "text-[#22c55e]" : "text-[#f59e0b]"}`} data-testid="text-income-replacement">
                        {incomeReplacement.toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Years to Retire</p>
                      <p className="text-lg font-bold font-mono text-[#01696F] mt-0.5">{years}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Income replacement goal (70%)</span>
                      <span>{Math.min(incomeReplacement, 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={Math.min(incomeReplacement, 100)} className="h-2" />
                  </div>
                </div>

                {/* Contribution limits */}
                <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#01696F]" /> 401k Contribution Limit
                  </h2>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{formatCurrency(contribAnnual)}/yr contributed</span>
                    <span>Limit: {formatCurrency(limit)}/yr</span>
                  </div>
                  <Progress value={contribPct} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {contribAnnual >= limit
                      ? "You're maximizing your 401k 🎉"
                      : `${formatCurrency(limit - contribAnnual)}/yr remaining until limit`}
                    {age >= 50 ? " · Catch-up included" : ""}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          {/* Advice Tab */}
          <TabsContent value="advice" className="mt-4 space-y-3">
            {adviceItems.map((item, i) => (
              <div key={i} className={`bg-[#141a20] rounded-xl border p-4 ${
                item.type === "good" ? "border-[#22c55e]/30" :
                item.type === "warn" ? "border-[#f59e0b]/30" : "border-[#01696F]/30"
              }`} data-testid={`advice-item-${i}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    item.type === "good" ? "bg-[#22c55e]/10" :
                    item.type === "warn" ? "bg-[#f59e0b]/10" : "bg-[#01696F]/10"
                  }`}>
                    {item.type === "good" ? <Target className={`w-4 h-4 text-[#22c55e]`} /> :
                     item.type === "warn" ? <Info className={`w-4 h-4 text-[#f59e0b]`} /> :
                     <PiggyBank className={`w-4 h-4 text-[#01696F]`} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Key Rules */}
            <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">2024 Key Limits</h2>
              <div className="space-y-2 text-xs">
                {[
                  { label: "401k Contribution Limit", value: formatCurrency(CONTRIBUTION_LIMIT_2024) + "/yr" },
                  { label: "Catch-Up (Age 50+)", value: "+" + formatCurrency(CATCHUP_LIMIT_AGE_50) + "/yr" },
                  { label: "IRA / Roth IRA Limit", value: formatCurrency(IRA_LIMIT) + "/yr" },
                  { label: "Roth Income Limit (Single)", value: formatCurrency(ROTH_INCOME_LIMIT_SINGLE) + "/yr" },
                  { label: "Roth Income Limit (MFJ)", value: formatCurrency(ROTH_INCOME_LIMIT_MFJ) + "/yr" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-bold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="mt-4 space-y-3">
            <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
              <h2 className="text-sm font-semibold text-white mb-1">Return Rate Comparison</h2>
              <p className="text-xs text-muted-foreground mb-4">Same contributions, different assumed annual returns</p>
              <div className="space-y-3">
                {scenarioRates.map(r => {
                  const fv = futureValue(totalMonthlyContrib, balance, years, r / 100);
                  const monthly = calcReplacement(fv);
                  const pct = income > 0 ? (monthly / income) * 100 : 0;
                  return (
                    <div key={r} className="bg-[#0f1419] rounded-lg p-3" data-testid={`scenario-${r}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs text-[#01696F] border-[#01696F]/30">{r}% return</Badge>
                        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% income replacement</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Balance at {retAge}</p>
                          <p className="font-mono font-bold text-white">{formatCurrency(fv)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Monthly income</p>
                          <p className={`font-mono font-bold ${pct >= 70 ? "text-[#22c55e]" : "text-[#f59e0b]"}`}>{formatCurrency(monthly)}/mo</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contribution boost scenarios */}
            <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
              <h2 className="text-sm font-semibold text-white mb-1">Contribution Boost Impact</h2>
              <p className="text-xs text-muted-foreground mb-4">What adding $100–$300/mo more does by retirement</p>
              <div className="space-y-3">
                {[100, 200, 300].map(boost => {
                  const fv = futureValue(totalMonthlyContrib + boost, balance, years, rate);
                  const diff = fv - projectedBalance;
                  return (
                    <div key={boost} className="flex items-center justify-between bg-[#0f1419] rounded-lg p-3" data-testid={`boost-${boost}`}>
                      <div>
                        <p className="text-sm font-medium text-white">+{formatCurrency(boost)}/mo</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(boost * 12)}/yr more</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Extra at retirement</p>
                        <p className="font-mono font-bold text-[#22c55e] text-sm">+{formatCurrency(diff)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
