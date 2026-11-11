import React from 'react';
import { Printer, X, CheckCircle, ArrowLeft } from 'lucide-react';
import type { Order, StoreSettings } from '../../types';
import { PrintReceipt } from '../common/PrintReceipt';

interface ReceiptModalProps {
  order: Order | null;
  settings: StoreSettings | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  settings,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
            <h3 className="text-sm font-bold text-slate-800">Thanh Toán Thành Công</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Receipt Paper Container (Scrollable Preview) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 flex justify-center">
          <div className="bg-white p-2 rounded-lg shadow-md border border-slate-200">
            <PrintReceipt order={order} settings={settings} />
          </div>
        </div>

        {/* Action Controls */}
        <div className="border-t border-slate-200 bg-white p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Bán Đơn Tiếp (Esc)
          </button>
          <button
            onClick={handlePrint}
            autoFocus
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500 active:scale-95 transition"
          >
            <Printer className="h-4 w-4" />
            In Hóa Đơn (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};
