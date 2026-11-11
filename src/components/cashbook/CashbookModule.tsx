import React, { useState, useEffect } from 'react';
import {
  BadgeDollarSign,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Wallet,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../db/db';
import type { CashTransaction, CashType, CashCategory, Employee } from '../../types';
import { formatVND, formatDate, getVietnamNowISO, generateCode } from '../../utils/formatters';

interface CashbookModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const CashbookModule: React.FC<CashbookModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'thu' | 'chi'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Voucher Creation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<CashType>('thu');
  const [category, setCategory] = useState<CashCategory>('khac');
  const [amount, setAmount] = useState<number>(0);
  const [personName, setPersonName] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const list = await db.cashTransactions.orderBy('id').reverse().toArray();
    setTransactions(list);
  };

  const totalThu = transactions
    .filter((t) => t.type === 'thu')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalChi = transactions
    .filter((t) => t.type === 'chi')
    .reduce((sum, t) => sum + t.amount, 0);

  const cashBalance = totalThu - totalChi;

  const handleOpenVoucher = (type: CashType) => {
    setVoucherType(type);
    setCategory(type === 'thu' ? 'khac' : 'dien_nuoc');
    setAmount(0);
    setPersonName('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    if (!personName.trim()) {
      alert('Vui lòng nhập tên người nộp / nhận tiền.');
      return;
    }

    setIsProcessing(true);
    try {
      const count = await db.cashTransactions.count();
      const code = generateCode(voucherType === 'thu' ? 'PT' : 'PC', count);
      const now = getVietnamNowISO();

      await db.cashTransactions.add({
        code,
        type: voucherType,
        category,
        amount,
        personName: personName.trim(),
        staffName: currentStaff?.name || 'Thu ngân',
        note: note.trim(),
        createdAt: now,
      });

      alert(`Đã lập thành công ${voucherType === 'thu' ? 'Phiếu Thu' : 'Phiếu Chi'} số ${code}!`);
      setIsModalOpen(false);
      await loadTransactions();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getCategoryLabel = (cat: CashCategory) => {
    switch (cat) {
      case 'ban_hang': return 'Thu tiền bán hàng';
      case 'thu_no_khach': return 'Thu nợ khách hàng';
      case 'nhap_hang': return 'Chi tiền nhập hàng';
      case 'tra_no_ncc': return 'Chi trả nợ NCC';
      case 'dien_nuoc': return 'Chi phí điện nước';
      case 'van_hanh': return 'Chi phí vận hành';
      default: return 'Khác';
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
    const term = searchTerm.toLowerCase();
    const matchTerm =
      !searchTerm ||
      t.code.toLowerCase().includes(term) ||
      t.personName.toLowerCase().includes(term) ||
      (t.note && t.note.toLowerCase().includes(term));
    return matchType && matchCat && matchTerm;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BadgeDollarSign className="h-6 w-6 text-sky-600" /> Sổ Quỹ Thu Chi & Tiền Mặt
          </h2>
          <p className="text-xs text-slate-500">
            Quản lý dòng tiền vào ra, lập phiếu thu chi phí hoạt động và đối soát số dư tiền trong két
          </p>
        </div>

        {/* Voucher Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenVoucher('thu')}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition"
          >
            <ArrowDownLeft className="h-4 w-4" />
            + Lập Phiếu Thu
          </button>
          <button
            onClick={() => handleOpenVoucher('chi')}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-600/30 transition"
          >
            <ArrowUpRight className="h-4 w-4" />
            - Lập Phiếu Chi
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Tồn quỹ tiền mặt */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Số dư tồn quỹ tiền mặt</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 font-mono">
            {formatVND(cashBalance)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Tiền mặt thực tế đang có trong két</p>
        </div>

        {/* Tổng Thu */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng tiền thu</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 font-mono">
            {formatVND(totalThu)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Bán hàng, thu nợ, các khoản thu khác</p>
        </div>

        {/* Tổng Chi */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng tiền chi</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 font-mono">
            {formatVND(totalChi)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Tiền nhập hàng, trả nợ NCC, tiền điện nước</p>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        {/* Filter bar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, người nộp/nhận, nội dung..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="all">Tất cả loại phiếu</option>
              <option value="thu">Chỉ phiếu Thu (+)</option>
              <option value="chi">Chỉ phiếu Chi (-)</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="all">Tất cả danh mục thu chi</option>
              <option value="ban_hang">Thu bán hàng</option>
              <option value="thu_no_khach">Thu nợ khách</option>
              <option value="nhap_hang">Chi nhập hàng</option>
              <option value="tra_no_ncc">Chi trả nợ NCC</option>
              <option value="dien_nuoc">Chi phí điện nước</option>
              <option value="van_hanh">Chi phí vận hành</option>
              <option value="khac">Khác</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-3 w-10 text-center">STT</th>
                <th className="p-3">Mã phiếu</th>
                <th className="p-3">Thời gian</th>
                <th className="p-3">Loại phiếu</th>
                <th className="p-3">Danh mục</th>
                <th className="p-3">Người nộp / nhận</th>
                <th className="p-3">Mã chứng từ gốc</th>
                <th className="p-3 text-right">Số tiền</th>
                <th className="p-3">Người thực hiện</th>
                <th className="p-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    Chưa có giao dịch thu chi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{t.code}</td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                    <td className="p-3">
                      {t.type === 'thu' ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Phiếu Thu
                        </span>
                      ) : (
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          Phiếu Chi
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{getCategoryLabel(t.category)}</td>
                    <td className="p-3 font-semibold text-slate-800">{t.personName}</td>
                    <td className="p-3 font-mono text-slate-500">{t.refCode || '-'}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={t.type === 'thu' ? 'text-emerald-600' : 'text-rose-600'}>
                        {t.type === 'thu' ? '+' : '-'}{formatVND(t.amount)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{t.staffName}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{t.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Voucher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              {voucherType === 'thu' ? (
                <>
                  <ArrowDownLeft className="h-5 w-5 text-emerald-600" /> Lập Phiếu Thu Tiền
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-5 w-5 text-rose-600" /> Lập Phiếu Chi Tiền
                </>
              )}
            </h3>

            <form onSubmit={handleCreateVoucher} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Danh mục thu/chi:</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none font-semibold"
                >
                  {voucherType === 'thu' ? (
                    <>
                      <option value="thu_no_khach">Thu nợ khách hàng</option>
                      <option value="khac">Khoản thu khác</option>
                    </>
                  ) : (
                    <>
                      <option value="dien_nuoc">Chi phí điện, nước, internet</option>
                      <option value="van_hanh">Chi phí thuê bao, vận hành, sửa chữa</option>
                      <option value="tra_no_ncc">Chi trả nợ nhà cung cấp</option>
                      <option value="khac">Chi phí khác</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tiền (VNĐ) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-slate-900 text-right outline-none text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {voucherType === 'thu' ? 'Người nộp tiền' : 'Người nhận tiền'}{' '}
                  <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Họ tên người giao dịch..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung / Lý do:</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Tiền điện tháng 10, mua bao xốp đựng hàng..."
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
                  disabled={isProcessing || amount <= 0}
                  className={`rounded-lg px-4 py-1.5 font-bold text-white shadow-md ${
                    voucherType === 'thu' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isProcessing ? 'Đang lưu...' : 'Lưu Chứng Từ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
