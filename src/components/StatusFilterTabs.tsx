import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, Columns, Calendar, MapPin, User, RotateCcw, ChevronDown, Check, Tag, Globe } from 'lucide-react';
import { ShopeeOrder, ColumnDefinition, DatePreset } from '../types';
import { CustomDropdown, OptionItem } from './CustomDropdown';
import { CustomDatePicker } from './CustomDatePicker';

interface StatusFilterTabsProps {
  orders: ShopeeOrder[];
  selectedStatuses: string[];
  onSelectStatuses: (statuses: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategories: string[];
  onSelectCategories: (categories: string[]) => void;
  selectedCountries?: string[];
  onSelectCountries?: (countries: string[]) => void;
  selectedStates?: string[];
  onSelectStates?: (states: string[]) => void;
  selectedRaces?: string[];
  onSelectRaces?: (races: string[]) => void;
  onResetFilters: () => void;
  filteredCount: number;
  columns?: ColumnDefinition[];
  onToggleColumn?: (key: string) => void;
  onResetColumns?: () => void;
  datePreset?: DatePreset;
  onSelectDatePreset?: (preset: DatePreset) => void;
  startDate?: string;
  endDate?: string;
  onChangeStartDate?: (date: string) => void;
  onChangeEndDate?: (date: string) => void;
}

export const StatusFilterTabs: React.FC<StatusFilterTabsProps> = ({
  orders,
  selectedStatuses,
  onSelectStatuses,
  searchQuery,
  onSearchChange,
  selectedCategories,
  onSelectCategories,
  selectedCountries,
  onSelectCountries,
  selectedStates = ['All'],
  onSelectStates,
  selectedRaces = ['All'],
  onSelectRaces,
  onResetFilters,
  filteredCount,
  columns,
  onToggleColumn,
  onResetColumns,
  datePreset = 'all',
  onSelectDatePreset,
  startDate = '',
  endDate = '',
  onChangeStartDate,
  onChangeEndDate,
}) => {
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setIsColumnsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Status Options with counts
  const statusCounts: Record<string, number> = { All: orders.length };
  orders.forEach((o) => {
    const status = o.orderStatus || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const availableStatuses: OptionItem[] = [
    { value: 'All', label: 'All Statuses', count: statusCounts.All || 0 },
    { value: 'Completed', label: 'Completed', count: statusCounts.Completed || 0 },
    { value: 'In Transit', label: 'In Transit', count: statusCounts['In Transit'] || 0 },
    { value: 'Unpaid', label: 'Unpaid', count: statusCounts.Unpaid || 0 },
    { value: 'Cancelled', label: 'Cancelled', count: statusCounts.Cancelled || 0 },
  ];

  // Category Options
  const categoryOptions: OptionItem[] = [
    { value: 'All', label: 'All Categories' },
    { value: 'Mobile Legends', label: 'Mobile Legends' },
    { value: 'PUBG', label: 'PUBG Mobile' },
    { value: 'Roblox', label: 'Roblox' },
    { value: 'Steam', label: 'Steam Wallet' },
    { value: 'Genshin', label: 'Genshin Impact' },
    { value: 'Razer', label: 'Razer Gold' },
    { value: 'Valorant', label: 'Valorant' },
  ];

  // Country Location Options
  const countryOptions: OptionItem[] = [
    'All',
    'Malaysia',
    'Singapore',
    'China',
    'Indonesia',
  ].map((st) => ({ value: st, label: st === 'All' ? 'All Countries' : st }));

  const activeCountryValues = selectedCountries || selectedStates;
  const activeCountryHandler = onSelectCountries || onSelectStates;

  // Ethnicity Options
  const raceOptions: OptionItem[] = ['All', 'Malay', 'Chinese', 'Indian', 'Other'].map((r) => ({
    value: r,
    label: r === 'All' ? 'All Ethnicities' : r,
  }));

  const isAnyFilterActive =
    (selectedStatuses.length > 0 && !selectedStatuses.includes('All')) ||
    (selectedCategories.length > 0 && !selectedCategories.includes('All')) ||
    (activeCountryValues.length > 0 && !activeCountryValues.includes('All')) ||
    (selectedRaces.length > 0 && !selectedRaces.includes('All')) ||
    searchQuery.trim() !== '' ||
    datePreset !== 'all' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-xs border border-slate-200 space-y-3">
      {/* ROW 1: Search Bar + Multi-Select Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Compact Search Bar */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Order SN, Buyer, Phone..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-900 border border-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Multi-Select Order Status Dropdown */}
        <CustomDropdown
          label="Status"
          icon={<Filter className="w-3.5 h-3.5 text-blue-600" />}
          options={availableStatuses}
          isMulti={true}
          selectedValues={selectedStatuses}
          onMultiChange={onSelectStatuses}
        />

        {/* Multi-Select Product Category Dropdown */}
        <CustomDropdown
          label="Category"
          icon={<Tag className="w-3.5 h-3.5 text-blue-600" />}
          options={categoryOptions}
          isMulti={true}
          selectedValues={selectedCategories}
          onMultiChange={onSelectCategories}
        />

        {/* Multi-Select Country Location Dropdown */}
        {activeCountryHandler && (
          <CustomDropdown
            label="Country"
            icon={<Globe className="w-3.5 h-3.5 text-blue-600" />}
            options={countryOptions}
            isMulti={true}
            selectedValues={activeCountryValues}
            onMultiChange={activeCountryHandler}
          />
        )}

        {/* Multi-Select Buyer Ethnicity Dropdown */}
        {onSelectRaces && (
          <CustomDropdown
            label="Ethnicity"
            icon={<User className="w-3.5 h-3.5 text-blue-600" />}
            options={raceOptions}
            isMulti={true}
            selectedValues={selectedRaces}
            onMultiChange={onSelectRaces}
          />
        )}

        {/* Table Columns Popover Dropdown */}
        {columns && onToggleColumn && (
          <div className="relative" ref={columnsRef}>
            <button
              onClick={() => setIsColumnsOpen(!isColumnsOpen)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Columns className="w-3.5 h-3.5 text-blue-600" />
              <span>Columns ({columns.filter((c) => c.visible).length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isColumnsOpen && (
              <div className="absolute left-0 top-10 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Visible Table Columns</span>
                  {onResetColumns && (
                    <button
                      onClick={onResetColumns}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => onToggleColumn(col.key)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reset Filters Action Button */}
        {isAnyFilterActive && (
          <button
            onClick={onResetFilters}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* ROW 2: Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="uppercase text-[10px] tracking-wider text-slate-500">Date Range:</span>
          </div>

          {/* Popover Custom Calendar Picker */}
          <CustomDatePicker
            startDate={startDate || null}
            endDate={endDate || null}
            datePreset={datePreset}
            onChangeStartDate={(d) => onChangeStartDate?.(d || '')}
            onChangeEndDate={(d) => onChangeEndDate?.(d || '')}
            onSelectPreset={(p) => onSelectDatePreset?.(p)}
            theme="light"
          />

          {/* Reset Filters Button */}
          {isAnyFilterActive && (
            <button
              onClick={onResetFilters}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
              title="Reset All Active Filters & Date Range"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filtered Records Match Indicator */}
        <div className="text-[11px] font-medium text-slate-500">
          Matched Orders: <strong className="text-slate-900 font-mono">{filteredCount}</strong> / {orders.length}
        </div>
      </div>
    </div>
  );
};
