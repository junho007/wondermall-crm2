import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { DatePreset } from '../types';

interface CustomDatePickerProps {
  startDate: string | null;
  endDate: string | null;
  datePreset: DatePreset;
  onChangeStartDate: (date: string | null) => void;
  onChangeEndDate: (date: string | null) => void;
  onSelectPreset: (preset: DatePreset) => void;
  theme?: 'dark' | 'light';
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  startDate,
  endDate,
  datePreset,
  onChangeStartDate,
  onChangeEndDate,
  onSelectPreset,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active view month/year for the calendar grid
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Selection state while picking range
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Days in current view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay();

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Format YYYY-MM-DD
  const formatYMD = (year: number, monthZeroIndexed: number, day: number): string => {
    const m = String(monthZeroIndexed + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleDayClick = (dayNumber: number) => {
    const selectedYMD = formatYMD(viewYear, viewMonth, dayNumber);

    if (selectingStep === 'start' || !startDate || (startDate && endDate)) {
      onChangeStartDate(selectedYMD);
      onChangeEndDate(null);
      onSelectPreset('custom');
      setSelectingStep('end');
    } else {
      // Step 2: end date
      if (new Date(selectedYMD) < new Date(startDate)) {
        // Swap if end date is before start date
        onChangeEndDate(startDate);
        onChangeStartDate(selectedYMD);
      } else {
        onChangeEndDate(selectedYMD);
      }
      onSelectPreset('custom');
      setSelectingStep('start');
    }
  };

  // Helper to test if a day is in range
  const isDateSelected = (dayNumber: number): boolean => {
    const ymd = formatYMD(viewYear, viewMonth, dayNumber);
    return ymd === startDate || ymd === endDate;
  };

  const isDateInRange = (dayNumber: number): boolean => {
    if (!startDate || !endDate) return false;
    const ymd = formatYMD(viewYear, viewMonth, dayNumber);
    return ymd > startDate && ymd < endDate;
  };

  // Display label for button trigger
  const getTriggerLabel = () => {
    if (datePreset === 'all' && !startDate && !endDate) return 'All Time (No Filter)';
    if (datePreset === 'today') return 'Today';
    if (datePreset === 'yesterday') return 'Yesterday';
    if (datePreset === 'last7') return 'Last 7 Days';
    if (datePreset === 'last30') return 'Last 30 Days';
    if (datePreset === 'thisMonth') return 'This Month';

    if (startDate && endDate) return `${startDate} → ${endDate}`;
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Until ${endDate}`;

    return 'Select Date Range';
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
          isOpen
            ? isLight
              ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm'
              : 'bg-blue-950/60 border-blue-500 text-white shadow-md'
            : isLight
            ? 'bg-white border-zinc-300 hover:border-blue-500 text-slate-800'
            : 'bg-[#181818] border-zinc-800 hover:border-blue-500/50 text-zinc-200'
        }`}
      >
        <CalendarIcon className="w-4 h-4 text-blue-600" />
        <span className="font-mono font-bold">{getTriggerLabel()}</span>
        {datePreset !== 'all' && (
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
        )}
      </button>

      {/* Custom Styled Popover Calendar */}
      {isOpen && (
        <div
          className={`absolute left-0 mt-2 z-50 w-80 sm:w-88 p-4 rounded-2xl border shadow-2xl animate-fadeIn ${
            isLight
              ? 'bg-white border-zinc-200 text-slate-900 shadow-blue-900/10'
              : 'bg-[#121212] border-blue-500/40 text-zinc-100 shadow-black/80'
          }`}
        >
          {/* Quick Preset Buttons Header */}
          <div className="space-y-2 mb-3 pb-3 border-b border-zinc-800/40">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Quick Filter Presets
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectPreset('all');
                  onChangeStartDate(null);
                  onChangeEndDate(null);
                }}
                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Date Filter
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'all' as DatePreset, label: 'All Time' },
                { id: 'today' as DatePreset, label: 'Today' },
                { id: 'yesterday' as DatePreset, label: 'Yesterday' },
                { id: 'last7' as DatePreset, label: 'Last 7 Days' },
                { id: 'last30' as DatePreset, label: '30 Days' },
                { id: 'thisMonth' as DatePreset, label: 'This Month' },
              ].map((p) => {
                const isSelected = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(p.id);
                      if (p.id === 'all') {
                        onChangeStartDate(null);
                        onChangeEndDate(null);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : isLight
                        ? 'bg-slate-100 border-zinc-200 hover:bg-blue-50 text-slate-700'
                        : 'bg-[#1e1e1e] border-zinc-800 hover:bg-[#282828] text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month Header Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className={`p-1.5 rounded-lg border transition-colors ${
                isLight ? 'hover:bg-slate-100 border-zinc-200' : 'hover:bg-[#222] border-zinc-800'
              }`}
            >
              <ChevronLeft className="w-4 h-4 text-blue-600" />
            </button>

            <span className="text-xs font-black tracking-tight">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className={`p-1.5 rounded-lg border transition-colors ${
                isLight ? 'hover:bg-slate-100 border-zinc-200' : 'hover:bg-[#222] border-zinc-800'
              }`}
            >
              <ChevronRight className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d} className={`text-[10px] font-extrabold uppercase ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                {d}
              </span>
            ))}
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank leading offsets */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="h-8" />
            ))}

            {/* Day numbers */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = isDateSelected(dayNum);
              const isInRange = isDateInRange(dayNum);

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleDayClick(dayNum)}
                  className={`h-8 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md font-black scale-105'
                      : isInRange
                      ? isLight
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : 'bg-blue-900/40 text-blue-200 border border-blue-500/30'
                      : isLight
                      ? 'hover:bg-blue-50 text-slate-800'
                      : 'hover:bg-[#222222] text-zinc-300'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Active Range Summary Footer */}
          <div className={`mt-3 pt-3 border-t flex items-center justify-between text-[11px] font-mono ${
            isLight ? 'border-zinc-200 text-slate-600' : 'border-zinc-800 text-zinc-400'
          }`}>
            <div>
              <span className="font-bold text-blue-600">
                {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : 'Pick date range'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs shadow-sm cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
