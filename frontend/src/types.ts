export type Language = 'hi' | 'en';
export type DashboardTab = 'all' | 'overdue' | 'today' | 'week';

export interface Shop {
  id: number;
  name: string;
  owner_name: string;
  owner_phone?: string;
  language: string;
  voice_clone_enrolled: boolean;
}

export interface ShopUpdate {
  name?: string;
  owner_name?: string;
  owner_phone?: string;
  language?: string;
}

export interface Customer {
  id: number;
  shop_id: number;
  name: string;
  phone?: string;
  language: string;
  notes?: string;
  balance: number;
  overdue_amount: number;
  is_overdue: boolean;
  next_due_date?: string;
  is_due_today?: boolean;
  is_due_this_week?: boolean;
  last_transaction_date?: string;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  customer_id: number;
  customer_name: string;
  type: 'credit' | 'payment';
  amount: number;
  date: string;
  due_date?: string;
  description?: string;
  is_cancelled: boolean;
  transcript?: string;
  created_at: string;
}

export interface LedgerSummary {
  total_udhaar: number;
  collected_today: number;
  overdue_count: number;
  customers_count: number;
  due_today_count: number;
  due_this_week_count: number;
}

export interface ConfirmEntryItem {
  action: 'credit' | 'payment';
  customer_name: string;
  amount: number;
  due_date?: string;
  description?: string;
}

export interface VoiceProcessResult {
  intent: 'log_entry' | 'query' | 'unknown';
  needs_confirmation: boolean;
  confirmation_entries?: ConfirmEntryItem[];
  query_answer?: string;
  query_audio_url?: string;
}

export interface ReminderDraft {
  customer_id: number;
  customer_name: string;
  amount: number;
  language: string;
  draft_text: string;
  days_overdue: number;
}
