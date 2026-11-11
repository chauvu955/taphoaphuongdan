import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Check,
  X,
  CreditCard,
  History,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Customer, Order, Employee } from '../../types';
import { formatVND, formatDate, getVietnamNowISO, generateCode } from '../../utils/formatters';

interface CustomerModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const CustomerModule: React.FC<CustomerModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // Customer Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNote, setCustNote] = useState('');

  // Debt Payment Modal
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtPayAmount, setDebtPayAmount] = useState<number>(0);
  const [debtPayNote, setDebtPayNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const list = await db.customers.toArray();
    setCustomers(list);
    if (list.length > 0 && !selectedCustomer) {
      handleSelectCustomer(list[0]);
    }
  };

  const handleSelectCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    if (c.id) {
      const orders = await db.orders.where('customerId').equals(c.id).reverse().toArray();
      setCustomerOrders(orders);
    }
  };

  const handleOpenForm = (c?: Customer) => {
    if (c) {
      setEditingCust(c);
      setCustName(c.name);
      setCustPhone(c.phone || '');
      setCustAddress(c.address || '');
      setCustNote(c.note || '');
    } else {
      setEditingCust(null);
      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustNote('');
    }
    setIsFormOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      alert('Vui lòng nhập tên khách hàng.');
      return;
    }

    setIsProcessing(true);
    try {
      if (editingCust && editingCust.id) {
        await db.customers.update(editingCust.id, {
          name: custName.trim(),
          phone: custPhone.trim(),
          address: custAddress.trim(),
          note: custNote.trim(),
        });
      } else {
        const count = await db.customers.count();
        const code = generateCode('KH', count);
        await db.customers.add({
          code,
          name: custName.trim(),
          phone: custPhone.trim(),
          address: custAddress.trim(),
          note: custNote.trim(),
          totalSpent: 0,
          totalDebt: 0,
          createdAt: getVietnamNowISO(),
        });
      }

      setIsFormOpen(false);
      await loadCustomers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi lưu khách hàng: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedCustomer.id) return;
    if (debtPayAmount <= 0) {
      alert('Vui lòng nhập số tiền trả nợ hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.cashTransactions], async () => {
        const cust = await db.customers.get(selectedCustomer.id!);
        if (!cust) return;

        const newDebt = Math.max(0, (cust.totalDebt || 0) - debtPayAmount);
        await db.customers.update(cust.id!, {
          totalDebt: newDebt,
        });

        // Record Cash Receipt (Phiếu thu nợ khách - không tính vào doanh thu bán hàng)
        const cashCount = await db.cashTransactions.count();
        const now = getVietnamNowISO();
        await db.cashTransactions.add({
          code: generateCode('PT', cashCount),
          type: 'thu',
          category: 'thu_no_khach',
          amount: debtPayAmount,
          refCode: cust.code,
          personName: cust.name,
          staffName: currentStaff?.name || 'Thu ngân',
          note: `Thu tiền nợ khách hàng ${cust.name} (${cust.code}): ${debtPayNote || 'Trả nợ tiền hàng'}`,
          createdAt: now,
        });
      });

      alert(`Đã thu ${formatVND(debtPayAmount)} tiền nợ từ khách hàng và ghi sổ quỹ!`);
      setIsDebtModalOpen(false);
      setDebtPayAmount(0);
      setDebtPayNote('');
      await loadCustomers();
      const updated = await db.customers.get(selectedCustomer.id!);
      if (updated) setSelectedCustomer(updated);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  });

  const totalAllDebt = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 p-5 select-none gap-4">
      {/* Left List */}
      <div className="w-5/12 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-600" /> Danh Sách Khách Hàng
            </h2>
            <span className="text-xs text-rose-600 font-semibold">
              Tổng công nợ cần thu: {formatVND(totalAllDebt)}
            </span>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Thêm Khách
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, mã khách..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Customer Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Chưa có khách hàng nào.
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              const hasDebt = (c.totalDebt || 0) > 0;

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-50 border-l-4 border-sky-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{c.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{c.code}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      {c.phone && <span>{c.phone}</span>}
                      {c.address && <span>• {c.address}</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    {hasDebt ? (
                      <div className="rounded bg-rose-50 px-2 py-0.5 border border-rose-200">
                        <span className="text-[10px] text-rose-600 block leading-tight">Nợ:</span>
                        <span className="font-mono font-bold text-xs text-rose-700">
                          {formatVND(c.totalDebt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600">Hết nợ</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail Pane */}
      <div className="w-7/12 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {selectedCustomer ? (
          <>
            {/* Top Customer Info Strip */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-extrabold text-slate-800">{selectedCustomer.name}</h3>
                  <span className="rounded font-mono font-bold text-xs bg-slate-200 px-2 py-0.5 text-slate-700">
                    {selectedCustomer.code}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  {selectedCustomer.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedCustomer.phone}</span>
                    </p>
                  )}
                  {selectedCustomer.address && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedCustomer.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenForm(selectedCustomer)}
                  className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                  title="Sửa thông tin khách"
                >
                  <Edit className="h-4 w-4" />
                </button>
                {(selectedCustomer.totalDebt || 0) > 0 && (
                  <button
                    onClick={() => {
                      setDebtPayAmount(selectedCustomer.totalDebt || 0);
                      setIsDebtModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-500 transition"
                  >
                    <DollarSign className="h-4 w-4" />
                    Thu Tiền Nợ
                  </button>
                )}
              </div>
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-2 gap-4 p-5 border-b border-slate-200 bg-white">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Tổng tiền đã mua hàng</span>
                <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                  {formatVND(selectedCustomer.totalSpent)}
                </div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3.5 border border-rose-200">
                <span className="text-xs text-rose-600 font-semibold">Công nợ hiện tại</span>
                <div className="mt-1 text-lg font-extrabold font-mono text-rose-700">
                  {formatVND(selectedCustomer.totalDebt)}
                </div>
              </div>
            </div>

            {/* Purchase History */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                <History className="h-4 w-4 text-sky-600" /> Lịch Sử Mua Hàng ({customerOrders.length} hóa đơn)
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3">Mã HD</th>
                      <th className="p-3">Ngày giờ</th>
                      <th className="p-3 text-right">Tổng tiền</th>
                      <th className="p-3 text-right">Đã trả</th>
                      <th className="p-3 text-right">Ghi nợ</th>
                      <th className="p-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Khách hàng này chưa có đơn mua hàng nào.
                        </td>
                      </tr>
                    ) : (
                      customerOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-sky-700">{ord.code}</td>
                          <td className="p-3 text-slate-500">{formatDate(ord.createdAt)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatVND(ord.finalAmount)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {formatVND(ord.paidAmount)}
                          </td>
                          <td className="p-3 text-right font-mono text-rose-600">
                            {formatVND(ord.debtAmount)}
                          </td>
                          <td className="p-3 text-center">
                            {ord.status === 'cancelled' ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                Đã hủy
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Hoàn tất
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            Chọn một khách hàng từ danh sách để xem chi tiết
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {editingCust ? 'Cập Nhật Khách Hàng' : 'Thêm Khách Hàng Mới'}
            </h3>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Họ tên khách hàng <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="VD: Anh Hải Tiệm Tạp Hóa"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="VD: 0908 112 233"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ:</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="VD: Số 45 Hẻm 12..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú:</label>
                <input
                  type="text"
                  value={custNote}
                  onChange={(e) => setCustNote(e.target.value)}
                  placeholder="Thói quen mua hàng, hạn nợ..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-bold text-white hover:bg-sky-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Lưu Khách Hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Payment Modal */}
      {isDebtModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 text-rose-600">
              <DollarSign className="h-5 w-5" /> Thu Tiền Nợ Khách Hàng
            </h3>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs text-rose-900">
              <p>Khách hàng: <strong>{selectedCustomer.name}</strong></p>
              <p className="mt-1">
                Công nợ hiện tại: <strong className="font-mono text-sm">{formatVND(selectedCustomer.totalDebt)}</strong>
              </p>
            </div>

            <form onSubmit={handlePayDebt} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tiền khách thanh toán (VNĐ) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCustomer.totalDebt}
                  required
                  value={debtPayAmount || ''}
                  onChange={(e) => setDebtPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-rose-700 text-right outline-none text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú thu nợ:</label>
                <input
                  type="text"
                  value={debtPayNote}
                  onChange={(e) => setDebtPayNote(e.target.value)}
                  placeholder="VD: Trả tiền hóa đơn mua tuần trước..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || debtPayAmount <= 0}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 font-bold text-white hover:bg-rose-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Xác Nhận Thu Nợ & Lập Phiếu Thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
