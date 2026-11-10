import { useState, useEffect } from 'react';
import type { Shop, Customer, LedgerSummary, LedgerEntry, Language } from './types';
import { getShop, getSummary, getCustomers, getCustomerDetail, undoLastEntry, confirmEntries } from './services/api';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { CustomerList } from './components/CustomerList';
import { CustomerDetail } from './components/CustomerDetail';
import { VoiceModal } from './components/VoiceModal';
import { ReminderModal } from './components/ReminderModal';
import { VoiceEnrollModal } from './components/VoiceEnrollModal';
import { Mic, CheckCircle } from 'lucide-react';
import { t } from './utils/translations';

export function App() {
  const [lang, setLang] = useState<Language>('hi');
  const [shop, setShop] = useState<Shop | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today'>('all');

  // Selected customer for detail screen
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerEntries, setCustomerEntries] = useState<LedgerEntry[]>([]);

  // Modals state
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<Customer | null>(null);
  const [isVoiceEnrollOpen, setIsVoiceEnrollOpen] = useState(false);

  // Undo notification state
  const [undoToast, setUndoToast] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [shopData, summaryData, custList] = await Promise.all([
        getShop(),
        getSummary(),
        getCustomers(),
      ]);
      setShop(shopData);
      setSummary(summaryData);
      setCustomers(custList);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const handleSelectCustomer = async (cust: Customer) => {
    setSelectedCustomer(cust);
    try {
      const detail = await getCustomerDetail(cust.id);
      setCustomerEntries(detail.entries);
    } catch (err) {
      console.error('Failed to fetch customer entries:', err);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedCustomer(null);
    setCustomerEntries([]);
    loadInitialData();
  };

  const handleOpenReminder = (cust: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReminderTarget(cust);
    setIsReminderOpen(true);
  };

  const handleUndo = async () => {
    try {
      const undone = await undoLastEntry();
      setUndoToast(`${undone.customer_name} की ₹${undone.amount} की प्रविष्टि रद्द की गई`);
      setTimeout(() => setUndoToast(null), 3000);
      loadInitialData();
      if (selectedCustomer) {
        handleSelectCustomer(selectedCustomer);
      }
    } catch (err: any) {
      alert(err.message || 'Undo failed');
    }
  };

  const handleQuickCustomerAction = async (action: 'credit' | 'payment') => {
    if (!selectedCustomer) return;
    const amountStr = prompt(`राशि दर्ज करें (Enter Amount for ${action === 'credit' ? 'उधार' : 'जमा'}):`, '100');
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) return;

    try {
      await confirmEntries([
        {
          action,
          customer_name: selectedCustomer.name,
          amount: Number(amountStr),
          description: action === 'credit' ? 'किराना सामान' : 'नकद भुगतान',
        },
      ]);
      await handleSelectCustomer(selectedCustomer);
      loadInitialData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const strings = t(lang);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <Header
        shop={shop}
        lang={lang}
        onToggleLang={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        onUndo={handleUndo}
        onOpenVoiceClone={() => setIsVoiceEnrollOpen(true)}
        undoDisabled={false}
      />

      {/* Undo Toast */}
      {undoToast && (
        <div className="max-w-md mx-auto fixed top-16 left-4 right-4 z-40 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{undoToast}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            entries={customerEntries}
            lang={lang}
            onBack={handleBackToDashboard}
            onOpenReminder={() => handleOpenReminder(selectedCustomer)}
            onQuickAction={handleQuickCustomerAction}
          />
        ) : (
          <>
            <SummaryCards
              summary={summary}
              lang={lang}
              onSelectTab={setActiveTab}
              activeTab={activeTab}
            />
            <CustomerList
              customers={customers}
              lang={lang}
              onSelectCustomer={handleSelectCustomer}
              onOpenReminder={handleOpenReminder}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
            />
          </>
        )}
      </main>

      {/* Persistent Floating Mic Button (Always Bottom Center) */}
      <div className="fixed bottom-5 inset-x-0 flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => setIsVoiceOpen(true)}
          className="pointer-events-auto h-16 px-6 rounded-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold text-sm flex items-center gap-3 shadow-2xl shadow-orange-600/40 border-2 border-white transition-all transform hover:-translate-y-0.5"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
          <span className="tracking-tight">{strings.tapToSpeak}</span>
        </button>
      </div>

      {/* Modals */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        lang={lang}
        onEntryConfirmed={() => {
          loadInitialData();
          if (selectedCustomer) {
            handleSelectCustomer(selectedCustomer);
          }
        }}
      />

      <ReminderModal
        isOpen={isReminderOpen}
        customer={reminderTarget}
        shop={shop}
        lang={lang}
        onClose={() => {
          setIsReminderOpen(false);
          setReminderTarget(null);
        }}
      />

      <VoiceEnrollModal
        isOpen={isVoiceEnrollOpen}
        onClose={() => setIsVoiceEnrollOpen(false)}
        lang={lang}
        onEnrolled={() => {
          loadInitialData();
        }}
      />
    </div>
  );
}

export default App;
