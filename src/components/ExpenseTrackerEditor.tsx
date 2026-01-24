import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpenseEntry } from '@/types/note';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Settings, TrendingUp, Download, RefreshCw, CalendarClock, Menu, ArrowLeft, CalendarIcon, PieChart, Filter, X, BarChart3, Bell, FileDown, ArrowUpRight, ArrowDownRight, Minus, Wallet, DollarSign, Users, Split, Check, Receipt, Camera, Image, CheckCircle2, Loader2 } from 'lucide-react';
import { saveReceipt, getReceipt, deleteReceipt, compressImage } from '@/utils/receiptStorage';

import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { cn } from '@/lib/utils';
import { format, parse, isWithinInterval, startOfMonth, endOfMonth, subMonths, subDays, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, isValid } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Currency options
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
] as const;

// Pie chart colors - vibrant distinct colors for each category
const CHART_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber/Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#eab308', // Yellow
  '#0ea5e9', // Sky Blue
  '#dc2626', // Dark Red
];

interface ExpenseTrackerEditorProps {
  content: string;
  onChange: (content: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onClose?: () => void;
}

interface BudgetLimits {
  [category: string]: number;
}

interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  dayOfMonth: number;
  enabled: boolean;
  reminderDays?: number; // Days before due date to remind
  lastReminded?: string; // Track when last reminded
}

interface SpendingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category?: string;
}

interface IncomeEntry {
  id: string;
  date: string;
  source: string;
  amount: number;
  notes: string;
}

interface SplitParticipant {
  id: string;
  name: string;
  email?: string;
}

interface SplitExpense {
  id: string;
  expenseEntryId?: string;
  description: string;
  totalAmount: number;
  paidBy: string; // participant id
  date: string;
  splits: { participantId: string; amount: number; settled: boolean }[];
}

interface ExpenseData {
  entries: ExpenseEntry[];
  budgets: BudgetLimits;
  recurringExpenses: RecurringExpense[];
  lastRecurringCheck?: string;
  customCategories?: string[];
  customPaymentMethods?: string[];
  currency?: string;
  spendingGoals?: SpendingGoal[];
  incomeEntries?: IncomeEntry[];
  splitParticipants?: SplitParticipant[];
  splitExpenses?: SplitExpense[];
  budgetNotificationsEnabled?: boolean;
}

const INCOME_SOURCES = ['Salary', 'Freelance', 'Business', 'Investments', 'Rental', 'Other'] as const;

interface FilterState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  category: string;
  paymentMethod: string;
}

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Utilities'] as const;
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Wallet'] as const;
const CUSTOM_OPTION = '__custom__';

const DEFAULT_BUDGETS: BudgetLimits = {
  Food: 5000,
  Transport: 3000,
  Rent: 15000,
  Shopping: 5000,
  Utilities: 3000,
  Other: 2000,
};

const DEFAULT_RECURRING: RecurringExpense[] = [
  { id: '1', description: 'Monthly Rent', category: 'Rent', amount: 15000, paymentMethod: 'Bank Transfer', dayOfMonth: 1, enabled: false, reminderDays: 3 },
  { id: '2', description: 'Electricity Bill', category: 'Utilities', amount: 2000, paymentMethod: 'Card', dayOfMonth: 5, enabled: false, reminderDays: 2 },
  { id: '3', description: 'Internet', category: 'Utilities', amount: 1000, paymentMethod: 'Card', dayOfMonth: 10, enabled: false, reminderDays: 2 },
];

const createEmptyEntry = (): ExpenseEntry => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  date: '',
  category: '' as ExpenseEntry['category'],
  description: '',
  amount: 0,
  paymentMethod: '' as ExpenseEntry['paymentMethod'],
  notes: '',
});

const formatDateForEntry = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Date picker cell component with controlled open state
const DatePickerCell = ({ value, onChange }: { value: string; onChange: (date: string) => void }) => {
  const [open, setOpen] = useState(false);
  
  const parsedDate = value ? (() => {
    try {
      return parse(value, 'dd/MM/yyyy', new Date());
    } catch {
      return undefined;
    }
  })() : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full h-7 rounded-none text-xs justify-center px-1 font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value || "DD/MM/YY"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'dd/MM/yyyy'));
              setOpen(false);
            }
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};

// Helper to get all categories including custom ones
const getAllCategories = (customCategories: string[]) => [...CATEGORIES, ...customCategories];

