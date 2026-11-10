import React from 'react';
import type { LedgerSummary, Language } from '../types';
import { t } from '../utils/translations';
import { IndianRupee, ArrowDownCircle, AlertCircle, CalendarCheck } from 'lucide-react';

interface SummaryCardsProps {
  summary: LedgerSummary | null;
  lang: Language;
  onSelectTab: (tab: 'all' | 'overdue' | 'today') => void;
  activeTab: 'all' | 'overdue' | 'today';
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  lang,
  onSelectTab,
  activeTab,
}) => {
  const strings = t(lang);

  return (
    <div className="grid grid-cols-2 gap-2.5 p-4 max-w-2xl mx-auto">
      {/* Total Udhaar Card */}
      <div
        onClick={() => onSelectTab('all')}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
          activeTab === 'all'
            ? 'bg-rose-50 border-rose-300 shadow-sm ring-2 ring-rose-400/40'
            : 'bg-white border-slate-200 hover:border-rose-200'
        }`}
      >
        <div className="flex items-center justify-between text-rose-600 mb-1">
          <span className="text-xs font-semibold">{strings.totalUdhaar}</span>
          <IndianRupee className="w-4 h-4 opacity-80" />
        </div>
        <div className="text-2xl font-black text-rose-600 tracking-tight">
          ₹{summary?.total_udhaar.toLocaleString('en-IN') ?? 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {summary?.customers_count ?? 0} {strings.customers}
        </p>
      </div>

      {/* Collected Today */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
        <div className="flex items-center justify-between text-emerald-600 mb-1">
          <span className="text-xs font-semibold">{strings.collectedToday}</span>
          <ArrowDownCircle className="w-4 h-4 opacity-80" />
        </div>
        <div className="text-2xl font-black text-emerald-600 tracking-tight">
          ₹{summary?.collected_today.toLocaleString('en-IN') ?? 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {strings.todayDue}: {summary?.due_today_count ?? 0}
        </p>
      </div>

      {/* Overdue Customers */}
      <div
        onClick={() => onSelectTab('overdue')}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
          activeTab === 'overdue'
            ? 'bg-amber-50 border-amber-300 shadow-sm ring-2 ring-amber-400/40'
            : 'bg-white border-slate-200 hover:border-amber-200'
        }`}
      >
        <div className="flex items-center justify-between text-amber-600 mb-1">
          <span className="text-xs font-semibold">{strings.overdueCustomers}</span>
          <AlertCircle className="w-4 h-4 opacity-80" />
        </div>
        <div className="text-2xl font-black text-amber-600 tracking-tight">
          {summary?.overdue_count ?? 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {strings.sendReminder}
        </p>
      </div>

      {/* Due Today Card */}
      <div
        onClick={() => onSelectTab('today')}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
          activeTab === 'today'
            ? 'bg-blue-50 border-blue-300 shadow-sm ring-2 ring-blue-400/40'
            : 'bg-white border-slate-200 hover:border-blue-200'
        }`}
      >
        <div className="flex items-center justify-between text-blue-600 mb-1">
          <span className="text-xs font-semibold">{strings.dueToday}</span>
          <CalendarCheck className="w-4 h-4 opacity-80" />
        </div>
        <div className="text-2xl font-black text-blue-600 tracking-tight">
          {summary?.due_today_count ?? 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {strings.dueThisWeek}: {summary?.due_this_week_count ?? 0}
        </p>
      </div>
    </div>
  );
};
