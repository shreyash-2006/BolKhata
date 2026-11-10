import React, { useState, useEffect, useRef } from 'react';
import type { Customer, Language, ReminderDraft, Shop } from '../types';
import { t } from '../utils/translations';
import { draftReminder, speakReminder } from '../services/api';
import { X, Play, Pause, Share2, Download, Volume2, Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface ReminderModalProps {
  customer: Customer | null;
  shop: Shop | null;
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  customer,
  shop,
  lang,
  isOpen,
  onClose,
}) => {
  const strings = t(lang);
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [text, setText] = useState('');
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [voiceType, setVoiceType] = useState<'cloned' | 'stock'>('cloned');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen && customer) {
      const preferred = customer.language || 'hi-IN';
      setSelectedLang(preferred);
      setVoiceType(shop?.voice_clone_enrolled ? 'cloned' : 'stock');
      setAudioUrl(null);
      setIsPlaying(false);
      loadDraft(customer.id, preferred);
    }
  }, [isOpen, customer]);

  const loadDraft = async (custId: number, l: string) => {
    setIsLoadingDraft(true);
    setErrorMsg(null);
    try {
      const d = await draftReminder(custId, l);
      setDraft(d);
      setText(d.draft_text);
      setIsLoadingDraft(false);
      // Auto-generate audio for immediate preview
      generateAudio(custId, d.draft_text, voiceType, l);
    } catch (err: any) {
      setIsLoadingDraft(false);
      setErrorMsg(err.message || 'Failed to generate reminder draft');
    }
  };

  const generateAudio = async (custId: number, reminderText: string, vType: 'cloned' | 'stock', l: string) => {
    setIsSynthesizing(true);
    try {
      const res = await speakReminder(custId, reminderText, vType, l);
      setAudioUrl(res.audio_url);
      setIsSynthesizing(false);
    } catch (err: any) {
      setIsSynthesizing(false);
      console.warn('Synthesis error:', err);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleShareWhatsApp = () => {
    if (!customer) return;
    const phone = customer.phone?.replace(/[^0-9]/g, '') || '';
    const shareText = encodeURIComponent(`${text}\n\n(ऑडियो संदेश: ${window.location.origin}${audioUrl || ''})`);
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${shareText}`
      : `https://wa.me/?text=${shareText}`;
    window.open(waUrl, '_blank');
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `reminder_${customer?.name || 'customer'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {strings.reminderStudio} — {customer.name}
              </h2>
              <p className="text-[11px] text-orange-700 font-semibold">
                बाकी: ₹{customer.balance.toLocaleString('en-IN')}
                {draft && draft.days_overdue > 0 && ` • (${draft.days_overdue} दिन ओवरड्यू)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Language Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              ग्राहक की भाषा (Customer Language):
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
              {[
                { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
                { code: 'mr-IN', label: 'मराठी (Marathi)' },
                { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
                { code: 'en-IN', label: 'English' },
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => {
                    setSelectedLang(item.code);
                    loadDraft(customer.id, item.code);
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center transition ${
                    selectedLang === item.code
                      ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drafted Message in Native Script */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                रिमाइंडर संदेश (संपादित कर सकते हैं):
              </label>
              <button
                onClick={() => loadDraft(customer.id, selectedLang)}
                disabled={isLoadingDraft}
                className="text-[11px] text-orange-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingDraft ? 'animate-spin' : ''}`} />
                नया लिखें
              </button>
            </div>

            {isLoadingDraft ? (
              <div className="h-24 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ड्राफ्ट तैयार हो रहा है...
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-slate-50/50 shadow-inner"
              />
            )}
          </div>

          {/* Voice Type Selection */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {strings.previewVoice}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setVoiceType('cloned');
                  generateAudio(customer.id, text, 'cloned', selectedLang);
                }}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  voiceType === 'cloned'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{strings.myVoice}</span>
              </button>

              <button
                onClick={() => {
                  setVoiceType('stock');
                  generateAudio(customer.id, text, 'stock', selectedLang);
                }}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  voiceType === 'stock'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                <span>{strings.stockVoice}</span>
              </button>
            </div>
          </div>

          {/* Audio Player Card */}
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlay}
                disabled={isSynthesizing || !audioUrl}
                className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 active:scale-95 text-white flex items-center justify-center shadow-md transition disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {voiceType === 'cloned' ? 'आपकी क्लोन आवाज़ में संदेश' : 'स्टॉक आवाज़ (Shivani)'}
                </span>
                <span className="text-[11px] text-orange-700 font-medium">
                  {isSynthesizing ? 'ऑडियो तैयार हो रहा है...' : isPlaying ? 'चल रहा है...' : 'सुनने के लिए प्ले करें'}
                </span>
              </div>
            </div>

            {audioUrl && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-xl bg-white border border-orange-200 text-orange-700 hover:bg-orange-100 text-xs font-semibold transition"
                title={strings.downloadAudio}
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* WhatsApp Share Button (Loop C Final) */}
          <button
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Share2 className="w-4 h-4" />
            <span>{strings.shareWhatsApp}</span>
          </button>
        </div>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
};
