import React from 'react';
import { Columns, Eye, EyeOff } from 'lucide-react';
import { ColumnDefinition } from '../types';

interface ColumnToggleBarProps {
  columns: ColumnDefinition[];
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  theme?: 'dark' | 'light';
}

export const ColumnToggleBar: React.FC<ColumnToggleBarProps> = ({
  columns,
  onToggleColumn,
  onResetColumns,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`w-full rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs sm:text-sm border ${
      isLight ? 'bg-white border-zinc-200 text-slate-900' : 'glass-card border-[#E9CE79]/20 text-zinc-100 shadow-lg'
    }`}>
      <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1.5 sm:pb-0 scrollbar-none">
        <span className={`font-bold flex items-center gap-1.5 uppercase tracking-wider text-xs shrink-0 ${
          isLight ? 'text-slate-700' : 'text-zinc-300'
        }`}>
          <Columns className="w-3.5 h-3.5 text-[#a68212]" />
          <span>Toggle Columns:</span>
        </span>

        {columns.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => onToggleColumn(col.key)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
              col.visible
                ? isLight
                  ? 'bg-amber-100/90 text-[#7a5e0b] border-amber-300 hover:bg-amber-200/80 font-black'
                  : 'bg-[#E9CE79]/15 text-[#E9CE79] border-[#E9CE79]/40 hover:bg-[#E9CE79]/25 shadow-sm'
                : isLight
                ? 'bg-slate-100 text-slate-400 border-zinc-200 line-through opacity-60 hover:opacity-100'
                : 'bg-[#0a0a0a] text-zinc-500 border-zinc-800 line-through opacity-60 hover:opacity-100'
            }`}
          >
            {col.visible ? (
              <Eye className="w-3.5 h-3.5 text-[#a68212]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>{col.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onResetColumns}
        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer border shrink-0 self-end sm:self-auto ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-zinc-300'
            : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-[#E9CE79] border-zinc-800'
        }`}
      >
        Show All Columns
      </button>
    </div>
  );
};

