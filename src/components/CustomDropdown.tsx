import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Square, CheckSquare } from 'lucide-react';

export interface OptionItem {
  value: string;
  label: string;
  count?: number;
  badgeColor?: string;
}

interface CustomDropdownProps {
  label?: string;
  icon?: React.ReactNode;
  options: OptionItem[];
  value?: string;
  onChange?: (val: string) => void;
  isMulti?: boolean;
  selectedValues?: string[];
  onMultiChange?: (vals: string[]) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  activeHighlightColor?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  icon,
  options,
  value,
  onChange,
  isMulti = false,
  selectedValues = ['All'],
  onMultiChange,
  placeholder = 'Select option...',
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine button text and active state
  let isFilterActive = false;
  let displayLabel = placeholder;

  if (isMulti) {
    const activeValues = (selectedValues || []).filter((v) => v !== 'All' && v !== 'all');
    if (activeValues.length === 0) {
      const allOpt = options.find((opt) => opt.value === 'All' || opt.value === 'all');
      displayLabel = allOpt ? allOpt.label : `All ${label || ''}s`.trim();
      isFilterActive = false;
    } else if (activeValues.length === 1) {
      const singleOpt = options.find((opt) => opt.value === activeValues[0]);
      displayLabel = singleOpt ? singleOpt.label : activeValues[0];
      isFilterActive = true;
    } else {
      displayLabel = `${activeValues.length} Selected`;
      isFilterActive = true;
    }
  } else {
    const selectedOption = options.find((opt) => opt.value === value) || {
      value: value || '',
      label: value || placeholder,
    };
    displayLabel = selectedOption.label;
    isFilterActive = Boolean(value && value !== 'All' && value !== 'all');
  }

  const handleMultiToggle = (optValue: string) => {
    if (!onMultiChange) return;

    if (optValue === 'All' || optValue === 'all') {
      onMultiChange(['All']);
      return;
    }

    let current = (selectedValues || []).filter((v) => v !== 'All' && v !== 'all');
    if (current.includes(optValue)) {
      current = current.filter((v) => v !== optValue);
    } else {
      current = [...current, optValue];
    }

    if (current.length === 0) {
      onMultiChange(['All']);
    } else {
      onMultiChange(current);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none ${
          isOpen
            ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
            : isFilterActive
            ? 'bg-blue-50/90 border-blue-400 text-blue-900 shadow-2xs font-extrabold'
            : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
          {label && <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider shrink-0">{label}:</span>}
          <span className="truncate text-slate-900 font-bold">{displayLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMulti && isFilterActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
              {(selectedValues || []).filter((v) => v !== 'All' && v !== 'all').length}
            </span>
          )}

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 w-full min-w-[220px] max-w-sm rounded-xl bg-white border border-slate-200 shadow-xl z-50 py-1.5 text-xs text-slate-800 max-h-72 overflow-y-auto animate-fadeIn`}
        >
          {isMulti && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Select Multiple {label || 'Options'}</span>
              {(selectedValues || []).some((v) => v !== 'All' && v !== 'all') && (
                <button
                  type="button"
                  onClick={() => onMultiChange?.(['All'])}
                  className="text-blue-600 hover:underline font-bold text-[10px]"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}

          {options.map((opt) => {
            let isSelected = false;
            if (isMulti) {
              if (opt.value === 'All' || opt.value === 'all') {
                isSelected =
                  !selectedValues ||
                  selectedValues.length === 0 ||
                  selectedValues.includes('All') ||
                  selectedValues.includes('all');
              } else {
                isSelected = (selectedValues || []).includes(opt.value);
              }
            } else {
              isSelected = opt.value === value;
            }

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (isMulti) {
                    handleMultiToggle(opt.value);
                  } else {
                    onChange?.(opt.value);
                    setIsOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left font-medium transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isMulti && (
                    <div className="shrink-0 text-blue-600">
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                    </div>
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {opt.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {opt.count}
                    </span>
                  )}
                  {!isMulti && isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
