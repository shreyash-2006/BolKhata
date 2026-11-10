import React, { useState } from 'react';
import type { Customer, Language } from '../types';
import { t } from '../utils/translations';
import { Phone, ChevronRight, Search, BellRing } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  lang: Language;
  onSelectCustomer: (customer: Customer) => void;
  onOpenReminder: (customer: Customer, e: React.MouseEvent) => void;
  activeTab: 'all' | 'overdue' | 'today';
  onChangeTab: (tab: 'all' | 'overdue' | 'today') => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  lang,
  onSelectCustomer,
  onOpenReminder,
  activeTab,
  onChangeTab,
}) => {
  const strings = t(lang);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = customers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm));
    if (!matchesSearch) return false;

    if (activeTab === 'overdue') return c.is_overdue;
    if (activeTab === 'today') return c.balance > 0;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28">
      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={lang === 'hi' ? 'ग्राहक का नाम खोजें...' : 'Search customer name...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onChangeTab('all')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {strings.all} ({customers.length})
        </button>
        <button
          onClick={() => onChangeTab('overdue')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'overdue'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {strings.overdue} ({customers.filter((c) => c.is_overdue).length})
        </button>
      </div>

      {/* Customers List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <p className="text-sm">{strings.noCustomers}</p>
          </div>
        ) : (
          filtered.map((c) => {
            const hasUdhaar = c.balance > 0;
            return (
              <div
                key={c.id}
                onClick={() => onSelectCustomer(c)}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-orange-300 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-base border border-slate-200">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 text-sm">{c.name}</h3>
                      {c.is_overdue && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md font-semibold">
                          {strings.overdue}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.phone}
                        </span>
                      )}
                      {c.language && (
                        <span className="text-[10px] uppercase font-mono bg-slate-100 text-slate-600 px-1 rounded">
                          {c.language}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div
                      className={`font-black text-base ${
                        hasUdhaar ? 'text-rose-600' : c.balance < 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      ₹{Math.abs(c.balance).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {hasUdhaar ? 'उधार (बाकी)' : c.balance < 0 ? 'जमा (Advance)' : 'चुकता'}
                    </span>
                  </div>

                  {/* Reminder Action icon button */}
                  {hasUdhaar && (
                    <button
                      onClick={(e) => onOpenReminder(c, e)}
                      className="p-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition active:scale-95"
                      title={strings.sendReminder}
                    >
                      <BellRing className="w-4 h-4" />
                    </button>
                  )}

                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
