import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, FileText, Printer, CheckCircle2, Calendar } from 'lucide-react';
import { db } from '../../db/db';
import type { PurchaseOrder, Employee } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';
import { PurchaseFormModal } from './PurchaseFormModal';

interface PurchaseModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const PurchaseModule: React.FC<PurchaseModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const list = await db.purchaseOrders.orderBy('id').reverse().toArray();
    setPurchases(list);
  };

  const filteredPurchases = purchases.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.code.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      (p.staffName && p.staffName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Quản Lý Nhập Hàng
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
              {purchases.length} phiếu nhập
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Tạo phiếu nhập hàng, quản lý tiền trả NCC, công nợ và tự động cập nhật giá vốn
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition shadow-md shadow-purple-600/30"
        >
          <Plus className="h-4 w-4" />
          Tạo Phiếu Nhập Hàng
        </button>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-200 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã PN, tên nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Table Data */}
      <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-3 w-10 text-center">STT</th>
                <th className="p-3">Mã phiếu</th>
                <th className="p-3">Thời gian</th>
                <th className="p-3">Nhà cung cấp</th>
                <th className="p-3 text-center">Số mặt hàng</th>
                <th className="p-3 text-right">Tổng tiền hàng</th>
                <th className="p-3 text-right">Đã thanh toán</th>
                <th className="p-3 text-right">Ghi nợ NCC</th>
                <th className="p-3">Người nhập</th>
                <th className="p-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    Chưa có phiếu nhập hàng nào. Nhấn <strong>Tạo Phiếu Nhập Hàng</strong> để bắt đầu.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-purple-700">{p.code}</td>
                    <td className="p-3 text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="p-3 font-semibold text-slate-800">{p.supplierName}</td>
                    <td className="p-3 text-center font-medium font-mono">{p.items.length} món</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatVND(p.totalAmount)}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-600 font-semibold">
                      {formatVND(p.paidAmount)}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-600 font-semibold">
                      {formatVND(p.debtAmount)}
                    </td>
                    <td className="p-3 text-slate-600">{p.staffName}</td>
                    <td className="p-3 text-center">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Hoàn thành
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Form Modal */}
      <PurchaseFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          loadPurchases();
          if (onRefreshData) onRefreshData();
        }}
        currentStaff={currentStaff}
      />
    </div>
  );
};
