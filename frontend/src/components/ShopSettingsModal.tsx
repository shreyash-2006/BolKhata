import React, { useState, useEffect } from 'react';
import type { Shop, Language } from '../types';
import { updateShop } from '../services/api';
import { X, Store, User, Phone, Globe, Check, Loader2 } from 'lucide-react';

interface ShopSettingsModalProps {
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onShopUpdated: (updated: Shop) => void;
}

export const ShopSettingsModal: React.FC<ShopSettingsModalProps> = ({
  shop,
  isOpen,
  onClose,
  lang,
  onShopUpdated,
}) => {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [shopLanguage, setShopLanguage] = useState('hi-IN');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setOwnerName(shop.owner_name);
      setOwnerPhone(shop.owner_phone || '');
      setShopLanguage(shop.language || 'hi-IN');
    }
  }, [shop, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const updated = await updateShop({
        name,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        language: shopLanguage,
      });
      setIsSaving(false);
      onShopUpdated(updated);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg(err.message || 'Failed to update shop');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {lang === 'hi' ? 'दुकान की जानकारी (Shop Settings)' : 'Shop Settings'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {shop?.name}
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

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {lang === 'hi' ? 'दुकान का नाम:' : 'Shop Name:'}
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {lang === 'hi' ? 'दुकानदार का नाम:' : 'Owner Name:'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {lang === 'hi' ? 'मोबाइल नंबर:' : 'Phone Number:'}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {lang === 'hi' ? 'प्राथमिक भाषा (Primary Language):' : 'Primary Language:'}
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={shopLanguage}
                onChange={(e) => setShopLanguage(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white"
              >
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="mr-IN">मराठी (Marathi)</option>
                <option value="gu-IN">ગુજરાતી (Gujarati)</option>
                <option value="en-IN">English</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-98"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{lang === 'hi' ? 'सेव करें (Save Changes)' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
