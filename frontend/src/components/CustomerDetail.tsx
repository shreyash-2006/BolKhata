import React from 'react';
import type { Customer, LedgerEntry, Language } from '../types';
import { t } from '../utils/translations';
import { ArrowLeft, Phone, BellRing, PlusCircle, MinusCircle, Calendar, CheckCircle2 } from 'lucide-react';

interface CustomerDetailProps {
  customer: Customer;
  entries: LedgerEntry[];
  lang: Language;
  onBack: () => void;
  onOpenReminder: () => void;
  onQuickAction: (action: 'credit' | 'payment') => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customer,
  entries,
  lang,
  onBack,
  onOpenReminder,
  onQuickAction,
}) => {
  const strings = t(lang);
  const isUdhaar = customer.balance > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between py-3 mb-2">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-bold transition active:scale-95 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{strings.back}</span>
        </button>

        <h2 className="font-bold text-slate-900 text-base">{customer.name}</h2>

        {isUdhaar && (
          <button
            onClick={onOpenReminder}
            className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{strings.sendReminder}</span>
          </button>
        )}
      </div>

      {/* Profile & Balance Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 font-black text-xl flex items-center justify-center">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-lg leading-tight">{customer.name}</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                {customer.phone || 'फोन नंबर नहीं दिया'}
              </p>
            </div>
          </div>
          {customer.is_overdue && (
            <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
              {strings.overdue}
            </span>
          )}
        </div>

        {/* Big Balance */}
        <div className={`p-4 rounded-2xl text-center ${isUdhaar ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'}`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            {isUdhaar ? strings.totalUdhaar : 'जमा राशि (Advance)'}
          </span>
          <div className={`text-3xl font-black mt-0.5 ${isUdhaar ? 'text-rose-600' : 'text-emerald-600'}`}>
            ₹{Math.abs(customer.balance).toLocaleString('en-IN')}
          </div>
          {customer.overdue_amount > 0 && (
            <span className="text-xs text-rose-600 font-medium mt-1 block">
              (₹{customer.overdue_amount} ओवरड्यू है)
            </span>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => onQuickAction('credit')}
            className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{strings.newCredit}</span>
          </button>
          <button
            onClick={() => onQuickAction('payment')}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
          >
            <MinusCircle className="w-4 h-4" />
            <span>{strings.newPayment}</span>
          </button>
        </div>
      </div>

      {/* Ledger History Timeline */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span>{strings.ledgerHistory}</span>
        </h3>

        {entries.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">{strings.noEntries}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isCredit = entry.type === 'credit';
              return (
                <div
                  key={entry.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    entry.is_cancelled
                      ? 'bg-slate-50 border-slate-200 opacity-50 line-through'
                      : isCredit
                      ? 'bg-rose-50/40 border-rose-100'
                      : 'bg-emerald-50/40 border-emerald-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          entry.is_cancelled ? 'text-slate-400' : isCredit ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isCredit ? '+ उधार दिया' : '- जमा मिला'}
                      </span>
                      {entry.is_cancelled && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold no-underline">
                          रद्द (Undone)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {entry.description || 'किराना सामान'}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                      <span>{entry.date}</span>
                      {entry.due_date && (
                        <span className="text-orange-600 font-medium">
                          वादा: {entry.due_date}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-base font-black ${
                        entry.is_cancelled ? 'text-slate-400' : isCredit ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
