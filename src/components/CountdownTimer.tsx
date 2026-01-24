import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  X, Play, Pause, RotateCcw, Plus, Trash2, 
  Clock, Bell, BellOff, Edit2, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { format, differenceInSeconds, addDays, addHours, addMinutes, addWeeks } from 'date-fns';
import { ClockTimePicker } from './ClockTimePicker';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface CountdownItem {
  id: string;
  name: string;
  targetDate: Date;
  notifyOnComplete: boolean;
  isActive: boolean;
  createdAt: Date;
}

interface CountdownTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuickDuration = '5m' | '15m' | '30m' | '1h' | '2h' | '1d' | '1w';

export const CountdownTimer = ({ isOpen, onClose }: CountdownTimerProps) => {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCountdownName, setNewCountdownName] = useState('');
  const [newCountdownDate, setNewCountdownDate] = useState('');
  const [newCountdownHour, setNewCountdownHour] = useState('12');
  const [newCountdownMinute, setNewCountdownMinute] = useState('00');
  const [newCountdownPeriod, setNewCountdownPeriod] = useState<'AM' | 'PM'>('AM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newNotify, setNewNotify] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load countdowns from IndexedDB
  useEffect(() => {
    getSetting<any[]>('countdowns', []).then(saved => {
      const hydrated = saved.map((c: any) => ({
        ...c,
        targetDate: new Date(c.targetDate),
        createdAt: new Date(c.createdAt),
      }));
      setCountdowns(hydrated);
      setIsLoaded(true);
    });
  }, []);

  // Save countdowns to IndexedDB
  useEffect(() => {
    if (isLoaded) {
      setSetting('countdowns', countdowns);
    }
  }, [countdowns, isLoaded]);

  // Update current time every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Check for completed countdowns
  useEffect(() => {
    countdowns.forEach(countdown => {
      if (countdown.isActive && new Date(countdown.targetDate) <= currentTime) {
        if (countdown.notifyOnComplete) {
          toast.success(`Countdown complete: ${countdown.name}!`);
          try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
        }
        setCountdowns(prev => prev.map(c => 
          c.id === countdown.id ? { ...c, isActive: false } : c
        ));
      }
    });
  }, [currentTime, countdowns]);

  const getTimeDisplay = () => {
    if (newCountdownHour && newCountdownMinute) {
      return `${newCountdownHour}:${newCountdownMinute} ${newCountdownPeriod}`;
    }
    return 'Set time';
  };

  const addCountdown = async () => {
    if (!newCountdownName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    if (!newCountdownDate && (!newCountdownHour || !newCountdownMinute)) {
      toast.error('Please set a date or time');
      return;
    }

    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}

    let targetDate: Date;
    
    if (newCountdownDate) {
      const [year, month, day] = newCountdownDate.split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
      
      if (newCountdownHour && newCountdownMinute) {
        let hours = parseInt(newCountdownHour);
        if (newCountdownPeriod === 'PM' && hours !== 12) hours += 12;
        if (newCountdownPeriod === 'AM' && hours === 12) hours = 0;
        targetDate.setHours(hours, parseInt(newCountdownMinute), 0, 0);
      }
    } else {
      targetDate = new Date();
      let hours = parseInt(newCountdownHour);
      if (newCountdownPeriod === 'PM' && hours !== 12) hours += 12;
      if (newCountdownPeriod === 'AM' && hours === 12) hours = 0;
      targetDate.setHours(hours, parseInt(newCountdownMinute), 0, 0);
      
      if (targetDate <= new Date()) {
        targetDate = addDays(targetDate, 1);
      }
    }

    const newItem: CountdownItem = {
      id: Date.now().toString(),
      name: newCountdownName.trim(),
      targetDate,
      notifyOnComplete: newNotify,
      isActive: true,
      createdAt: new Date(),
    };

    setCountdowns(prev => [...prev, newItem]);
    setNewCountdownName('');
    setNewCountdownDate('');
    setNewCountdownHour('12');
    setNewCountdownMinute('00');
    setNewCountdownPeriod('AM');
    setShowAddForm(false);
    toast.success('Countdown created');
  };

  const addQuickCountdown = async (name: string, duration: QuickDuration) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}

    let targetDate: Date;
    switch (duration) {
      case '5m': targetDate = addMinutes(new Date(), 5); break;
      case '15m': targetDate = addMinutes(new Date(), 15); break;
      case '30m': targetDate = addMinutes(new Date(), 30); break;
      case '1h': targetDate = addHours(new Date(), 1); break;
      case '2h': targetDate = addHours(new Date(), 2); break;
      case '1d': targetDate = addDays(new Date(), 1); break;
      case '1w': targetDate = addWeeks(new Date(), 1); break;
    }

    const newItem: CountdownItem = {
      id: Date.now().toString(),
      name,
      targetDate,
      notifyOnComplete: true,
      isActive: true,
      createdAt: new Date(),
    };

    setCountdowns(prev => [...prev, newItem]);
    toast.success(`${name} countdown started`);
  };

  const deleteCountdown = async (id: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    setCountdowns(prev => prev.filter(c => c.id !== id));
    toast.success('Countdown deleted');
  };

  const toggleNotify = async (id: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    setCountdowns(prev => prev.map(c => 
      c.id === id ? { ...c, notifyOnComplete: !c.notifyOnComplete } : c
    ));
  };

  const restartCountdown = async (id: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    const countdown = countdowns.find(c => c.id === id);
    if (countdown) {
      const originalDuration = differenceInSeconds(
        new Date(countdown.targetDate),
        new Date(countdown.createdAt)
      );
      const newTargetDate = addMinutes(new Date(), Math.ceil(originalDuration / 60));
      
      setCountdowns(prev => prev.map(c => 
        c.id === id ? { ...c, targetDate: newTargetDate, isActive: true, createdAt: new Date() } : c
      ));
      toast.success('Countdown restarted');
    }
  };

  const saveEditName = async (id: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    if (editName.trim()) {
      setCountdowns(prev => prev.map(c => 
        c.id === id ? { ...c, name: editName.trim() } : c
      ));
    }
    setEditingId(null);
    setEditName('');
  };

  const formatCountdown = (targetDate: Date) => {
    const now = currentTime;
    const target = new Date(targetDate);
    const diffSeconds = Math.max(0, differenceInSeconds(target, now));
    
    if (diffSeconds === 0) return { text: 'Complete!', isComplete: true };

    const days = Math.floor(diffSeconds / 86400);
    const hours = Math.floor((diffSeconds % 86400) / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (days > 0) {
      return { 
        text: `${days}d ${hours}h ${minutes}m`,
        isComplete: false,
      };
    } else if (hours > 0) {
      return { 
        text: `${hours}h ${minutes}m ${seconds}s`,
        isComplete: false,
      };
    } else {
      return { 
        text: `${minutes}m ${seconds}s`,
        isComplete: false,
      };
    }
  };

  const activeCountdowns = countdowns.filter(c => c.isActive);
  const completedCountdowns = countdowns.filter(c => !c.isActive);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Countdown Timer</h2>
            <p className="text-xs text-muted-foreground">Track important deadlines</p>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "secondary" : "default"}
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Quick Countdowns */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Quick Start</h4>
            <div className="flex flex-wrap gap-2">
              {([
                { label: '5 min', duration: '5m' as QuickDuration },
                { label: '15 min', duration: '15m' as QuickDuration },
                { label: '30 min', duration: '30m' as QuickDuration },
                { label: '1 hour', duration: '1h' as QuickDuration },
                { label: '2 hours', duration: '2h' as QuickDuration },
              ]).map(({ label, duration }) => (
                <Button
                  key={duration}
                  variant="outline"
                  size="sm"
                  onClick={() => addQuickCountdown(label, duration)}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-4 animate-in slide-in-from-top">
              <h4 className="font-medium">New Countdown</h4>
              
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newCountdownName}
                  onChange={(e) => setNewCountdownName(e.target.value)}
                  placeholder="e.g., Project deadline"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newCountdownDate}
                    onChange={(e) => setNewCountdownDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time (optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    onClick={() => setShowTimePicker(true)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {getTimeDisplay()}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notify when complete
                </Label>
                <Switch
                  checked={newNotify}
                  onCheckedChange={setNewNotify}
                />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={addCountdown}>
                  Create Countdown
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Active Countdowns */}
          {activeCountdowns.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Active ({activeCountdowns.length})
              </h4>
              
              {activeCountdowns.map(countdown => {
                const { text, isComplete } = formatCountdown(countdown.targetDate);
                
                return (
                  <div 
                    key={countdown.id}
                    className="bg-card border rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingId === countdown.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={() => saveEditName(countdown.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold">{countdown.name}</h5>
                            <button 
                              onClick={() => {
                                setEditingId(countdown.id);
                                setEditName(countdown.name);
                              }}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(countdown.targetDate), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleNotify(countdown.id)}
                          className={cn(
                            "p-1.5 rounded",
                            countdown.notifyOnComplete ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {countdown.notifyOnComplete ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <BellOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteCountdown(countdown.id)}
                          className="p-1.5 rounded text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className={cn(
                      "text-3xl font-bold text-center py-2 rounded-lg",
                      isComplete ? "text-green-500 bg-green-50 dark:bg-green-950/30" : "text-primary"
                    )}>
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Countdowns */}
          {completedCountdowns.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Completed ({completedCountdowns.length})
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCountdowns(prev => prev.filter(c => c.isActive))}
                >
                  Clear All
                </Button>
              </div>
              
              <ScrollArea className="h-[200px]">
                {completedCountdowns.map(countdown => (
                  <div 
                    key={countdown.id}
                    className="flex items-center justify-between py-3 px-3 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{countdown.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Completed {format(new Date(countdown.targetDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => restartCountdown(countdown.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteCountdown(countdown.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {countdowns.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="font-medium mb-2">No countdowns yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create a countdown to track important deadlines
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Countdown
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Clock Time Picker Dialog */}
      <Dialog open={showTimePicker} onOpenChange={setShowTimePicker}>
        <DialogContent className="max-w-sm">
          <ClockTimePicker
            hour={newCountdownHour}
            minute={newCountdownMinute}
            period={newCountdownPeriod}
            onHourChange={setNewCountdownHour}
            onMinuteChange={setNewCountdownMinute}
            onPeriodChange={setNewCountdownPeriod}
            onConfirm={() => setShowTimePicker(false)}
            showConfirmButton={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CountdownTimer;
