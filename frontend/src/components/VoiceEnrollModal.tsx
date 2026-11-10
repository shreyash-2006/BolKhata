import React, { useState, useRef } from 'react';
import type { Language } from '../types';
import { t } from '../utils/translations';
import { AudioRecorder } from '../utils/audioRecorder';
import { enrollVoiceClone } from '../services/api';
import { X, Mic, Square, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface VoiceEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onEnrolled: () => void;
}

export const VoiceEnrollModal: React.FC<VoiceEnrollModalProps> = ({
  isOpen,
  onClose,
  lang,
  onEnrolled,
}) => {
  const strings = t(lang);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<any>(null);

  const handleStartRecording = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Microphone access denied');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    clearInterval(timerRef.current);
    setIsRecording(false);

    if (seconds < 5) {
      setErrorMessage('रिकॉर्डिंग कम से कम 8-10 सेकंड की होनी चाहिए। कृपया दोबारा बोलें।');
      return;
    }

    setIsSubmitting(true);
    try {
      const wavBlob = await recorderRef.current.stop();
      const res = await enrollVoiceClone(wavBlob);
      setIsSubmitting(false);
      setStatusMessage(res.message || strings.enrollSuccess);
      onEnrolled();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to enroll voice');
    }
  };

  if (!isOpen) return null;

  const targetDuration = 12; // target ~10-15s
  const progressPercent = Math.min(100, Math.round((seconds / targetDuration) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {strings.voiceEnrollTitle}
              </h2>
              <p className="text-[11px] text-slate-500">
                Gnani Vachana VC-v1 Voice Cloning
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Prompt card to read */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {strings.voiceEnrollDesc}
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
              "{strings.voiceEnrollSample}"
            </p>
          </div>

          {/* Recording Timer & Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-500">
              <span>रिकॉर्डिंग समय: {seconds}s</span>
              <span>लक्ष्य: ~10-15s</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  seconds >= 8 ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 flex flex-col items-center">
            {isSubmitting ? (
              <div className="py-6 flex flex-col items-center gap-2 text-slate-600 text-xs font-medium">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <span>{strings.enrolling}</span>
              </div>
            ) : isRecording ? (
              <button
                onClick={handleStopRecording}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{strings.stopRecord} ({seconds}s)</span>
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Mic className="w-4 h-4" />
                <span>{strings.startRecord}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
