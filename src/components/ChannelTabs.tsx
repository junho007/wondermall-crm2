import React from 'react';
import { Store, ShoppingBag, Globe, Layers } from 'lucide-react';
import { ShopeeOrder } from '../types';
import { getOrInferChannel } from '../utils/csvHelper';

export type ChannelType = 'ALL' | 'Shopee' | 'Lazada' | 'WCG2U';

interface ChannelTabsProps {
  selectedChannel: ChannelType;
  onSelectChannel: (channel: ChannelType) => void;
  orders: ShopeeOrder[];
  mode?: 'orders' | 'customers';
}

export const ChannelTabs: React.FC<ChannelTabsProps> = ({
  selectedChannel,
  onSelectChannel,
  orders,
  mode = 'orders',
}) => {
  // Compute totals for each channel based on mode (orders vs customers)
  const stats = React.useMemo(() => {
    if (mode === 'customers') {
      const allCustomers = new Set<string>();
      const shopeeCustomers = new Set<string>();
      const lazadaCustomers = new Set<string>();
      const wcg2uCustomers = new Set<string>();

      orders.forEach((o) => {
        const custKey = (o.buyerUsername || o.buyerPhone || o.recipientName || 'Guest').toLowerCase().trim().replace(/^@+/, '');
        allCustomers.add(custKey);
        const ch = getOrInferChannel(o);
        if (ch === 'Shopee') shopeeCustomers.add(custKey);
        else if (ch === 'Lazada') lazadaCustomers.add(custKey);
        else if (ch === 'WCG2U') wcg2uCustomers.add(custKey);
      });

      return {
        counts: {
          ALL: allCustomers.size,
          Shopee: shopeeCustomers.size,
          Lazada: lazadaCustomers.size,
          WCG2U: wcg2uCustomers.size,
        },
        unit: 'customer',
        unitPlural: 'customers',
      };
    }

    const counts = {
      ALL: orders.length,
      Shopee: 0,
      Lazada: 0,
      WCG2U: 0,
    };

    orders.forEach((o) => {
      const ch = getOrInferChannel(o);
      counts[ch] = (counts[ch] || 0) + 1;
    });

    return {
      counts,
      unit: 'order',
      unitPlural: 'orders',
    };
  }, [orders, mode]);

  const channels: {
    key: ChannelType;
    label: string;
    icon: (selected: boolean) => React.ReactNode;
    activeClasses: string;
    inactiveClasses: string;
    activeBadge: string;
    inactiveBadge: string;
  }[] = [
    {
      key: 'ALL',
      label: 'ALL Channels',
      icon: (selected) => <Layers className={`w-4 h-4 ${selected ? 'text-white' : 'text-slate-700'}`} />,
      activeClasses: 'bg-slate-900 text-white border-slate-900 shadow-sm font-black',
      inactiveClasses: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 font-bold',
      activeBadge: 'bg-white/20 text-white border-white/20',
      inactiveBadge: 'bg-white text-slate-800 border-slate-300',
    },
    {
      key: 'Shopee',
      label: 'Shopee Store',
      icon: (selected) => <ShoppingBag className={`w-4 h-4 ${selected ? 'text-white' : 'text-orange-600'}`} />,
      activeClasses: 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-sm font-black',
      inactiveClasses: 'bg-orange-50/90 hover:bg-orange-100 text-orange-950 border-orange-200 font-extrabold',
      activeBadge: 'bg-white/20 text-white border-white/30',
      inactiveBadge: 'bg-orange-100/80 text-orange-950 border-orange-300/80',
    },
    {
      key: 'Lazada',
      label: 'Lazada MY',
      icon: (selected) => <Store className={`w-4 h-4 ${selected ? 'text-white' : 'text-blue-600'}`} />,
      activeClasses: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm font-black',
      inactiveClasses: 'bg-blue-50/90 hover:bg-blue-100 text-blue-950 border-blue-200 font-extrabold',
      activeBadge: 'bg-white/20 text-white border-white/30',
      inactiveBadge: 'bg-blue-100/80 text-blue-950 border-blue-300/80',
    },
    {
      key: 'WCG2U',
      label: 'WCG2U (Direct Store)',
      icon: (selected) => <Globe className={`w-4 h-4 ${selected ? 'text-slate-950' : 'text-amber-800'}`} />,
      activeClasses: 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black',
      inactiveClasses: 'bg-amber-50/90 hover:bg-amber-100 text-amber-950 border-amber-300 font-extrabold',
      activeBadge: 'bg-slate-950/15 text-slate-950 border-slate-950/20',
      inactiveBadge: 'bg-amber-100/80 text-amber-950 border-amber-300/80',
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 w-full">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1 hidden sm:inline-block">
          Channel:
        </span>
        {channels.map((ch) => {
          const isSelected = selectedChannel === ch.key;
          const count = stats.counts[ch.key] || 0;

          return (
            <button
              key={ch.key}
              type="button"
              onClick={() => onSelectChannel(ch.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer border ${
                isSelected ? ch.activeClasses : ch.inactiveClasses
              }`}
            >
              <span className="shrink-0">{ch.icon(isSelected)}</span>
              <span>{ch.label}</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${
                  isSelected ? ch.activeBadge : ch.inactiveBadge
                }`}
              >
                {count} {count === 1 ? stats.unit : stats.unitPlural}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
