import { useState } from "react";
import Layout from "@/components/Layout";
import { loadData, saveData, getDaysUntil, formatCurrency, type Bill } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CalendarDays, DollarSign, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BILL_ICONS: Record<string, string> = {
  housing: "🏠", utilities: "⚡", subscriptions: "📱", insurance: "🛡️",
  loan: "🏦", internet: "📡", phone: "📞", other: "📋",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = new Date();

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

export default function CalendarPage() {
  const [data, setData] = useState(loadData());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newBill, setNewBill] = useState({ name: "", amount: "", dueDay: "", category: "other", recurring: true });
  const { toast } = useToast();

  const bills = data.bills || [];
  const income = data.profile?.monthlyIncome || 0;
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const { firstDay, daysInMonth } = buildCalendarDays(viewYear, viewMonth);

  function addBill() {
    const amount = parseFloat(newBill.amount);
    const dueDay = parseInt(newBill.dueDay);
    if (!newBill.name || isNaN(amount) || isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    const bill: Bill = {
      id: Date.now().toString(),
      name: newBill.name,
      amount,
      dueDay,
      category: newBill.category as Bill["category"],
      recurring: newBill.recurring,
    };
    const updated = { ...data, bills: [...bills, bill] };
    saveData(updated);
    setData(updated);
    setNewBill({ name: "", amount: "", dueDay: "", category: "other", recurring: true });
    setShowAdd(false);
    toast({ title: "Bill added", description: `${bill.name} on the ${dueDay}th` });
  }

  function removeBill(id: string) {
    const updated = { ...data, bills: bills.filter(b => b.id !== id) };
    saveData(updated);
    setData(updated);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const billsOnDay = (day: number) => bills.filter(b => b.dueDay === day);
  const selectedBills = selectedDay !== null ? billsOnDay(selectedDay) : [];
  const isToday = (day: number) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  const upcomingBills = bills
    .map(b => ({ ...b, daysUntil: getDaysUntil(b.dueDay) }))
    .filter(b => b.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="text-calendar-title">Financial Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Bills, income, and due dates at a glance</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="button-add-bill">
                <Plus className="w-4 h-4" /> Add Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141a20] border-[#1a2028]">
              <DialogHeader>
                <DialogTitle className="text-white">Add a Bill</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Bill Name</Label>
                    <Input data-testid="input-bill-name" value={newBill.name} onChange={e => setNewBill(p => ({ ...p, name: e.target.value }))} placeholder="Netflix" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Category</Label>
                    <Select value={newBill.category} onValueChange={v => setNewBill(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-bill-category" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141a20] border-[#1a2028]">
                        {Object.entries(BILL_ICONS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Amount ($)</Label>
                    <Input data-testid="input-bill-amount" type="number" value={newBill.amount} onChange={e => setNewBill(p => ({ ...p, amount: e.target.value }))} placeholder="15.99" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Due Day of Month</Label>
                    <Input data-testid="input-bill-dueday" type="number" min={1} max={31} value={newBill.dueDay} onChange={e => setNewBill(p => ({ ...p, dueDay: e.target.value }))} placeholder="15" className="mt-1 bg-[#0f1419] border-[#1a2028] text-white" />
                  </div>
                </div>
                <Button onClick={addBill} className="w-full" data-testid="button-confirm-add-bill">Add Bill</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#141a20] rounded-xl p-3 border border-[#1a2028] text-center">
            <p className="text-xs text-muted-foreground">Monthly Bills</p>
            <p className="text-base font-bold font-mono text-[#ef4444] mt-1" data-testid="text-total-bills">{formatCurrency(totalBills)}</p>
          </div>
          <div className="bg-[#141a20] rounded-xl p-3 border border-[#1a2028] text-center">
            <p className="text-xs text-muted-foreground">After Bills</p>
            <p className={`text-base font-bold font-mono mt-1 ${income - totalBills >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`} data-testid="text-after-bills">
              {formatCurrency(Math.max(0, income - totalBills))}
            </p>
          </div>
          <div className="bg-[#141a20] rounded-xl p-3 border border-[#1a2028] text-center">
            <p className="text-xs text-muted-foreground">Bill Count</p>
            <p className="text-base font-bold font-mono text-white mt-1">{bills.length}</p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[#141a20] rounded-xl border border-[#1a2028] overflow-hidden">
          {/* Month Nav */}
          <div className="flex items-center justify-between p-4 border-b border-[#1a2028]">
            <button onClick={prevMonth} data-testid="button-prev-month" className="text-muted-foreground hover:text-white transition-colors p-1">‹</button>
            <h2 className="text-sm font-bold text-white">{MONTHS[viewMonth]} {viewYear}</h2>
            <button onClick={nextMonth} data-testid="button-next-month" className="text-muted-foreground hover:text-white transition-colors p-1">›</button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-[#1a2028]">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-12 border-b border-r border-[#1a2028]/30" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayBills = billsOnDay(day);
              const past = isPast(day);
              const today_ = isToday(day);
              const selected = selectedDay === day;
              return (
                <button
                  key={day}
                  data-testid={`cal-day-${day}`}
                  onClick={() => setSelectedDay(selected ? null : day)}
                  className={`h-12 border-b border-r border-[#1a2028]/30 flex flex-col items-center justify-start pt-1.5 px-1 transition-colors relative
                    ${selected ? "bg-[#01696F]/20" : today_ ? "bg-[#1a2028]" : "hover:bg-[#1a2028]/50"}
                    ${past ? "opacity-50" : ""}`}
                >
                  <span className={`text-xs font-medium ${today_ ? "text-[#01696F] font-bold" : "text-white"}`}>{day}</span>
                  {dayBills.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayBills.slice(0, 3).map(b => (
                        <span key={b.id} className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                      ))}
                    </div>
                  )}
                  {/* Income payday indicator -- on 1st of month */}
                  {day === 1 && income > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Bills */}
        {selectedDay !== null && (
          <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#01696F]" />
              {MONTHS[viewMonth]} {selectedDay}
            </h3>
            {selectedBills.length === 0 && income > 0 && selectedDay === 1 && (
              <div className="flex items-center gap-3 p-3 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-lg">
                <DollarSign className="w-4 h-4 text-[#22c55e]" />
                <div>
                  <p className="text-sm text-white font-medium">Payday</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(income)} incoming</p>
                </div>
              </div>
            )}
            {selectedBills.length === 0 && selectedDay !== 1 && (
              <p className="text-sm text-muted-foreground">No bills on this day.</p>
            )}
            {selectedBills.map(bill => (
              <div key={bill.id} className="flex items-center gap-3 p-3 bg-[#0f1419] rounded-lg mb-2" data-testid={`bill-detail-${bill.id}`}>
                <span className="text-lg">{BILL_ICONS[bill.category] || "📋"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{bill.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{bill.category}</p>
                </div>
                <span className="text-sm font-mono font-bold text-[#ef4444]">{formatCurrency(bill.amount)}</span>
                <button onClick={() => removeBill(bill.id)} data-testid={`button-remove-bill-${bill.id}`}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-[#ef4444]" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#f59e0b]" /> Coming Up
            </h2>
            <div className="space-y-2">
              {upcomingBills.map(bill => (
                <div key={bill.id} className="flex items-center gap-3" data-testid={`upcoming-bill-${bill.id}`}>
                  <span className="text-base">{BILL_ICONS[bill.category] || "📋"}</span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bill.daysUntil === 0 ? "Due today" : `Due in ${bill.daysUntil} day${bill.daysUntil !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-white">{formatCurrency(bill.amount)}</p>
                    <Badge variant="outline" className={`text-[10px] ${bill.daysUntil <= 3 ? "text-[#ef4444] border-[#ef4444]/30" : "text-[#f59e0b] border-[#f59e0b]/30"}`}>
                      {bill.daysUntil === 0 ? "TODAY" : `${bill.daysUntil}d`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Bills List */}
        {bills.length > 0 && (
          <div className="bg-[#141a20] rounded-xl border border-[#1a2028] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">All Recurring Bills</h2>
            <div className="space-y-2">
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center gap-3 py-1.5 border-b border-[#1a2028] last:border-0" data-testid={`bill-row-${bill.id}`}>
                  <span className="text-base">{BILL_ICONS[bill.category] || "📋"}</span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">Due on the {bill.dueDay}{bill.dueDay === 1 ? "st" : bill.dueDay === 2 ? "nd" : bill.dueDay === 3 ? "rd" : "th"}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-white">{formatCurrency(bill.amount)}</span>
                  <button onClick={() => removeBill(bill.id)} data-testid={`button-remove-bill-list-${bill.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-[#ef4444]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {bills.length === 0 && (
          <div className="bg-[#141a20] rounded-xl p-8 border border-[#1a2028] text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No bills tracked yet. Add recurring bills to never miss a payment.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
