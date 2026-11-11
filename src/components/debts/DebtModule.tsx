import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Users,
  Building2,
  DollarSign,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Customer, Supplier, Employee } from '../../types';
import { formatVND, getVietnamNowISO, generateCode } from '../../utils/formatters';

interface DebtModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const DebtModule: React.FC<DebtModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Settle Debt Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<{ id: number; name: string; debt: number; type: 'customer' | 'supplier'; code: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNote, setSettleNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cList, sList] = await Promise.all([
      db.customers.toArray(),
      db.suppliers.toArray(),
    ]);
    setCustomers(cList);
    setSuppliers(sList);
  };

  const totalCustomerDebt = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + (s.totalDebt || 0), 0);

  const handleOpenSettle = (item: { id: number; name: string; debt: number; code: string }, type: 'customer' | 'supplier') => {
    setTargetItem({ ...item, type });
    setSettleAmount(item.debt);
    setSettleNote(type === 'customer' ? 'Thu nợ tiền hàng' : 'Thanh toán tiền hàng cho NCC');
    setIsModalOpen(true);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem || settleAmount <= 0) return;

    setIsProcessing(true);
    try {
      const now = getVietnamNowISO();

      if (targetItem.type === 'customer') {
        // Collect customer debt
        await db.transaction('rw', [db.customers, db.cashTransactions], async () => {
          const cust = await db.customers.get(targetItem.id);
          if (!cust) return;

          const newDebt = Math.max(0, (cust.totalDebt || 0) - settleAmount);
          await db.customers.update(cust.id!, { totalDebt: newDebt });

          const cashCount = await db.cashTransactions.count();
          await db.cashTransactions.add({
            code: generateCode('PT', cashCount),
            type: 'thu',
            category: 'thu_no_khach',
            amount: settleAmount,
            refCode: targetItem.code,
            personName: targetItem.name,
            staffName: currentStaff?.name || 'Thu ngân',
            note: `Thu tiền nợ từ khách hàng ${targetItem.name}: ${settleNote}`,
            createdAt: now,
          });
        });
      } else {
        // Pay supplier debt
        await db.transaction('rw', [db.suppliers, db.cashTransactions], async () => {
          const supp = await db.suppliers.get(targetItem.id);
          if (!supp) return;

          const newDebt = Math.max(0, (supp.totalDebt || 0) - settleAmount);
          await db.suppliers.update(supp.id!, { totalDebt: newDebt });

          const cashCount = await db.cashTransactions.count();
          await db.cashTransactions.add({
            code: generateCode('PC', cashCount),
            type: 'chi',
            category: 'tra_no_ncc',
            amount: settleAmount,
            refCode: targetItem.code,
            personName: targetItem.name,
            staffName: currentStaff?.name || 'Chủ cửa hàng',
            note: `Thanh toán nợ cho nhà cung cấp ${targetItem.name}: ${settleNote}`,
            createdAt: now,
          });
        });
      }

      alert('Đã ghi nhận giao dịch và cập nhật công nợ thành công!');
      setIsModalOpen(false);
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-sky-600" /> Sổ Quản Lý Công Nợ
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi nợ phải thu của khách hàng và nợ phải trả cho nhà cung cấp
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-xs border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
              activeTab === 'customer'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            Nợ Khách Hàng (Phải Thu)
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
              activeTab === 'supplier'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Nợ Nhà Cung Cấp (Phải Trả)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng công nợ khách hàng cần thu</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 font-mono">
            {formatVND(totalCustomerDebt)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {customers.filter((c) => (c.totalDebt || 0) > 0).length} khách hàng đang còn nợ tiền
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng công nợ phải trả nhà cung cấp</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 font-mono">
            {formatVND(totalSupplierDebt)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {suppliers.filter((s) => (s.totalDebt || 0) > 0).length} nhà cung cấp cần thanh toán
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'customer' ? 'Tìm theo tên khách, SĐT...' : 'Tìm theo nhà cung cấp...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Customer Debts Table */}
        {activeTab === 'customer' && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3">Mã khách</th>
                  <th className="p-3">Tên khách hàng</th>
                  <th className="p-3">Số điện thoại</th>
                  <th className="p-3 text-right">Tổng tiền đã mua</th>
                  <th className="p-3 text-right">Công nợ hiện tại</th>
                  <th className="p-3 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{c.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="p-3 text-slate-500">{c.phone || '-'}</td>
                    <td className="p-3 text-right font-mono text-slate-700">
                      {formatVND(c.totalSpent)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      {formatVND(c.totalDebt)}
                    </td>
                    <td className="p-3 text-center">
                      {(c.totalDebt || 0) > 0 ? (
                        <button
                          onClick={() => handleOpenSettle({ id: c.id!, name: c.name, debt: c.totalDebt, code: c.code }, 'customer')}
                          className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                          Thu nợ
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600">Hết nợ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Supplier Debts Table */}
        {activeTab === 'supplier' && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3">Mã NCC</th>
                  <th className="p-3">Tên nhà cung cấp</th>
                  <th className="p-3">Người liên hệ</th>
                  <th className="p-3 text-right">Tổng tiền đã nhập</th>
                  <th className="p-3 text-right">Nợ phải trả</th>
                  <th className="p-3 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{s.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{s.name}</td>
                    <td className="p-3 text-slate-500">{s.contactPerson || s.phone || '-'}</td>
                    <td className="p-3 text-right font-mono text-slate-700">
                      {formatVND(s.totalPurchased)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      {formatVND(s.totalDebt)}
                    </td>
                    <td className="p-3 text-center">
                      {(s.totalDebt || 0) > 0 ? (
                        <button
                          onClick={() => handleOpenSettle({ id: s.id!, name: s.name, debt: s.totalDebt, code: s.code }, 'supplier')}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                        >
                          Trả nợ
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600">Đã hết nợ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Debt Modal */}
      {isModalOpen && targetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-sky-600" />
              {targetItem.type === 'customer' ? 'Lập Phiếu Thu Nợ Khách Hàng' : 'Lập Phiếu Chi Trả Nợ NCC'}
            </h3>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <p>Đối tượng: <strong>{targetItem.name}</strong></p>
              <p className="mt-1">
                Số nợ hiện tại: <strong className="font-mono text-rose-600">{formatVND(targetItem.debt)}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tiền thanh toán (VNĐ) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="1"
                  max={targetItem.debt}
                  required
                  value={settleAmount || ''}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-slate-900 text-right outline-none text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú chứng từ:</label>
                <input
                  type="text"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || settleAmount <= 0}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-bold text-white hover:bg-sky-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Xác Nhận & Lập Phiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
