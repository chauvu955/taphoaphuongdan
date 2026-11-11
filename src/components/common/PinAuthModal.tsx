import React, { useState } from 'react';
import { Lock, X, Check, Delete } from 'lucide-react';
import type { Employee } from '../../types';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => Promise<{ success: boolean; message?: string }>;
  staffList?: Employee[];
  title?: string;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staffList = [],
  title = 'Đăng Nhập / Đổi Ca Nhân Viên',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async (overridePin?: string) => {
    const finalPin = overridePin ?? pin;
    if (!finalPin.trim()) {
      setError('Vui lòng nhập mã PIN');
      return;
    }
    setLoading(true);
    try {
      const res = await onSuccess(finalPin);
      if (res.success) {
        setPin('');
        setError(null);
        onClose();
      } else {
        setError(res.message || 'Mã PIN không đúng.');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kiểm tra PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* PIN Display */}
        <div className="mt-4 flex flex-col items-center">
          <div className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-50 border border-slate-200 tracking-[0.5em] text-2xl font-bold font-mono text-slate-800">
            {pin ? '•'.repeat(pin.length) : <span className="text-sm tracking-normal text-slate-400 font-sans">Nhập mã PIN</span>}
          </div>

          {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
        </div>

        {/* Numeric Keypad */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200 active:scale-95 transition"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-200 active:scale-95 transition"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200 active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading || !pin}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 shadow-md shadow-sky-600/30"
          >
            <Check className="h-4 w-4" />
            {loading ? 'Đang xác thực...' : 'Xác Nhận'}
          </button>
        </div>

        {/* Quick hint for initial users */}
        <div className="mt-4 rounded-lg bg-sky-50 p-2.5 text-[11px] text-sky-800 border border-sky-100">
          <span className="font-semibold">Mã PIN mặc định:</span>
          <div className="mt-0.5 flex justify-between">
            <span>Chủ cửa hàng: <strong className="font-mono">1234</strong></span>
            <span>Thu ngân: <strong className="font-mono">0000</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
