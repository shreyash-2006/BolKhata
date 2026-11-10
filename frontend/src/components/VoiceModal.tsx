import React, { useState, useEffect, useRef } from 'react';
import type { Language, ConfirmEntryItem, VoiceProcessResult } from '../types';
import { t } from '../utils/translations';
import { AudioRecorder } from '../utils/audioRecorder';
import { transcribeAudio, processVoiceCommand, confirmEntries } from '../services/api';
import { Mic, Square, Loader2, Volume2, Check, X, Sparkles } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onEntryConfirmed: () => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  lang,
  onEntryConfirmed,
}) => {
  const strings = t(lang);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'result'>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<VoiceProcessResult | null>(null);
  const [editableEntries, setEditableEntries] = useState<ConfirmEntryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    if (isRecording) {
      stopRecording();
    }
    setStatus('idle');
    setTranscript('');
    setResult(null);
    setEditableEntries([]);
    setErrorMsg(null);
    setRecordSeconds(0);
  };

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      recorderRef.current = new AudioRecorder({
        onAudioLevel: (lvl) => setAudioLevel(lvl),
      });
      await recorderRef.current.start();
      setIsRecording(true);
      setStatus('recording');
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic start error:', err);
      setErrorMsg(err.message || 'Microphone access denied. Try using the quick sample chips below.');
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    setStatus('processing');

    try {
      const wavBlob = await recorderRef.current.stop();
      // Send to Gnani STT
      const sttRes = await transcribeAudio(wavBlob, lang === 'hi' ? 'hi-IN,en-IN' : 'en-IN,hi-IN');
      const text = sttRes.transcript.trim();
      setTranscript(text);

      if (!text) {
        setStatus('idle');
        setErrorMsg('कोई आवाज़ नहीं सुनाई दी। कृपया दोबारा बोलें।');
        return;
      }

      await handleProcessTranscript(text);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMsg(err.message || 'Failed to process speech');
      setStatus('idle');
    }
  };

  const handleProcessTranscript = async (text: string) => {
    setStatus('processing');
    try {
      const res = await processVoiceCommand(text, lang === 'hi' ? 'hi-IN' : 'en-IN');
      setResult(res);
      setStatus('result');

      if (res.intent === 'log_entry' && res.confirmation_entries) {
        setEditableEntries([...res.confirmation_entries]);
      } else if (res.intent === 'query' && res.query_audio_url) {
        // Auto-play query response audio
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = res.query_audio_url;
          audioPlayerRef.current.play().catch(() => {});
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to analyze speech');
      setStatus('idle');
    }
  };

  const handleConfirmEntries = async () => {
    if (editableEntries.length === 0) return;
    setIsSaving(true);
    try {
      await confirmEntries(editableEntries, transcript);
      setIsSaving(false);
      onEntryConfirmed();
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg(err.message || 'Failed to save entries');
    }
  };

  const handleReadBack = () => {
    if (editableEntries.length === 0) return;
    const item = editableEntries[0];
    const isCredit = item.action === 'credit';
    const textToSpeak = `${item.customer_name} का ₹${item.amount} का ${isCredit ? 'उधार' : 'जमा'} दर्ज किया जा रहा है।`;
    
    // Browser speech synthesis or sound preview
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.lang = 'hi-IN';
      window.speechSynthesis.speak(utter);
    }
  };

  // 1-Click Demo Pick
  const handleDemoChip = async (sampleText: string) => {
    setTranscript(sampleText);
    await handleProcessTranscript(sampleText);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {strings.tapToSpeak}
              </h2>
              <p className="text-[11px] text-slate-500">
                Gnani Prisma v3.0 Voice AI
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                सुनाई दिया (Transcript):
              </span>
              <p className="text-slate-800 font-semibold text-sm leading-relaxed">
                "{transcript}"
              </p>
            </div>
          )}

          {/* STATUS: RESULT -> CONFIRM CARD (Loop A) */}
          {status === 'result' && result?.intent === 'log_entry' && editableEntries.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300 shadow-sm space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  {strings.confirmTitle}
                </span>
                <button
                  onClick={handleReadBack}
                  className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-amber-800 flex items-center gap-1 hover:bg-amber-100 transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{strings.readBackBtn}</span>
                </button>
              </div>

              {editableEntries.map((entry, idx) => {
                const isCredit = entry.action === 'credit';
                return (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                          isCredit ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isCredit ? 'उधार (+ Credit)' : 'जमा (- Payment)'}
                      </span>
                      <div className="text-xl font-black text-slate-900">
                        ₹{entry.amount}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 block text-[10px]">ग्राहक (Customer):</span>
                        <input
                          type="text"
                          value={entry.customer_name}
                          onChange={(e) => {
                            const updated = [...editableEntries];
                            updated[idx].customer_name = e.target.value;
                            setEditableEntries(updated);
                          }}
                          className="font-bold text-slate-800 border-b border-slate-300 focus:outline-none w-full"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">{strings.dueDateLabel}</span>
                        <input
                          type="text"
                          value={entry.due_date || 'कोई वादा नहीं'}
                          onChange={(e) => {
                            const updated = [...editableEntries];
                            updated[idx].due_date = e.target.value;
                            setEditableEntries(updated);
                          }}
                          placeholder="YYYY-MM-DD"
                          className="font-semibold text-orange-600 border-b border-slate-300 focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 pt-1">
                      <span className="text-[10px] text-slate-400">सामान: </span>
                      <span className="font-medium text-slate-700">{entry.description || 'साइकिल/किराना'}</span>
                    </div>
                  </div>
                );
              })}

              {/* Confirm / Cancel Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleConfirmEntries}
                  disabled={isSaving}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{strings.confirmBtn}</span>
                </button>
                <button
                  onClick={handleReset}
                  className="py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <X className="w-4 h-4" />
                  <span>{strings.cancelBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* STATUS: RESULT -> QUERY ANSWER CARD (Loop B) */}
          {status === 'result' && result?.intent === 'query' && (
            <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  {strings.queryAnswerTitle}
                </span>
                {result.query_audio_url && (
                  <button
                    onClick={() => {
                      if (audioPlayerRef.current && result.query_audio_url) {
                        audioPlayerRef.current.src = result.query_audio_url;
                        audioPlayerRef.current.play().catch(() => {});
                      }
                    }}
                    className="p-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-blue-700 transition"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>सुनें</span>
                  </button>
                )}
              </div>
              <p className="text-slate-900 font-bold text-base bg-white p-3.5 rounded-xl border border-blue-100">
                {result.query_answer}
              </p>
            </div>
          )}

          {/* Big Animated Mic Section */}
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <div
                  className="absolute w-28 h-28 rounded-full bg-rose-400/30 animate-pulse-mic"
                  style={{ transform: `scale(${1 + audioLevel * 0.8})` }}
                />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={status === 'processing'}
                className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-rose-600 text-white'
                    : status === 'processing'
                    ? 'bg-slate-300 text-slate-500'
                    : 'bg-orange-600 hover:bg-orange-500 text-white'
                }`}
              >
                {status === 'processing' ? (
                  <Loader2 className="w-9 h-9 animate-spin" />
                ) : isRecording ? (
                  <>
                    <Square className="w-8 h-8 fill-current" />
                    <span className="text-[11px] font-mono font-bold mt-1">
                      {recordSeconds}s
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-9 h-9" />
                    <span className="text-[10px] font-bold mt-1">बोलें</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs font-medium text-slate-500 text-center max-w-xs">
              {isRecording
                ? 'बोलना जारी रखें, पूरा होने पर लाल बटन दबाएं...'
                : status === 'processing'
                ? strings.processing
                : strings.speakHint}
            </p>
          </div>

          {/* 1-Click Demo Quick Utterances Chips */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 block mb-2">
              {strings.sampleChips}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleDemoChip('शर्मा जी ने 450 का सामान लिया, शुक्रवार तक देगा')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-orange-100 hover:text-orange-800 text-[11px] text-slate-700 font-medium transition"
              >
                🗣️ शर्मा जी ने 450 का सामान लिया...
              </button>
              <button
                onClick={() => handleDemoChip('वर्मा जी का कितना बाकी है?')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-[11px] text-slate-700 font-medium transition"
              >
                🔍 वर्मा जी का कितना बाकी है?
              </button>
              <button
                onClick={() => handleDemoChip('रमेश ने 200 रुपये जमा किए')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-[11px] text-slate-700 font-medium transition"
              >
                💵 रमेश ने 200 जमा किए
              </button>
              <button
                onClick={() => handleDemoChip('किसका पैसा पेंडिंग है?')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-[11px] text-slate-700 font-medium transition"
              >
                ⚠️ किसका पैसा पेंडिंग है?
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Audio Player for Speech */}
        <audio ref={audioPlayerRef} className="hidden" />
      </div>
    </div>
  );
};
