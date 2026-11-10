import type {
  Shop,
  ShopUpdate,
  Customer,
  LedgerSummary,
  LedgerEntry,
  ConfirmEntryItem,
  VoiceProcessResult,
  ReminderDraft,
} from '../types';

const BASE_URL = '/api';

export async function getShop(): Promise<Shop> {
  const res = await fetch(`${BASE_URL}/shop`);
  if (!res.ok) throw new Error('Failed to fetch shop info');
  return res.json();
}

export async function updateShop(data: ShopUpdate): Promise<Shop> {
  const res = await fetch(`${BASE_URL}/shop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update shop info');
  return res.json();
}

export async function getSummary(): Promise<LedgerSummary> {
  const res = await fetch(`${BASE_URL}/ledger/summary`);
  if (!res.ok) throw new Error('Failed to fetch ledger summary');
  return res.json();
}

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch(`${BASE_URL}/ledger/customers`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function getCustomerDetail(id: number): Promise<{ customer: Customer; entries: LedgerEntry[] }> {
  const res = await fetch(`${BASE_URL}/ledger/customers/${id}`);
  if (!res.ok) throw new Error('Failed to fetch customer detail');
  return res.json();
}

export async function confirmEntries(entries: ConfirmEntryItem[], transcript?: string): Promise<LedgerEntry[]> {
  const res = await fetch(`${BASE_URL}/ledger/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries, transcript }),
  });
  if (!res.ok) throw new Error('Failed to confirm ledger entries');
  return res.json();
}

export async function undoLastEntry(): Promise<LedgerEntry> {
  const res = await fetch(`${BASE_URL}/ledger/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to undo' }));
    throw new Error(err.detail || 'Failed to undo last entry');
  }
  return res.json();
}

export async function transcribeAudio(blob: Blob, langCode: string = 'hi-IN,en-IN'): Promise<{ transcript: string; detected_language: string }> {
  const formData = new FormData();
  formData.append('audio_file', blob, 'recording.wav');

  const res = await fetch(`${BASE_URL}/voice/transcribe?language_code=${encodeURIComponent(langCode)}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Speech transcription failed' }));
    throw new Error(err.detail || 'Speech transcription failed');
  }
  return res.json();
}

export async function processVoiceCommand(transcript: string, langHint: string = 'hi-IN'): Promise<VoiceProcessResult> {
  const res = await fetch(`${BASE_URL}/voice/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, language_hint: langHint }),
  });
  if (!res.ok) throw new Error('Failed to process voice command');
  return res.json();
}

export async function draftReminder(customerId: number, language?: string): Promise<ReminderDraft> {
  const res = await fetch(`${BASE_URL}/reminders/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId, language }),
  });
  if (!res.ok) throw new Error('Failed to draft reminder');
  return res.json();
}

export async function speakReminder(
  customerId: number,
  text: string,
  voiceType: 'cloned' | 'stock',
  language: string = 'hi-IN'
): Promise<{ audio_url: string; voice_used: string }> {
  const res = await fetch(`${BASE_URL}/reminders/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      text,
      voice_type: voiceType,
      language,
    }),
  });
  if (!res.ok) throw new Error('Failed to synthesize reminder audio');
  return res.json();
}

export async function enrollVoiceClone(blob: Blob): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('audio_file', blob, 'enroll.wav');

  const res = await fetch(`${BASE_URL}/voice/enroll-clone`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Enrollment failed' }));
    throw new Error(err.detail || 'Failed to enroll voice clone');
  }
  return res.json();
}
