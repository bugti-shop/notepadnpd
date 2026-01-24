import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, getWeek, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Note } from "@/types/note";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotesCalendarViewProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  highlightedDates?: Date[];
  taskDates?: Date[];
  eventDates?: Date[];
  systemCalendarDates?: Date[];
  showWeekNumbers?: boolean;
}

export const NotesCalendarView = ({
  selectedDate,
  onDateSelect,
  highlightedDates,
  taskDates = [],
  eventDates = [],
  systemCalendarDates = [],
  showWeekNumbers: initialShowWeekNumbers = false,
}: NotesCalendarViewProps) => {
  const today = new Date();
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [noteDates, setNoteDates] = useState<Date[]>([]);
  const [showWeekNumbers, setShowWeekNumbers] = useState(initialShowWeekNumbers);

  useEffect(() => {
    // If highlightedDates prop is provided, use it instead of loading notes
    if (highlightedDates) {
      setNoteDates(highlightedDates);
      return;
    }

    // Load notes from IndexedDB and extract dates
    const loadNotes = async () => {
      const { loadNotesFromDB } = await import('@/utils/noteStorage');
      const notes = await loadNotesFromDB();
      const dates = notes.map(note => new Date(note.createdAt));
      setNoteDates(dates);
    };

    loadNotes();

    // Listen for notes updates
    const handleNotesUpdate = () => loadNotes();
    window.addEventListener('notesUpdated', handleNotesUpdate);

    return () => window.removeEventListener('notesUpdated', handleNotesUpdate);
  }, [highlightedDates]);

  // Calculate display month
  const startingMonth = startOfMonth(today);
  const displayMonth = addMonths(startingMonth, currentMonthOffset);
  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = getDay(monthStart);
  const weekDays = showWeekNumbers ? ["Wk", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Calculate weeks for week numbers
  const weeksInMonth = useMemo(() => {
    const weeks: { weekNumber: number; days: (Date | null)[] }[] = [];
    let currentWeek: (Date | null)[] = Array(startPadding).fill(null);
    
    daysInMonth.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        const firstDayOfWeek = currentWeek.find(d => d !== null);
        weeks.push({
          weekNumber: firstDayOfWeek ? getWeek(firstDayOfWeek) : 0,
          days: currentWeek,
        });
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      const firstDayOfWeek = currentWeek.find(d => d !== null);
      weeks.push({
        weekNumber: firstDayOfWeek ? getWeek(firstDayOfWeek) : 0,
        days: currentWeek,
      });
    }
    
    return weeks;
  }, [daysInMonth, startPadding]);

  const hasNote = (date: Date) => noteDates.some((nDate) => isSameDay(nDate, date));
  const hasTask = (date: Date) => taskDates.some((tDate) => isSameDay(tDate, date));
  const hasEvent = (date: Date) => eventDates.some((eDate) => isSameDay(eDate, date));
  const hasSystemCalendarEvent = (date: Date) => systemCalendarDates.some((sDate) => isSameDay(sDate, date));

  const handlePrevMonth = () => {
    setCurrentMonthOffset(prev => prev - 1);
  };

  const handleNextMonth = () => {
    setCurrentMonthOffset(prev => prev + 1);
  };

  return (
    <div className="p-6 bg-background">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-accent rounded-full transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>

        <h3 className="text-base font-normal text-foreground text-center">
          {format(displayMonth, "MMMM yyyy")}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-accent rounded-full transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Week numbers toggle */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <Label htmlFor="week-numbers" className="text-xs text-muted-foreground">Week #</Label>
        <Switch 
          id="week-numbers" 
          checked={showWeekNumbers} 
          onCheckedChange={setShowWeekNumbers}
          className="scale-75"
        />
      </div>

      <div className={cn("grid gap-2 mb-3", showWeekNumbers ? "grid-cols-8" : "grid-cols-7")}>
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-normal text-muted-foreground h-8 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {weeksInMonth.map((week, weekIndex) => (
          <div key={weekIndex} className={cn("grid gap-2", showWeekNumbers ? "grid-cols-8" : "grid-cols-7")}>
            {showWeekNumbers && (
              <div className="aspect-square w-full flex items-center justify-center text-xs font-medium text-muted-foreground bg-muted/30 rounded-lg">
                {week.weekNumber}
              </div>
            )}
            {week.days.map((day, dayIndex) => {
              if (!day) {
                return <div key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square" />;
              }

              const hasNoteOnDay = hasNote(day);
              const hasTaskOnDay = hasTask(day);
              const hasEventOnDay = hasEvent(day);
              const hasSystemEventOnDay = hasSystemCalendarEvent(day);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              let bgClass = "bg-transparent text-foreground hover:bg-muted";
              let bgStyle = {};

              if (isSelected) {
                bgClass = "text-foreground hover:opacity-90";
                bgStyle = { backgroundColor: "#a3dbf6" };
              } else if (hasNoteOnDay && !hasTaskOnDay && !hasEventOnDay && !hasSystemEventOnDay) {
                bgClass = "text-white hover:opacity-90";
                bgStyle = { backgroundColor: "#3a99dd" };
              }

              return (
                <button
                  key={day.toString()}
                  onClick={() => onDateSelect?.(day)}
                  style={bgStyle}
                  className={cn(
                    "aspect-square w-full flex flex-col items-center justify-center rounded-lg text-xs font-normal transition-all focus:outline-none relative",
                    bgClass,
                    isToday && !hasNoteOnDay && !isSelected ? "ring-2 ring-primary" : "",
                    "cursor-pointer"
                  )}
                >
                  <span>{format(day, "d")}</span>
                  {/* Colored dots for tasks, events, and system calendar */}
                  {(hasTaskOnDay || hasEventOnDay || hasSystemEventOnDay) && (
                    <div className="flex gap-0.5 mt-0.5 absolute bottom-1">
                      {hasTaskOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="NPD Task" />
                      )}
                      {hasEventOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="NPD Event" />
                      )}
                      {hasSystemEventOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Device Calendar" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {(taskDates.length > 0 || eventDates.length > 0 || systemCalendarDates.length > 0) && (
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
          {taskDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Tasks</span>
            </div>
          )}
          {eventDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Events</span>
            </div>
          )}
          {systemCalendarDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Device</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
