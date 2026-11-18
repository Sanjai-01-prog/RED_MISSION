import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  FULL_WEEKDAYS,
  formatDisplayDate,
  calculateWeekday,
  calculateAgeFromDob
} from '../../utils/calendarUtils.js';

export {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  FULL_WEEKDAYS,
  formatDisplayDate,
  calculateWeekday,
  calculateAgeFromDob
};

export default function CalendarDatePicker({
  value = '',
  onChange,
  min,
  max,
  label,
  placeholder = 'Select date',
  id,
  name,
  mode = 'date', // 'date' | 'dob' | 'datetime'
  showWeekday = true,
  disabled = false,
  required = false,
  className = '',
  align = 'left' // 'left' | 'right'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Extract date and time parts
  const datePart = value ? String(value).split('T')[0] : '';
  const timePart = value && String(value).includes('T') ? String(value).split('T')[1].substring(0, 5) : '10:00';

  const [selectedTime, setSelectedTime] = useState(timePart);

  // Parse initial view year and month
  const getInitialView = () => {
    if (datePart) {
      const p = datePart.split('-');
      if (p.length === 3) {
        return { year: parseInt(p[0], 10), month: parseInt(p[1], 10) - 1 };
      }
    }
    const today = new Date();
    // Default DOB view to 20 years ago for convenience
    if (mode === 'dob') {
      return { year: today.getFullYear() - 22, month: 0 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  };

  const [viewYear, setViewYear] = useState(getInitialView().year);
  const [viewMonth, setViewMonth] = useState(getInitialView().month);

  // Keep view aligned when value changes externally
  useEffect(() => {
    if (datePart) {
      const p = datePart.split('-');
      if (p.length === 3) {
        setViewYear(parseInt(p[0], 10));
        setViewMonth(parseInt(p[1], 10) - 1);
      }
    }
  }, [datePart]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Min and max limits
  const minYear = min ? parseInt(min.split('-')[0], 10) : (mode === 'dob' ? 1930 : 2020);
  const maxYear = max ? parseInt(max.split('-')[0], 10) : (mode === 'dob' ? new Date().getFullYear() : 2035);

  const years = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  // Days in month calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const paddingDays = firstDayOfWeek;

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(v => v - 1);
    } else {
      setViewMonth(v => v - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(v => v + 1);
    } else {
      setViewMonth(v => v + 1);
    }
  };

  const handleSelectDay = (day) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (isDateDisabled(newDateStr)) return;

    let finalValue = newDateStr;
    if (mode === 'datetime') {
      finalValue = `${newDateStr}T${selectedTime || '10:00'}`;
    }

    const calculatedWeekday = calculateWeekday(newDateStr);
    const calculatedAge = mode === 'dob' ? calculateAgeFromDob(newDateStr) : null;

    if (onChange) {
      onChange(finalValue, {
        date: newDateStr,
        weekday: calculatedWeekday,
        age: calculatedAge,
        time: selectedTime
      });
    }

    if (mode !== 'datetime') {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (newTime) => {
    setSelectedTime(newTime);
    if (datePart && onChange) {
      const finalValue = `${datePart}T${newTime}`;
      onChange(finalValue, {
        date: datePart,
        weekday: calculateWeekday(datePart),
        age: mode === 'dob' ? calculateAgeFromDob(datePart) : null,
        time: newTime
      });
    }
  };

  const isDateDisabled = (dateStr) => {
    if (min && dateStr < min.split('T')[0]) return true;
    if (max && dateStr > max.split('T')[0]) return true;
    return false;
  };

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === viewYear &&
           today.getMonth() === viewMonth &&
           today.getDate() === day;
  };

  const isSelected = (day) => {
    if (!datePart) return false;
    const p = datePart.split('-');
    return parseInt(p[0], 10) === viewYear &&
           parseInt(p[1], 10) - 1 === viewMonth &&
           parseInt(p[2], 10) === day;
  };

  const calculatedAge = mode === 'dob' && datePart ? calculateAgeFromDob(datePart) : null;
  const weekdayDisplay = showWeekday && datePart ? calculateWeekday(datePart) : '';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-mono uppercase text-slate-300 mb-1.5 flex items-center justify-between">
          <span>{label} {required && <span className="text-mars-400">*</span>}</span>
          {mode === 'dob' && calculatedAge !== null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              calculatedAge >= 18 && calculatedAge <= 65
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {calculatedAge === -1 ? 'Future Date' : `Age: ${calculatedAge} Yrs ${calculatedAge >= 18 && calculatedAge <= 65 ? '(Eligible)' : '(Ineligible)'}`}
            </span>
          )}
        </label>
      )}

      {/* Trigger Input Button */}
      <div
        id={id}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-space-900 border text-xs font-mono transition-all flex items-center justify-between cursor-pointer select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-white/5 text-slate-500'
            : isOpen
            ? 'border-mars-500 ring-2 ring-mars-500/20 text-white'
            : 'border-white/10 hover:border-white/20 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-mars-400 shrink-0" />
          <span className={`truncate ${datePart ? 'text-white font-medium' : 'text-slate-500'}`}>
            {datePart ? formatDisplayDate(datePart) : placeholder}
          </span>
          {weekdayDisplay && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/5 text-slate-300 text-[10px] border border-white/10 shrink-0">
              {weekdayDisplay}
            </span>
          )}
          {mode === 'datetime' && timePart && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-mars-400 bg-mars-500/10 px-2 py-0.5 rounded-md border border-mars-500/20">
              <Clock className="w-3 h-3" />
              {timePart}
            </span>
          )}
        </div>

        {datePart && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onChange) onChange('', { date: '', weekday: '', age: null });
            }}
            className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hidden input for native form compatibility */}
      <input
        type="hidden"
        name={name || id}
        value={value}
        required={required}
      />

      {/* Popover / Mobile Sheet */}
      {isOpen && (
        <div className="fixed inset-0 sm:absolute sm:inset-auto sm:top-full sm:mt-2 z-50 flex items-end sm:items-start justify-center sm:justify-start">
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-space-950/80 backdrop-blur-xs sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Calendar Card */}
          <div className={`relative w-full sm:w-80 rounded-t-3xl sm:rounded-2xl bg-space-900 border border-white/15 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200 text-white ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          }`}>

            {/* Header / Month-Year Selector */}
            <div className="flex items-center justify-between gap-1 pb-3 mb-3 border-b border-white/10">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {/* Month Dropdown */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                  className="bg-space-800 border border-white/10 text-white text-xs font-mono rounded-lg px-2 py-1 outline-none focus:border-mars-500 cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx} className="bg-space-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                  className="bg-space-800 border border-white/10 text-white text-xs font-mono rounded-lg px-2 py-1 outline-none focus:border-mars-500 cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y} className="bg-space-900 text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-slate-400 mb-2">
              {WEEKDAY_NAMES.map(d => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
              {/* Previous month padding days */}
              {Array.from({ length: paddingDays }).map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className="py-2 text-slate-600 select-none text-[11px]"
                >
                  {prevMonthDays - paddingDays + i + 1}
                </div>
              ))}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const formattedMonth = String(viewMonth + 1).padStart(2, '0');
                const formattedDay = String(day).padStart(2, '0');
                const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
                const disabled = isDateDisabled(dateStr);
                const selected = isSelected(day);
                const today = isToday(day);

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectDay(day)}
                    className={`py-2 rounded-lg text-center transition-all cursor-pointer font-medium relative ${
                      selected
                        ? 'bg-mars-500 text-white font-bold shadow-md shadow-mars-500/40 ring-1 ring-mars-400'
                        : today
                        ? 'border border-mars-400 text-mars-400 hover:bg-mars-500/20'
                        : disabled
                        ? 'text-slate-600 cursor-not-allowed opacity-40'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Selector (for datetime mode) */}
            {mode === 'datetime' && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-mars-400" />
                  Time:
                </span>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="bg-space-800 border border-white/10 text-white px-2 py-1 rounded-lg text-xs outline-none focus:border-mars-500"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 rounded-lg bg-mars-500 text-white text-xs font-bold hover:bg-mars-600 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {/* Footer Information */}
            {datePart && (
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Selected: <strong className="text-white">{calculateWeekday(datePart)}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-mars-400 hover:text-mars-300 font-bold sm:hidden"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Slide/Scroll Day Selector for recurring weekly availability.
 */
export function RecurringDaySelector({
  selectedDays = [],
  onChange,
  className = ''
}) {
  const days = [
    { key: 'MON', label: 'Monday', short: 'Mon' },
    { key: 'TUE', label: 'Tuesday', short: 'Tue' },
    { key: 'WED', label: 'Wednesday', short: 'Wed' },
    { key: 'THU', label: 'Thursday', short: 'Thu' },
    { key: 'FRI', label: 'Friday', short: 'Fri' },
    { key: 'SAT', label: 'Saturday', short: 'Sat' },
    { key: 'SUN', label: 'Sunday', short: 'Sun' }
  ];

  const handleToggle = (key) => {
    let next;
    if (selectedDays.includes(key)) {
      next = selectedDays.filter(d => d !== key);
    } else {
      next = [...selectedDays, key];
    }
    if (onChange) onChange(next);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 uppercase">
        <span>Recurring Availability Days</span>
        <span className="text-[10px] text-slate-400">Slide / Scroll</span>
      </div>
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 flex gap-2 no-scrollbar">
        {days.map(d => {
          const active = selectedDays.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => handleToggle(d.key)}
              className={`px-3 py-2 rounded-xl text-xs font-mono shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                active
                  ? 'bg-mars-500 text-white font-bold border-mars-400 shadow-md shadow-mars-500/30'
                  : 'bg-space-850/80 text-slate-300 border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {active && <Check className="w-3.5 h-3.5" />}
              <span>{d.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
