import React from 'react';
import type { Shop, Language } from '../types';
import { t } from '../utils/translations';
import { RotateCcw, Mic, Volume2, Settings } from 'lucide-react';

interface HeaderProps {
  shop: Shop | null;
  lang: Language;
  onToggleLang: () => void;
  onUndo: () => void;
  onOpenVoiceClone: () => void;
  onOpenSettings: () => void;
  undoDisabled: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  shop,
  lang,
  onToggleLang,
  onUndo,
  onOpenVoiceClone,
  onOpenSettings,
  undoDisabled,
}) => {
  const strings = t(lang);

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div
          onClick={onOpenSettings}
          className="flex items-center space-x-2 cursor-pointer group"
          title="Click to edit shop settings"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black text-xl shadow-inner tracking-wider group-hover:scale-105 transition-transform">
            ब
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-lg leading-tight tracking-tight group-hover:text-orange-300 transition-colors">
                {shop?.name || strings.appName}
              </h1>
              <Settings className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
            </div>
            <p className="text-xs text-orange-400 font-medium">
              {strings.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Voice clone status pill */}
          <button
            onClick={onOpenVoiceClone}
            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 transition-colors ${
              shop?.voice_clone_enrolled
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
            title="Voice Clone Status"
          >
            {shop?.voice_clone_enrolled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{strings.voiceCloneActive}</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-orange-400" />
                <span>{strings.enrollVoice}</span>
              </>
            )}
          </button>

          {/* Undo Button (P1) */}
          <button
            onClick={onUndo}
            disabled={undoDisabled}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center transition ${
              undoDisabled
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-amber-400 hover:bg-slate-800 active:scale-95'
            }`}
            title={strings.undoBtn}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Language Switch */}
          <button
            onClick={onToggleLang}
            className="bg-slate-800 hover:bg-slate-700 active:scale-95 px-2.5 py-1 rounded-lg text-xs font-bold text-orange-400 border border-slate-700 transition"
          >
            {lang === 'hi' ? 'EN' : 'हिं'}
          </button>
        </div>
      </div>
    </header>
  );
};
