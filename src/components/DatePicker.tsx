import { useState, useRef, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface DatePickerProps {
  name: string;
  defaultValue?: string; // YYYY-MM-DD
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const DAYS_OF_WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function DatePicker({ name, defaultValue, required, placeholder = 'Selecione uma data...', className }: DatePickerProps) {
  const parseDefault = (): Date | null => {
    if (!defaultValue) return null;
    const [y, m, d] = defaultValue.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  };

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(parseDefault);
  const [viewDate, setViewDate] = useState<Date>(parseDefault() ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = getDaysInMonth(viewDate);
  const firstDayRaw = getDay(startOfMonth(viewDate)); // 0=Sun
  const startOffset = (firstDayRaw + 6) % 7; // convert to Mon=0

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12);
    setSelectedDate(newDate);
    setViewDate(newDate);
    setIsOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(null);
  };

  const valueForInput = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const displayValue = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : '';

  const today = new Date();

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <input type="hidden" name={name} value={valueForInput} required={required} />

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm text-left flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className={displayValue ? 'text-white' : 'text-white/30 text-sm'}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selectedDate && (
            <span
              onClick={clear}
              className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-xs px-1"
              title="Limpar"
            >
              ×
            </span>
          )}
          <Calendar className="h-4 w-4 text-white/40" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl p-4 w-72 left-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-white capitalize">
              {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-white/30 py-1">
                {d.charAt(0)}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const isSelected =
                selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === viewDate.getMonth() &&
                selectedDate.getFullYear() === viewDate.getFullYear();
              const isToday =
                today.getDate() === day &&
                today.getMonth() === viewDate.getMonth() &&
                today.getFullYear() === viewDate.getFullYear();

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={clsx(
                    'h-8 w-8 rounded-lg text-xs font-medium transition-colors mx-auto flex items-center justify-center',
                    isSelected
                      ? 'bg-[#8151D1] text-white font-bold'
                      : isToday
                      ? 'border border-[#8151D1]/60 text-[#8151D1] font-bold'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => { setViewDate(today); handleDayClick(today.getDate()); }}
              className="text-xs font-bold text-[#8151D1] hover:text-[#D0C8E3] transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