export const ExpenseTrackerEditor = ({
  content,
  onChange,
  title,
  onTitleChange,
  onClose,
}: ExpenseTrackerEditorProps) => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [budgets, setBudgets] = useState<BudgetLimits>(DEFAULT_BUDGETS);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(DEFAULT_RECURRING);
  const [lastRecurringCheck, setLastRecurringCheck] = useState<string>('');
  const [initialized, setInitialized] = useState(false);
  const [showBudgetPanel, setShowBudgetPanel] = useState(false);
  const [customCategoryEntries, setCustomCategoryEntries] = useState<Set<string>>(new Set());
  const [customPaymentEntries, setCustomPaymentEntries] = useState<Set<string>>(new Set());
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customPaymentMethods, setCustomPaymentMethods] = useState<string[]>([]);
  const [currency, setCurrency] = useState<string>('USD');
  const [pieChartViewMode, setPieChartViewMode] = useState<'all-time' | 'monthly'>('all-time');
  const [spendingGoals, setSpendingGoals] = useState<SpendingGoal[]>([]);
  const [trendViewMode, setTrendViewMode] = useState<'daily' | 'weekly'>('daily');
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>([]);
  const [splitExpenses, setSplitExpenses] = useState<SplitExpense[]>([]);
  const [receiptCache, setReceiptCache] = useState<{ [entryId: string]: string }>({});
  const [receiptViewEntry, setReceiptViewEntry] = useState<ExpenseEntry | null>(null);
  const [budgetNotificationsEnabled, setBudgetNotificationsEnabled] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: undefined,
    dateTo: undefined,
    category: '',
    paymentMethod: '',
  });

  // Get current currency symbol
  const currencySymbol = useMemo(() => {
    return CURRENCIES.find(c => c.code === currency)?.symbol || '$';
  }, [currency]);

  // Force save all data
  const saveAllData = useCallback(() => {
    if (entries.length > 0 && initialized) {
      const data: ExpenseData = { entries, budgets, recurringExpenses, lastRecurringCheck, customCategories, customPaymentMethods, currency, spendingGoals, incomeEntries, splitParticipants, splitExpenses, budgetNotificationsEnabled };
      onChange(JSON.stringify(data));
    }
  }, [entries, budgets, recurringExpenses, lastRecurringCheck, customCategories, customPaymentMethods, currency, spendingGoals, incomeEntries, splitParticipants, splitExpenses, budgetNotificationsEnabled, onChange, initialized]);

  // Handle back/exit
  const handleBack = useCallback(() => {
    saveAllData();
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }
  }, [saveAllData, onClose, navigate]);

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: handleBack,
    enabled: true,
    priority: 'sheet',
  });

  // Parse content on load
  useEffect(() => {
    if (initialized) return;
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          setBudgets(DEFAULT_BUDGETS);
          setRecurringExpenses(DEFAULT_RECURRING);
        } else if (parsed.entries && Array.isArray(parsed.entries)) {
          setEntries(parsed.entries);
          setBudgets(parsed.budgets || DEFAULT_BUDGETS);
          setRecurringExpenses(parsed.recurringExpenses || DEFAULT_RECURRING);
          setLastRecurringCheck(parsed.lastRecurringCheck || '');
          setCustomCategories(parsed.customCategories || []);
          setCustomPaymentMethods(parsed.customPaymentMethods || []);
          setCurrency(parsed.currency || 'USD');
          setSpendingGoals(parsed.spendingGoals || []);
          setIncomeEntries(parsed.incomeEntries || []);
          setSplitParticipants(parsed.splitParticipants || []);
          setSplitExpenses(parsed.splitExpenses || []);
          setBudgetNotificationsEnabled(parsed.budgetNotificationsEnabled !== false);
        }
        setInitialized(true);
        return;
      } catch (e) {
        // Content is not valid JSON, start fresh
      }
    }
    const initialEntries = Array.from({ length: 20 }, () => createEmptyEntry());
    setEntries(initialEntries);
    setBudgets(DEFAULT_BUDGETS);
    setRecurringExpenses(DEFAULT_RECURRING);
    setInitialized(true);
  }, [content, initialized]);

  // Auto-add recurring expenses
  useEffect(() => {
    if (!initialized) return;
    
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    
    if (lastRecurringCheck === currentMonthKey) return;
    
    const enabledRecurring = recurringExpenses.filter(r => r.enabled);
    if (enabledRecurring.length === 0) {
      setLastRecurringCheck(currentMonthKey);
      return;
    }

    const newEntries: ExpenseEntry[] = [];
    enabledRecurring.forEach(recurring => {
      const entryDate = new Date(today.getFullYear(), today.getMonth(), recurring.dayOfMonth);
      const dateStr = formatDateForEntry(entryDate);
      
      // Check if already added this month
      const alreadyExists = entries.some(
        e => e.description === recurring.description && 
             e.date === dateStr && 
             e.amount === recurring.amount
      );
      
      if (!alreadyExists) {
        newEntries.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          date: dateStr,
          category: recurring.category,
          description: recurring.description,
          amount: recurring.amount,
          paymentMethod: recurring.paymentMethod,
          notes: 'Auto-added recurring expense',
        });
      }
    });

    if (newEntries.length > 0) {
      setEntries(prev => [...newEntries, ...prev]);
      toast.success(`Added ${newEntries.length} recurring expense(s)`);
    }
    setLastRecurringCheck(currentMonthKey);
  }, [initialized, recurringExpenses, entries, lastRecurringCheck]);

  // Auto-save
  useEffect(() => {
    if (entries.length > 0 && initialized) {
      const data: ExpenseData = { entries, budgets, recurringExpenses, lastRecurringCheck, customCategories, customPaymentMethods, currency, spendingGoals, incomeEntries, splitParticipants, splitExpenses, budgetNotificationsEnabled };
      onChange(JSON.stringify(data));
    }
  }, [entries, budgets, recurringExpenses, lastRecurringCheck, customCategories, customPaymentMethods, currency, spendingGoals, incomeEntries, splitParticipants, splitExpenses, budgetNotificationsEnabled, onChange, initialized]);

  // Add new row when last row is filled
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && lastEntry.date && lastEntry.category && lastEntry.amount > 0 && lastEntry.paymentMethod) {
      setEntries(prev => [...prev, createEmptyEntry()]);
    }
  }, [entries]);

  // All categories (including custom) - compute first so other memos can use it
  const allCategories = useMemo(() => [...CATEGORIES, ...customCategories], [customCategories]);

  // Calculate ALL spending per category (all time) for pie chart
  const totalCategorySpending = useMemo(() => {
    const spending: { [key: string]: number } = {};
    // Initialize all categories including custom ones
    allCategories.forEach(cat => { spending[cat] = 0; });
    
    entries.forEach(entry => {
      if (entry.category && entry.amount > 0) {
        spending[entry.category] = (spending[entry.category] || 0) + entry.amount;
      }
    });
    
    return spending;
  }, [entries, allCategories]);

  // Calculate spending per category for CURRENT MONTH (for budget tracking)
  const categorySpending = useMemo(() => {
    const spending: { [key: string]: number } = {};
    // Initialize all categories including custom ones
    allCategories.forEach(cat => { spending[cat] = 0; });
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    entries.forEach(entry => {
      if (entry.category && entry.amount > 0 && entry.date) {
        const parts = entry.date.split('/');
        if (parts.length === 3) {
          const entryMonth = parseInt(parts[1], 10) - 1;
          const entryYear = parseInt(parts[2], 10);
          if (entryMonth === currentMonth && entryYear === currentYear) {
            spending[entry.category] = (spending[entry.category] || 0) + entry.amount;
          }
        }
      }
    });
    
    return spending;
  }, [entries, allCategories]);

  // Budget alerts (including custom categories)
  useEffect(() => {
    if (!initialized) return;
    
    allCategories.forEach(category => {
      const spent = categorySpending[category] || 0;
      const budget = budgets[category] || 0;
      if (budget > 0) {
        const percentage = (spent / budget) * 100;
        if (percentage >= 100) {
          toast.error(`🚨 Budget exceeded for ${category}!`, { id: `budget-${category}`, duration: 5000 });
        } else if (percentage >= 90) {
          toast.warning(`⚠️ ${category} at ${percentage.toFixed(0)}% - Almost at limit!`, { id: `budget-${category}`, duration: 4000 });
        } else if (percentage >= 80) {
          toast.warning(`${category} at ${percentage.toFixed(0)}% of budget`, { id: `budget-${category}` });
        } else if (percentage >= 70) {
          toast.info(`${category} reaching ${percentage.toFixed(0)}% of budget`, { id: `budget-${category}` });
        }
      }
    });
  }, [categorySpending, budgets, initialized, allCategories]);



  // Pie chart data for spending breakdown (ALL time spending)
  const pieChartData = useMemo(() => {
    return Object.entries(totalCategorySpending)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [totalCategorySpending]);

  // Total spent (all time) for pie chart center
  const totalSpentAllTime = useMemo(() => {
    return Object.values(totalCategorySpending).reduce((a, b) => a + b, 0);
  }, [totalCategorySpending]);

  // Spending trends data (daily/weekly)
  const spendingTrendsData = useMemo(() => {
    const now = new Date();
    const filledEntries = entries.filter(e => e.date && e.amount > 0);
    
    if (trendViewMode === 'daily') {
      // Last 7 days
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      return days.map(day => {
        const dayStr = format(day, 'dd/MM/yyyy');
        const total = filledEntries
          .filter(e => e.date === dayStr)
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          label: format(day, 'EEE'),
          fullDate: format(day, 'dd MMM'),
          amount: total,
        };
      });
    } else {
      // Last 4 weeks
      const weeks = eachWeekOfInterval({ start: subDays(now, 27), end: now }, { weekStartsOn: 1 });
      return weeks.map((weekStart, idx) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const total = filledEntries.filter(e => {
          try {
            const entryDate = parse(e.date, 'dd/MM/yyyy', new Date());
            return isValid(entryDate) && isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
          } catch {
            return false;
          }
        }).reduce((sum, e) => sum + e.amount, 0);
        return {
          label: `W${idx + 1}`,
          fullDate: `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM')}`,
          amount: total,
        };
      });
    }
  }, [entries, trendViewMode]);

  // Previous month spending for comparison
  const previousMonthSpending = useMemo(() => {
    const spending: { [key: string]: number } = {};
    allCategories.forEach(cat => { spending[cat] = 0; });
    
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    const prevMonthNum = prevMonth.getMonth();
    const prevYear = prevMonth.getFullYear();
    
    entries.forEach(entry => {
      if (entry.category && entry.amount > 0 && entry.date) {
        const parts = entry.date.split('/');
        if (parts.length === 3) {
          const entryMonth = parseInt(parts[1], 10) - 1;
          const entryYear = parseInt(parts[2], 10);
          if (entryMonth === prevMonthNum && entryYear === prevYear) {
            spending[entry.category] = (spending[entry.category] || 0) + entry.amount;
          }
        }
      }
    });
    
    return spending;
  }, [entries, allCategories]);

  // Comparison data (current month vs previous month)
  const comparisonData = useMemo(() => {
    const currentTotal = Object.values(categorySpending).reduce((a, b) => a + b, 0);
    const previousTotal = Object.values(previousMonthSpending).reduce((a, b) => a + b, 0);
    
    const categoryComparisons = allCategories.map(category => {
      const current = categorySpending[category] || 0;
      const previous = previousMonthSpending[category] || 0;
      const difference = current - previous;
      const percentChange = previous > 0 ? ((difference / previous) * 100) : (current > 0 ? 100 : 0);
      
      return {
        category,
        current,
        previous,
        difference,
        percentChange,
        trend: difference > 0 ? 'up' : difference < 0 ? 'down' : 'same',
      };
    }).filter(c => c.current > 0 || c.previous > 0);

    return {
      currentTotal,
      previousTotal,
      totalDifference: currentTotal - previousTotal,
      totalPercentChange: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : (currentTotal > 0 ? 100 : 0),
      categories: categoryComparisons,
    };
  }, [categorySpending, previousMonthSpending, allCategories]);

  // Income calculations for current month
  const currentMonthIncome = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return incomeEntries.reduce((total, income) => {
      if (income.date && income.amount > 0) {
        const parts = income.date.split('/');
        if (parts.length === 3) {
          const entryMonth = parseInt(parts[1], 10) - 1;
          const entryYear = parseInt(parts[2], 10);
          if (entryMonth === currentMonth && entryYear === currentYear) {
            return total + income.amount;
          }
        }
      }
      return total;
    }, 0);
  }, [incomeEntries]);

  // Previous month income
  const previousMonthIncome = useMemo(() => {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    const prevMonthNum = prevMonth.getMonth();
    const prevYear = prevMonth.getFullYear();
    
    return incomeEntries.reduce((total, income) => {
      if (income.date && income.amount > 0) {
        const parts = income.date.split('/');
        if (parts.length === 3) {
          const entryMonth = parseInt(parts[1], 10) - 1;
          const entryYear = parseInt(parts[2], 10);
          if (entryMonth === prevMonthNum && entryYear === prevYear) {
            return total + income.amount;
          }
        }
      }
      return total;
    }, 0);
  }, [incomeEntries]);

  // Total income (all time)
  const totalIncome = useMemo(() => {
    return incomeEntries.reduce((total, income) => total + (income.amount || 0), 0);
  }, [incomeEntries]);

  // Financial summary
  const financialSummary = useMemo(() => {
    const monthlyExpenses = Object.values(categorySpending).reduce((a, b) => a + b, 0);
    const netSavings = currentMonthIncome - monthlyExpenses;
    const expenseToIncomeRatio = currentMonthIncome > 0 ? (monthlyExpenses / currentMonthIncome) * 100 : 0;
    const savingsRate = currentMonthIncome > 0 ? (netSavings / currentMonthIncome) * 100 : 0;
    
    const prevMonthExpenses = Object.values(previousMonthSpending).reduce((a, b) => a + b, 0);
    const prevNetSavings = previousMonthIncome - prevMonthExpenses;
    
    return {
      monthlyIncome: currentMonthIncome,
      monthlyExpenses,
      netSavings,
      expenseToIncomeRatio,
      savingsRate,
      prevMonthIncome: previousMonthIncome,
      prevMonthExpenses,
      prevNetSavings,
      incomeChange: currentMonthIncome - previousMonthIncome,
      savingsChange: netSavings - prevNetSavings,
    };
  }, [categorySpending, currentMonthIncome, previousMonthSpending, previousMonthIncome]);

  // Calculate spending for a specific month (for comparison feature)
  const getMonthSpending = useCallback((targetDate: Date) => {
    const spending: { [key: string]: number } = {};
    allCategories.forEach(cat => { spending[cat] = 0; });
    
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    
    entries.forEach(entry => {
      if (entry.category && entry.amount > 0 && entry.date) {
        const parts = entry.date.split('/');
        if (parts.length === 3) {
          const entryMonth = parseInt(parts[1], 10) - 1;
          const entryYear = parseInt(parts[2], 10);
          if (entryMonth === targetMonth && entryYear === targetYear) {
            spending[entry.category] = (spending[entry.category] || 0) + entry.amount;
          }
        }
      }
    });
    
    return spending;
  }, [entries, allCategories]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (!entry.date || !entry.amount) return true; // Show empty rows

      // Date filter
      if (filters.dateFrom || filters.dateTo) {
        try {
          const entryDate = parse(entry.date, 'dd/MM/yyyy', new Date());
          if (filters.dateFrom && entryDate < filters.dateFrom) return false;
          if (filters.dateTo && entryDate > filters.dateTo) return false;
        } catch {
          return true;
        }
      }

      // Category filter
      if (filters.category && entry.category !== filters.category) return false;

      // Payment method filter
      if (filters.paymentMethod && entry.paymentMethod !== filters.paymentMethod) return false;

      return true;
    });
  }, [entries, filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(filters.dateFrom || filters.dateTo || filters.category || filters.paymentMethod);
  }, [filters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      dateFrom: undefined,
      dateTo: undefined,
      category: '',
      paymentMethod: '',
    });
  }, []);

  const updateEntry = useCallback((id: string, field: keyof ExpenseEntry, value: any) => {
    setEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => {
      const filtered = prev.filter(entry => entry.id !== id);
      while (filtered.length < 20) {
        filtered.push(createEmptyEntry());
      }
      return filtered;
    });
    toast.success('Row deleted');
  }, []);

  const updateBudget = useCallback((category: string, amount: number) => {
    setBudgets(prev => ({ ...prev, [category]: amount }));
  }, []);

  const updateRecurring = useCallback((id: string, field: keyof RecurringExpense, value: any) => {
    setRecurringExpenses(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRecurring = useCallback(() => {
    const newRecurring: RecurringExpense = {
      id: Date.now().toString(),
      description: '',
      category: 'Utilities',
      amount: 0,
      paymentMethod: 'Card',
      dayOfMonth: 1,
      enabled: false,
    };
    setRecurringExpenses(prev => [...prev, newRecurring]);
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  }, []);

  // Spending goals management
  const addSpendingGoal = useCallback(() => {
    const newGoal: SpendingGoal = {
      id: Date.now().toString(),
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      deadline: format(new Date(), 'dd/MM/yyyy'),
    };
    setSpendingGoals(prev => [...prev, newGoal]);
  }, []);

  const updateSpendingGoal = useCallback((id: string, field: keyof SpendingGoal, value: any) => {
    setSpendingGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  }, []);

  const deleteSpendingGoal = useCallback((id: string) => {
    setSpendingGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  // Income management functions
  const addIncomeEntry = useCallback(() => {
    const newIncome: IncomeEntry = {
      id: Date.now().toString(),
      date: format(new Date(), 'dd/MM/yyyy'),
      source: 'Salary',
      amount: 0,
      notes: '',
    };
    setIncomeEntries(prev => [...prev, newIncome]);
  }, []);

  const updateIncomeEntry = useCallback((id: string, field: keyof IncomeEntry, value: any) => {
    setIncomeEntries(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }, []);

  const deleteIncomeEntry = useCallback((id: string) => {
    setIncomeEntries(prev => prev.filter(i => i.id !== id));
  }, []);

  // Split expense management functions
  const addSplitParticipant = useCallback(() => {
    const newParticipant: SplitParticipant = {
      id: Date.now().toString(),
      name: '',
      email: '',
    };
    setSplitParticipants(prev => [...prev, newParticipant]);
  }, []);

  const updateSplitParticipant = useCallback((id: string, field: keyof SplitParticipant, value: string) => {
    setSplitParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  const deleteSplitParticipant = useCallback((id: string) => {
    setSplitParticipants(prev => prev.filter(p => p.id !== id));
    // Also remove from any split expenses
    setSplitExpenses(prev => prev.map(exp => ({
      ...exp,
      splits: exp.splits.filter(s => s.participantId !== id),
      paidBy: exp.paidBy === id ? '' : exp.paidBy,
    })));
  }, []);

  const addSplitExpense = useCallback(() => {
    if (splitParticipants.length < 2) {
      toast.error('Add at least 2 participants first');
      return;
    }
    const equalSplit = 0; // Will be calculated when amount is set
    const newSplitExpense: SplitExpense = {
      id: Date.now().toString(),
      description: '',
      totalAmount: 0,
      paidBy: splitParticipants[0]?.id || '',
      date: format(new Date(), 'dd/MM/yyyy'),
      splits: splitParticipants.map(p => ({ participantId: p.id, amount: equalSplit, settled: false })),
    };
    setSplitExpenses(prev => [...prev, newSplitExpense]);
  }, [splitParticipants]);

  const updateSplitExpense = useCallback((id: string, field: keyof SplitExpense, value: any) => {
    setSplitExpenses(prev => prev.map(exp => {
      if (exp.id !== id) return exp;
      const updated = { ...exp, [field]: value };
      // Auto-calculate equal splits when total amount changes
      if (field === 'totalAmount' && updated.splits.length > 0) {
        const equalAmount = Number(value) / updated.splits.length;
        updated.splits = updated.splits.map(s => ({ ...s, amount: equalAmount }));
      }
      return updated;
    }));
  }, []);

  const updateSplitAmount = useCallback((expenseId: string, participantId: string, amount: number) => {
    setSplitExpenses(prev => prev.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        splits: exp.splits.map(s => s.participantId === participantId ? { ...s, amount } : s),
      };
    }));
  }, []);

  const toggleSplitSettled = useCallback((expenseId: string, participantId: string) => {
    setSplitExpenses(prev => prev.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        splits: exp.splits.map(s => s.participantId === participantId ? { ...s, settled: !s.settled } : s),
      };
    }));
  }, []);

  const deleteSplitExpense = useCallback((id: string) => {
    setSplitExpenses(prev => prev.filter(exp => exp.id !== id));
  }, []);

  // Calculate balances for each participant
  const splitBalances = useMemo(() => {
    const balances: { [participantId: string]: number } = {};
    splitParticipants.forEach(p => { balances[p.id] = 0; });

    splitExpenses.forEach(exp => {
      if (!exp.paidBy || exp.totalAmount <= 0) return;
      
      // The payer paid the full amount
      balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.totalAmount;
      
      // Each participant owes their split
      exp.splits.forEach(split => {
        if (!split.settled) {
          balances[split.participantId] = (balances[split.participantId] || 0) - split.amount;
        }
      });
    });

    return balances;
  }, [splitParticipants, splitExpenses]);

  // Generate settlement suggestions
  const settlementSuggestions = useMemo(() => {
    const suggestions: { from: string; to: string; amount: number }[] = [];
    const balancesCopy = { ...splitBalances };
    
    const debtors = Object.entries(balancesCopy).filter(([_, bal]) => bal < -0.01).sort((a, b) => a[1] - b[1]);
    const creditors = Object.entries(balancesCopy).filter(([_, bal]) => bal > 0.01).sort((a, b) => b[1] - a[1]);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const [debtorId, debtorBalance] = debtors[i];
      const [creditorId, creditorBalance] = creditors[j];
      
      const amount = Math.min(Math.abs(debtorBalance), creditorBalance);
      if (amount > 0.01) {
        suggestions.push({ from: debtorId, to: creditorId, amount });
      }
      
      debtors[i] = [debtorId, debtorBalance + amount];
      creditors[j] = [creditorId, creditorBalance - amount];
      
      if (Math.abs(debtors[i][1]) < 0.01) i++;
      if (creditors[j][1] < 0.01) j++;
    }

    return suggestions;
  }, [splitBalances]);

  // Load receipts for entries that have them
  useEffect(() => {
    const loadReceipts = async () => {
      const entriesWithReceipts = entries.filter(e => e.receiptId && !receiptCache[e.id]);
      for (const entry of entriesWithReceipts) {
        if (entry.receiptId) {
          const imageData = await getReceipt(entry.receiptId);
          if (imageData) {
            setReceiptCache(prev => ({ ...prev, [entry.id]: imageData }));
          }
        }
      }
    };
    if (initialized) {
      loadReceipts();
    }
  }, [entries, initialized, receiptCache]);

  // Handle receipt attachment
  const handleAttachReceipt = useCallback(async (entryId: string, file: File) => {
    try {
      const compressedImage = await compressImage(file);
      const receiptId = `receipt-${entryId}-${Date.now()}`;
      await saveReceipt(receiptId, compressedImage);
      
      setEntries(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, receiptId } : entry
      ));
      setReceiptCache(prev => ({ ...prev, [entryId]: compressedImage }));
      toast.success('Receipt attached');
    } catch (error) {
      console.error('Failed to attach receipt:', error);
      toast.error('Failed to attach receipt');
    }
  }, []);

  // Handle receipt removal
  const handleRemoveReceipt = useCallback(async (entryId: string, receiptId: string) => {
    try {
      await deleteReceipt(receiptId);
      setEntries(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, receiptId: undefined } : entry
      ));
      setReceiptCache(prev => {
        const newCache = { ...prev };
        delete newCache[entryId];
        return newCache;
      });
      toast.success('Receipt removed');
    } catch (error) {
      console.error('Failed to remove receipt:', error);
      toast.error('Failed to remove receipt');
    }
  }, []);

  const formatDateInput = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const validateEntry = (entry: ExpenseEntry): boolean => {
    return !!(entry.date && entry.category && entry.amount > 0 && entry.paymentMethod);
  };

  const calculateTotal = (): number => {
    return entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '[&>div]:bg-destructive';
    if (percentage >= 80) return '[&>div]:bg-amber-500';
    if (percentage >= 60) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-primary';
  };

  // Get category color for consistent colors across pie chart and budget
  const getCategoryColor = (category: string, index: number): string => {
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  // Export functions
  const exportToCSV = useCallback(() => {
    const filledEntries = entries.filter(e => e.date && e.amount > 0);
    if (filledEntries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'];
    const rows = filledEntries.map(e => [
      e.date,
      e.category,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount.toString(),
      e.paymentMethod,
      `"${e.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'expenses'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  }, [entries, title]);

  const exportToExcel = useCallback(() => {
    const filledEntries = entries.filter(e => e.date && e.amount > 0);
    if (filledEntries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    // Create XML-based Excel file
    const escapeXml = (str: string) => str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c));
    
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Worksheet ss:Name="Expenses"><Table>';
    
    // Header row
    xml += '<Row>';
    ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'].forEach(h => {
      xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += '</Row>';
    
    // Data rows
    filledEntries.forEach(e => {
      xml += '<Row>';
      xml += `<Cell><Data ss:Type="String">${escapeXml(e.date)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(e.category)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(e.description)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="Number">${e.amount}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(e.paymentMethod)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(e.notes)}</Data></Cell>`;
      xml += '</Row>';
    });
    
    xml += '</Table></Worksheet></Workbook>';
    
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'expenses'}_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to Excel');
  }, [entries, title]);

  // Only sum budgets for categories that have a budget set (> 0)
  const totalBudget = Object.entries(budgets)
    .filter(([_, value]) => value > 0)
    .reduce((sum, [_, value]) => sum + value, 0);
  const totalSpent = Object.values(categorySpending).reduce((a, b) => a + b, 0);

  // Export spending goals to CSV
  const exportGoalsToCSV = useCallback(() => {
    if (spendingGoals.length === 0) {
      toast.error('No spending goals to export');
      return;
    }

    const headers = ['Goal Name', 'Target Amount', 'Current Amount', 'Progress %', 'Category', 'Deadline', 'Status'];
    const rows = spendingGoals.map(g => {
      const progress = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : '0';
      const status = g.currentAmount >= g.targetAmount ? 'Completed' : 'In Progress';
      return [
        `"${g.name.replace(/"/g, '""')}"`,
        g.targetAmount.toString(),
        g.currentAmount.toString(),
        progress,
        g.category || 'None',
        g.deadline || '',
        status
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spending_goals_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Goals exported to CSV');
  }, [spendingGoals]);

  // Export spending trends to CSV
  const exportTrendsToCSV = useCallback(() => {
    if (spendingTrendsData.length === 0) {
      toast.error('No trends data to export');
      return;
    }

    const headers = ['Period', 'Date Range', `Amount (${currency})`];
    const rows = spendingTrendsData.map(t => [
      t.label,
      t.fullDate,
      t.amount.toString()
    ]);

    // Add summary
    const totalTrend = spendingTrendsData.reduce((sum, t) => sum + t.amount, 0);
    const avgTrend = totalTrend / spendingTrendsData.length;
    rows.push(['---', '---', '---']);
    rows.push(['Total', '', totalTrend.toString()]);
    rows.push(['Average', '', avgTrend.toFixed(2)]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spending_trends_${trendViewMode}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Trends exported to CSV');
  }, [spendingTrendsData, currency, trendViewMode]);

  // Export full report (goals + trends + budget overview)
  const exportFullReport = useCallback(() => {
    let reportContent = `EXPENSE TRACKER REPORT\n`;
    reportContent += `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
    reportContent += `Currency: ${currency}\n\n`;

    // Budget Overview
    reportContent += `=== MONTHLY BUDGET OVERVIEW ===\n`;
    reportContent += `Total Budget: ${currencySymbol}${totalBudget.toLocaleString()}\n`;
    reportContent += `Total Spent (This Month): ${currencySymbol}${totalSpent.toLocaleString()}\n`;
    reportContent += `Remaining: ${currencySymbol}${(totalBudget - totalSpent).toLocaleString()}\n\n`;

    reportContent += `Category,Budget,Spent,Remaining,Usage %\n`;
    allCategories.forEach(cat => {
      const budget = budgets[cat] || 0;
      const spent = categorySpending[cat] || 0;
      const remaining = budget - spent;
      const usage = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '0';
      reportContent += `${cat},${budget},${spent},${remaining},${usage}%\n`;
    });

    // Spending Goals
    if (spendingGoals.length > 0) {
      reportContent += `\n=== SPENDING GOALS ===\n`;
      reportContent += `Goal Name,Target,Saved,Progress,Status\n`;
      spendingGoals.forEach(g => {
        const progress = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : '0';
        const status = g.currentAmount >= g.targetAmount ? 'Completed' : 'In Progress';
        reportContent += `"${g.name}",${g.targetAmount},${g.currentAmount},${progress}%,${status}\n`;
      });
    }

    // Spending Trends
    reportContent += `\n=== SPENDING TRENDS (${trendViewMode === 'daily' ? 'Last 7 Days' : 'Last 4 Weeks'}) ===\n`;
    reportContent += `Period,Date Range,Amount\n`;
    spendingTrendsData.forEach(t => {
      reportContent += `${t.label},${t.fullDate},${t.amount}\n`;
    });

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense_report_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Full report exported');
  }, [currency, currencySymbol, totalBudget, totalSpent, allCategories, budgets, categorySpending, spendingGoals, spendingTrendsData, trendViewMode]);

  const filledEntriesCount = entries.filter(e => e.date && e.category && e.amount > 0).length;
  const enabledRecurringCount = recurringExpenses.filter(r => r.enabled).length;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Track save status
  useEffect(() => {
    if (entries.length > 0 && initialized) {
      setIsSaving(true);
      const timer = setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [entries, budgets, recurringExpenses, customCategories, customPaymentMethods, currency, spendingGoals, incomeEntries, splitParticipants, splitExpenses, budgetNotificationsEnabled, initialized]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Title and Hamburger Menu */}
      <div className="px-2 py-2 border-b bg-background flex items-center gap-2">
        {/* Save Status Indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : lastSaved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : null}
        </div>
        
        {/* Hamburger Menu - Using Drawer for instant appearance */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex flex-row items-center gap-2 pb-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DrawerTitle>Expense Options</DrawerTitle>
            </DrawerHeader>
            <div 
              className="px-4 pb-6 space-y-4 overflow-y-auto will-change-scroll transform-gpu" 
              style={{ 
                WebkitOverflowScrolling: 'touch', 
                scrollBehavior: 'auto', 
                overscrollBehavior: 'none',
                touchAction: 'pan-y',
              }}
            >
              {/* Currency Selector */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Currency</span>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-32 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.code} className="text-xs">
                          {c.symbol} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Budget Notifications Toggle */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">Budget Alerts</span>
                      <p className="text-xs text-muted-foreground">Push notifications at 70%, 80%, 90%, 100%</p>
                    </div>
                  </div>
                  <Switch 
                    checked={budgetNotificationsEnabled} 
                    onCheckedChange={setBudgetNotificationsEnabled}
                  />
                </div>
              </div>

              {/* Financial Overview - Income, Expenses, Net Savings */}
              <div className="p-4 rounded-lg border bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="h-4 w-4 text-primary" />
                  <p className="text-base font-semibold">Financial Overview</p>
                  <span className="text-xs text-muted-foreground ml-auto">(This Month)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Income */}
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-muted-foreground">Income</span>
                    </div>
                    <span className="text-lg font-bold text-green-500">
                      {currencySymbol}{financialSummary.monthlyIncome.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Expenses */}
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-1 mb-1">
                      <ArrowUpRight className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-muted-foreground">Expenses</span>
                    </div>
                    <span className="text-lg font-bold text-destructive">
                      {currencySymbol}{financialSummary.monthlyExpenses.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Net Savings */}
                <div className={cn(
                  "p-3 rounded-lg border mb-3",
                  financialSummary.netSavings >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-destructive/5 border-destructive/20"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Net Savings</span>
                      <div className={cn(
                        "text-xl font-bold",
                        financialSummary.netSavings >= 0 ? "text-green-500" : "text-destructive"
                      )}>
                        {financialSummary.netSavings >= 0 ? '+' : ''}{currencySymbol}{financialSummary.netSavings.toLocaleString()}
                      </div>
                    </div>
                    {financialSummary.savingsChange !== 0 && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs",
                        financialSummary.savingsChange > 0 ? "text-green-500" : "text-destructive"
                      )}>
                        {financialSummary.savingsChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        vs last month
                      </div>
                    )}
                  </div>
                </div>

                {/* Ratios */}
                {financialSummary.monthlyIncome > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expense-to-Income Ratio</span>
                      <span className={cn(
                        "font-medium",
                        financialSummary.expenseToIncomeRatio > 100 ? "text-destructive" :
                        financialSummary.expenseToIncomeRatio > 80 ? "text-amber-500" : "text-green-500"
                      )}>
                        {financialSummary.expenseToIncomeRatio.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(financialSummary.expenseToIncomeRatio, 100)} 
                      className={cn(
                        "h-2",
                        financialSummary.expenseToIncomeRatio > 100 ? "[&>div]:bg-destructive" :
                        financialSummary.expenseToIncomeRatio > 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                      )}
                    />
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-muted-foreground">Savings Rate</span>
                      <span className={cn(
                        "font-medium",
                        financialSummary.savingsRate < 0 ? "text-destructive" :
                        financialSummary.savingsRate < 20 ? "text-amber-500" : "text-green-500"
                      )}>
                        {financialSummary.savingsRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {financialSummary.monthlyIncome === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add income to see expense ratios
                  </p>
                )}
              </div>

              {/* Income Tracking Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <DollarSign className="h-4 w-4" />
                    Income Tracking
                    {incomeEntries.length > 0 && (
                      <span className="bg-green-500 text-white text-xs px-1.5 rounded-full ml-auto">
                        {incomeEntries.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-96 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Income Tracking
                    </SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground mt-2 mb-4">
                    Track your income sources to calculate net savings.
                  </p>
                  
                  {/* Income Summary */}
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Income (All Time)</span>
                      <span className="text-lg font-bold text-green-500">
                        {currencySymbol}{totalIncome.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">This Month</span>
                      <span className="text-sm font-medium text-green-500">
                        {currencySymbol}{currentMonthIncome.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {incomeEntries.map((income) => (
                      <div key={income.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={income.date}
                            onChange={(e) => updateIncomeEntry(income.id, 'date', formatDateInput(e.target.value))}
                            placeholder="DD/MM/YYYY"
                            className="h-8 text-sm w-28"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => deleteIncomeEntry(income.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={income.source}
                            onValueChange={(v) => updateIncomeEntry(income.id, 'source', v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCOME_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              value={income.amount || ''}
                              onChange={(e) => updateIncomeEntry(income.id, 'amount', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="h-8 text-sm pl-6"
                            />
                          </div>
                        </div>
                        <Input
                          value={income.notes}
                          onChange={(e) => updateIncomeEntry(income.id, 'notes', e.target.value)}
                          placeholder="Notes (optional)"
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" onClick={addIncomeEntry}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Income
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Split Expenses Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Split Expenses
                    {splitExpenses.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full ml-auto">
                        {splitExpenses.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Split Expenses
                    </SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground mt-2 mb-4">
                    Divide costs among multiple people and track settlements.
                  </p>
                  
                  {/* Participants Section */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Participants</p>
                      <Button variant="ghost" size="sm" onClick={addSplitParticipant} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {splitParticipants.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3 border rounded-lg">
                        Add participants to split expenses
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {splitParticipants.map((participant) => (
                          <div key={participant.id} className="flex items-center gap-2 p-2 border rounded-lg">
                            <Input
                              value={participant.name}
                              onChange={(e) => updateSplitParticipant(participant.id, 'name', e.target.value)}
                              placeholder="Name"
                              className="h-7 text-sm flex-1"
                            />
                            <div className={cn(
                              "text-xs font-medium min-w-16 text-right",
                              (splitBalances[participant.id] || 0) > 0.01 ? "text-green-500" :
                              (splitBalances[participant.id] || 0) < -0.01 ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {(splitBalances[participant.id] || 0) > 0.01 ? '+' : ''}
                              {currencySymbol}{(splitBalances[participant.id] || 0).toFixed(2)}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive shrink-0"
                              onClick={() => deleteSplitParticipant(participant.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Settlement Suggestions */}
                  {settlementSuggestions.length > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-6">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Split className="h-4 w-4" />
                        Settlement Summary
                      </p>
                      <div className="space-y-2">
                        {settlementSuggestions.map((s, idx) => {
                          const fromName = splitParticipants.find(p => p.id === s.from)?.name || 'Unknown';
                          const toName = splitParticipants.find(p => p.id === s.to)?.name || 'Unknown';
                          return (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                <span className="font-medium text-foreground">{fromName}</span>
                                {' → '}
                                <span className="font-medium text-foreground">{toName}</span>
                              </span>
                              <span className="font-bold text-primary">
                                {currencySymbol}{s.amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Split Expenses List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Expenses to Split</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={addSplitExpense} 
                        className="h-7 text-xs"
                        disabled={splitParticipants.length < 2}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    
                    {splitParticipants.length < 2 && (
                      <p className="text-xs text-amber-600 text-center py-2">
                        Add at least 2 participants to create split expenses
                      </p>
                    )}

                    {splitExpenses.map((expense) => (
                      <div key={expense.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={expense.description}
                            onChange={(e) => updateSplitExpense(expense.id, 'description', e.target.value)}
                            placeholder="Description (e.g., Dinner)"
                            className="h-8 text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => deleteSplitExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Total Amount</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                                {currencySymbol}
                              </span>
                              <Input
                                type="number"
                                value={expense.totalAmount || ''}
                                onChange={(e) => updateSplitExpense(expense.id, 'totalAmount', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="h-8 text-sm pl-5"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Paid By</label>
                            <Select
                              value={expense.paidBy}
                              onValueChange={(v) => updateSplitExpense(expense.id, 'paidBy', v)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {splitParticipants.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name || 'Unnamed'}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Individual Splits */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Split Amounts</p>
                          {expense.splits.map((split) => {
                            const participant = splitParticipants.find(p => p.id === split.participantId);
                            if (!participant) return null;
                            const isPayer = expense.paidBy === split.participantId;
                            return (
                              <div key={split.participantId} className="flex items-center gap-2">
                                <span className={cn(
                                  "text-xs flex-1 truncate",
                                  isPayer && "font-medium text-primary"
                                )}>
                                  {participant.name || 'Unnamed'}
                                  {isPayer && ' (paid)'}
                                </span>
                                <div className="relative w-20">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                                    {currencySymbol}
                                  </span>
                                  <Input
                                    type="number"
                                    value={split.amount || ''}
                                    onChange={(e) => updateSplitAmount(expense.id, split.participantId, parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs pl-4 pr-1"
                                  />
                                </div>
                                <Button
                                  variant={split.settled ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "h-7 w-7 p-0",
                                    split.settled && "bg-green-500 hover:bg-green-600"
                                  )}
                                  onClick={() => toggleSplitSettled(expense.id, split.participantId)}
                                  disabled={isPayer}
                                  title={split.settled ? "Mark as unpaid" : "Mark as settled"}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {splitExpenses.length === 0 && splitParticipants.length >= 2 && (
                      <p className="text-xs text-muted-foreground text-center py-3 border rounded-lg">
                        No split expenses yet. Add one to get started.
                      </p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Pie Chart - Spending Breakdown (Donut with center label) */}
              {(pieChartViewMode === 'all-time' ? pieChartData.length > 0 : Object.values(categorySpending).some(v => v > 0)) && (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-semibold">Spending Breakdown</p>
                    {/* Toggle for all-time vs monthly */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => setPieChartViewMode('monthly')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-colors",
                          pieChartViewMode === 'monthly' 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        This Month
                      </button>
                      <button
                        onClick={() => setPieChartViewMode('all-time')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-colors",
                          pieChartViewMode === 'all-time' 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        All Time
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const currentData = pieChartViewMode === 'all-time' 
                      ? pieChartData 
                      : Object.entries(categorySpending)
                          .filter(([_, value]) => value > 0)
                          .map(([name, value]) => ({ name, value }))
                          .sort((a, b) => b.value - a.value);
                    const currentTotal = pieChartViewMode === 'all-time' 
                      ? totalSpentAllTime 
                      : Object.values(categorySpending).reduce((a, b) => a + b, 0);

                    if (currentData.length === 0) {
                      return (
                        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                          No spending data for this period
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="relative h-52 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={currentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                                stroke="none"
                              >
                                {currentData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => [`${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Amount']}
                                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                              />
                            </RechartsPie>
                          </ResponsiveContainer>
                          {/* Center Label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-muted-foreground">Total</span>
                            <span className="text-lg font-bold text-primary">
                              {currencySymbol}{currentTotal >= 1000 
                                ? `${(currentTotal / 1000).toFixed(2)}K` 
                                : currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        {/* Legend below chart with amounts and percentages */}
                        <div className="mt-4 space-y-2 border-t pt-3">
                          {currentData.map((item, index) => {
                            const percentage = currentTotal > 0 ? ((item.value / currentTotal) * 100).toFixed(1) : '0';
                            return (
                              <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full shrink-0" 
                                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                                  />
                                  <span>{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{currencySymbol}{item.value.toLocaleString('en-US')}</span>
                                  <span className="text-muted-foreground text-xs">({percentage}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Spending Trends Bar Chart */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <p className="text-base font-semibold">Spending Trends</p>
                  </div>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    <button
                      onClick={() => setTrendViewMode('daily')}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md transition-colors",
                        trendViewMode === 'daily' 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setTrendViewMode('weekly')}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md transition-colors",
                        trendViewMode === 'weekly' 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendingTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${currencySymbol}${value.toLocaleString('en-US')}`, 'Spent']}
                        labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ''}
                        contentStyle={{ 
                          background: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {trendViewMode === 'daily' ? 'Last 7 days' : 'Last 4 weeks'}
                  </p>
                  <Button variant="ghost" size="sm" onClick={exportTrendsToCSV} className="h-7 text-xs">
                    <FileDown className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Month-over-Month Comparison */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-base font-semibold">Month Comparison</p>
                </div>
                
                {/* Total Comparison */}
                <div className="p-3 rounded-lg bg-muted/30 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    <span className="font-bold text-lg">{currencySymbol}{comparisonData.currentTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Last Month</span>
                    <span className="font-medium text-muted-foreground">{currencySymbol}{comparisonData.previousTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Difference</span>
                    <div className="flex items-center gap-1">
                      {comparisonData.totalDifference > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                      ) : comparisonData.totalDifference < 0 ? (
                        <ArrowDownRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={cn(
                        "font-bold",
                        comparisonData.totalDifference > 0 ? "text-destructive" : 
                        comparisonData.totalDifference < 0 ? "text-green-500" : "text-muted-foreground"
                      )}>
                        {comparisonData.totalDifference > 0 ? '+' : ''}{currencySymbol}{comparisonData.totalDifference.toLocaleString()}
                        <span className="text-xs ml-1">
                          ({comparisonData.totalPercentChange > 0 ? '+' : ''}{comparisonData.totalPercentChange.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {comparisonData.categories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">By Category</p>
                    {comparisonData.categories.map((item) => (
                      <div key={item.category} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                        <span className="font-medium">{item.category}</span>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-muted-foreground text-xs">{currencySymbol}{item.previous.toLocaleString()}</span>
                            <span className="mx-1 text-muted-foreground">→</span>
                            <span className="font-medium">{currencySymbol}{item.current.toLocaleString()}</span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-0.5 min-w-16 justify-end",
                            item.trend === 'up' ? "text-destructive" : 
                            item.trend === 'down' ? "text-green-500" : "text-muted-foreground"
                          )}>
                            {item.trend === 'up' ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : item.trend === 'down' ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            <span className="text-xs font-medium">
                              {item.percentChange > 0 ? '+' : ''}{item.percentChange.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {comparisonData.categories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No spending data to compare
                  </p>
                )}
              </div>


              {/* Export Reports Section */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Export Data</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={exportToCSV} className="text-xs">
                    <FileDown className="h-3 w-3 mr-1" />
                    Expenses CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="text-xs">
                    <FileDown className="h-3 w-3 mr-1" />
                    Expenses Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportGoalsToCSV} className="text-xs" disabled={spendingGoals.length === 0}>
                    <FileDown className="h-3 w-3 mr-1" />
                    Goals CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportFullReport} className="text-xs">
                    <FileDown className="h-3 w-3 mr-1" />
                    Full Report
                  </Button>
                </div>
              </div>


              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Filter className="h-4 w-4" />
                    Filter Expenses
                    {hasActiveFilters && (
                      <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full ml-auto">
                        Active
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filter Expenses
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {/* Date Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date From</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date To</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select 
                        value={filters.category} 
                        onValueChange={(v) => setFilters(prev => ({ ...prev, category: v === 'all' ? '' : v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="all">All categories</SelectItem>
                          {allCategories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Method Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Method</label>
                      <Select 
                        value={filters.paymentMethod} 
                        onValueChange={(v) => setFilters(prev => ({ ...prev, paymentMethod: v === 'all' ? '' : v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All methods" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="all">All methods</SelectItem>
                          {[...PAYMENT_METHODS, ...customPaymentMethods].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                      <Button variant="outline" className="w-full" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-2" />
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Budget Overview in Menu - includes custom categories */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Monthly Budget</span>
                  <span className="text-xs text-muted-foreground">
                    ({currencySymbol}{totalSpent.toLocaleString('en-US')} / {currencySymbol}{totalBudget.toLocaleString('en-US')})
                  </span>
                </div>
                <div className="space-y-2">
                  {allCategories.map((category, index) => {
                    const spent = categorySpending[category] || 0;
                    const budget = budgets[category] || 0;
                    const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                    const isOverBudget = spent > budget && budget > 0;
                    const categoryColor = getCategoryColor(category, index);

                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: categoryColor }}
                            />
                            <span>{category}</span>
                          </div>
                          <span className={isOverBudget ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {currencySymbol}{spent.toLocaleString('en-US')} / {currencySymbol}{budget.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`, 
                              backgroundColor: isOverBudget ? '#ef4444' : categoryColor 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Settings className="h-4 w-4 mr-2" />
                      Set Budgets
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Set Monthly Budgets</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      {/* Default categories */}
                      {CATEGORIES.map((category) => (
                        <div key={category} className="space-y-2">
                          <label className="text-sm font-medium">{category}</label>
                          <Input
                            type="number"
                            value={budgets[category] || 0}
                            onChange={(e) => updateBudget(category, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            className="h-9"
                          />
                        </div>
                      ))}
                      {/* Custom categories */}
                      {customCategories.length > 0 && (
                        <>
                          <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium text-muted-foreground mb-3">Custom Categories</p>
                          </div>
                          {customCategories.map((category) => (
                            <div key={category} className="space-y-2">
                              <label className="text-sm font-medium">{category}</label>
                              <Input
                                type="number"
                                value={budgets[category] || 0}
                                onChange={(e) => updateBudget(category, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                min="0"
                                className="h-9"
                              />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>


              {/* Recurring Expenses in Menu - includes custom categories */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Recurring Expenses & Bills
                    {enabledRecurringCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full ml-auto">
                        {enabledRecurringCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-96 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Recurring Expenses
                    </SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground mt-2 mb-4">
                    Auto-add monthly bills with reminders.
                  </p>


                  <div className="space-y-4">
                    {recurringExpenses.map((recurring) => (
                      <div key={recurring.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={recurring.enabled}
                              onCheckedChange={(checked) => updateRecurring(recurring.id, 'enabled', checked)}
                            />
                            <Label className="text-sm">Enabled</Label>
                          </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteRecurring(recurring.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            value={recurring.description}
                            onChange={(e) => updateRecurring(recurring.id, 'description', e.target.value)}
                            placeholder="Description (e.g., Monthly Rent)"
                            className="h-8 text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={recurring.category}
                              onValueChange={(v) => updateRecurring(recurring.id, 'category', v)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              value={recurring.amount || ''}
                              onChange={(e) => updateRecurring(recurring.id, 'amount', parseFloat(e.target.value) || 0)}
                              placeholder="Amount"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Select
                              value={recurring.paymentMethod}
                              onValueChange={(v) => updateRecurring(recurring.id, 'paymentMethod', v)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Day:</span>
                              <Input
                                type="number"
                                min={1}
                                max={28}
                                value={recurring.dayOfMonth}
                                onChange={(e) => updateRecurring(recurring.id, 'dayOfMonth', Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="h-8 text-sm w-14"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Bell className="h-3 w-3 text-muted-foreground" />
                              <Select
                                value={(recurring.reminderDays || 3).toString()}
                                onValueChange={(v) => updateRecurring(recurring.id, 'reminderDays', parseInt(v))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1d</SelectItem>
                                  <SelectItem value="2">2d</SelectItem>
                                  <SelectItem value="3">3d</SelectItem>
                                  <SelectItem value="5">5d</SelectItem>
                                  <SelectItem value="7">7d</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      </div>
                    ))}

                    <Button variant="outline" className="w-full" onClick={addRecurring}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recurring Bill
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Export Options in Menu */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Export</p>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                  Export as CSV
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={exportToExcel}>
                  <Download className="h-4 w-4" />
                  Export as Excel
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Expense Sheet Title"
            className="text-base font-semibold border-none shadow-none focus-visible:ring-0 bg-transparent px-0 h-8"
          />
        </div>
      </div>

      {/* Table Container - Compact layout for maximum visibility */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[750px]">
        <Table className="border-collapse text-xs">
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow className="border-b">
              <TableHead className="w-[85px] text-center font-medium border-r bg-muted py-1 px-1">Date</TableHead>
              <TableHead className="w-[80px] text-center font-medium border-r bg-muted py-1 px-1">Category</TableHead>
              <TableHead className="w-[70px] text-center font-medium border-r bg-muted py-1 px-1">Amount</TableHead>
              <TableHead className="w-[80px] text-center font-medium border-r bg-muted py-1 px-1">Payment</TableHead>
              <TableHead className="w-[36px] text-center font-medium border-r bg-muted py-1 px-0">
                <Receipt className="h-3 w-3 mx-auto" />
              </TableHead>
              <TableHead className="w-[80px] text-center font-medium border-r bg-muted py-1 px-1">Notes</TableHead>
              <TableHead className="w-[110px] text-center font-medium border-r bg-muted py-1 px-1">Description</TableHead>
              <TableHead className="w-[32px] text-center font-medium bg-muted py-1 px-0"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry) => (
              <TableRow 
                key={entry.id} 
                className={cn(
                  "border-b hover:bg-muted/20",
                  !validateEntry(entry) && entry.date && "bg-destructive/5"
                )}
              >
                {/* Date */}
                <TableCell className="p-0 border-r">
                  <DatePickerCell
                    value={entry.date}
                    onChange={(date) => updateEntry(entry.id, 'date', date)}
                  />
                </TableCell>
                {/* Category */}
                <TableCell className="p-0 border-r">
                  {!customCategoryEntries.has(entry.id) && ([...CATEGORIES, ...customCategories].includes(entry.category as any) || !entry.category) ? (
                    <Select
                      value={entry.category || ''}
                      onValueChange={(value) => {
                        if (value === CUSTOM_OPTION) {
                          setCustomCategoryEntries(prev => new Set(prev).add(entry.id));
                          updateEntry(entry.id, 'category', '');
                        } else {
                          updateEntry(entry.id, 'category', value);
                        }
                      }}
                    >
                      <SelectTrigger className="border-0 rounded-none h-7 text-xs focus:ring-1 focus:ring-inset px-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                        {customCategories.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_OPTION} className="text-primary font-medium text-xs">
                          + Custom...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={entry.category}
                      onChange={(e) => updateEntry(entry.id, 'category', e.target.value)}
                      placeholder="Type category"
                      className="border-0 rounded-none h-7 text-center text-xs focus-visible:ring-1 focus-visible:ring-inset px-1"
                      autoFocus
                      onBlur={() => {
                        const val = entry.category?.trim();
                        if (!val) {
                          setCustomCategoryEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        } else if (!CATEGORIES.includes(val as any) && !customCategories.includes(val)) {
                          setCustomCategories(prev => [...prev, val]);
                          setCustomCategoryEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        } else {
                          setCustomCategoryEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        }
                      }}
                    />
                  )}
                </TableCell>
                {/* Amount */}
                <TableCell className="p-0 border-r">
                  <Input
                    type="number"
                    value={entry.amount || ''}
                    onChange={(e) => updateEntry(entry.id, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="border-0 rounded-none h-7 text-xs text-right focus-visible:ring-1 focus-visible:ring-inset px-1"
                  />
                </TableCell>
                {/* Payment */}
                <TableCell className="p-0 border-r">
                  {!customPaymentEntries.has(entry.id) && ([...PAYMENT_METHODS, ...customPaymentMethods].includes(entry.paymentMethod as any) || !entry.paymentMethod) ? (
                    <Select
                      value={entry.paymentMethod || ''}
                      onValueChange={(value) => {
                        if (value === CUSTOM_OPTION) {
                          setCustomPaymentEntries(prev => new Set(prev).add(entry.id));
                          updateEntry(entry.id, 'paymentMethod', '');
                        } else {
                          updateEntry(entry.id, 'paymentMethod', value);
                        }
                      }}
                    >
                      <SelectTrigger className="border-0 rounded-none h-7 text-xs focus:ring-1 focus:ring-inset px-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method} className="text-xs">{method}</SelectItem>
                        ))}
                        {customPaymentMethods.map((method) => (
                          <SelectItem key={method} value={method} className="text-xs">{method}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_OPTION} className="text-primary font-medium text-xs">
                          + Custom...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={entry.paymentMethod}
                      onChange={(e) => updateEntry(entry.id, 'paymentMethod', e.target.value)}
                      placeholder="Type method"
                      className="border-0 rounded-none h-7 text-center text-xs focus-visible:ring-1 focus-visible:ring-inset px-1"
                      autoFocus
                      onBlur={() => {
                        const val = entry.paymentMethod?.trim();
                        if (!val) {
                          setCustomPaymentEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        } else if (!PAYMENT_METHODS.includes(val as any) && !customPaymentMethods.includes(val)) {
                          setCustomPaymentMethods(prev => [...prev, val]);
                          setCustomPaymentEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        } else {
                          setCustomPaymentEntries(prev => {
                            const next = new Set(prev);
                            next.delete(entry.id);
                            return next;
                          });
                        }
                      }}
                    />
                  )}
                </TableCell>
                {/* Receipt */}
                <TableCell className="p-0 border-r">
                  <div className="flex items-center justify-center h-7">
                    {entry.receiptId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                        onClick={() => setReceiptViewEntry(entry)}
                      >
                        <Image className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAttachReceipt(entry.id, file);
                            e.target.value = '';
                          }}
                        />
                        <div className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors">
                          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </label>
                    )}
                  </div>
                </TableCell>
                {/* Notes */}
                <TableCell className="p-0 border-r">
                  <Input
                    value={entry.notes}
                    onChange={(e) => updateEntry(entry.id, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="border-0 rounded-none h-7 text-xs focus-visible:ring-1 focus-visible:ring-inset px-1"
                  />
                </TableCell>
                {/* Description */}
                <TableCell className="p-0 border-r">
                  <Input
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="border-0 rounded-none h-7 text-xs focus-visible:ring-1 focus-visible:ring-inset px-1"
                  />
                </TableCell>
                {/* Delete */}
                <TableCell className="p-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEntry(entry.id)}
                    className="h-7 w-full rounded-none text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Add Row Button - Compact */}
      <div className="px-2 py-2 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEntries(prev => [...prev, createEmptyEntry()])}
          className="w-full h-8 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Row
        </Button>
      </div>

      {/* Receipt View Modal */}
      {receiptViewEntry && (
        <Sheet open={!!receiptViewEntry} onOpenChange={(open) => !open && setReceiptViewEntry(null)}>
          <SheetContent side="bottom" className="h-[80vh] flex flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt - {receiptViewEntry.description || 'Expense'}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-auto py-4">
              {receiptCache[receiptViewEntry.id] ? (
                <div className="flex flex-col items-center gap-4">
                  <img 
                    src={receiptCache[receiptViewEntry.id]} 
                    alt="Receipt" 
                    className="max-w-full max-h-[50vh] object-contain rounded-lg border shadow-sm"
                  />
                  <div className="text-sm text-muted-foreground text-center">
                    <p>{receiptViewEntry.date} • {currencySymbol}{receiptViewEntry.amount.toLocaleString()}</p>
                    <p>{receiptViewEntry.category} • {receiptViewEntry.paymentMethod}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  Loading receipt...
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && receiptViewEntry) {
                      handleAttachReceipt(receiptViewEntry.id, file);
                    }
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Camera className="h-4 w-4 mr-2" />
                    Replace Receipt
                  </span>
                </Button>
              </label>
              {receiptViewEntry.receiptId && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    if (receiptViewEntry.receiptId) {
                      handleRemoveReceipt(receiptViewEntry.id, receiptViewEntry.receiptId);
                      setReceiptViewEntry(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
