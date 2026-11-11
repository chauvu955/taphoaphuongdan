import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Check,
  X,
  DollarSign,
  History,
  Truck,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Supplier, PurchaseOrder, Employee } from '../../types';
import { formatVND, formatDate, getVietnamNowISO, generateCode } from '../../utils/formatters';

interface SupplierModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const SupplierModule: React.FC<SupplierModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrder[]>([]);

  // Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<Supplier | null>(null);
  const [suppName, setSuppName] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppContactPerson, setSuppContactPerson] = useState('');
  const [suppNote, setSuppNote] = useState('');

  // Pay Supplier Debt Modal
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const list = await db.suppliers.toArray();
    setSuppliers(list);
    if (list.length > 0 && !selectedSupplier) {
      handleSelectSupplier(list[0]);
    }
  };

  const handleSelectSupplier = async (s: Supplier) => {
    setSelectedSupplier(s);
    if (s.id) {
      const pList = await db.purchaseOrders.where('supplierId').equals(s.id).reverse().toArray();
      setPurchaseHistory(pList);
    }
  };

  const handleOpenForm = (s?: Supplier) => {
    if (s) {
      setEditingSupp(s);
      setSuppName(s.name);
      setSuppPhone(s.phone || '');
      setSuppAddress(s.address || '');
      setSuppContactPerson(s.contactPerson || '');
      setSuppNote(s.note || '');
    } else {
      setEditingSupp(null);
      setSuppName('');
      setSuppPhone('');
      setSuppAddress('');
      setSuppContactPerson('');
      setSuppNote('');
    }
    setIsFormOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim()) {
      alert('Vui lòng nhập tên nhà cung cấp.');
      return;
    }

    setIsProcessing(true);
    try {
      if (editingSupp && editingSupp.id) {
        await db.suppliers.update(editingSupp.id, {
          name: suppName.trim(),
          phone: suppPhone.trim(),
          address: suppAddress.trim(),
          contactPerson: suppContactPerson.trim(),
          note: suppNote.trim(),
        });
      } else {
        const count = await db.suppliers.count();
        const code = generateCode('NCC', count);
        await db.suppliers.add({
          code,
          name: suppName.trim(),
          phone: suppPhone.trim(),
          address: suppAddress.trim(),
          contactPerson: suppContactPerson.trim(),
          note: suppNote.trim(),
          totalPurchased: 0,
          totalDebt: 0,
          createdAt: getVietnamNowISO(),
        });
      }

      setIsFormOpen(false);
      await loadSuppliers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi lưu nhà cung cấp: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaySupplierDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedSupplier.id) return;
    if (payAmount <= 0) {
      alert('Vui lòng nhập số tiền thanh toán hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.suppliers, db.cashTransactions], async () => {
        const supp = await db.suppliers.get(selectedSupplier.id!);
        if (!supp) return;

        const newDebt = Math.max(0, (supp.totalDebt || 0) - payAmount);
        await db.suppliers.update(supp.id!, {
          totalDebt: newDebt,
        });

        // Record Cash Outflow (Phiếu chi tiền trả nợ NCC)
        const cashCount = await db.cashTransactions.count();
        const now = getVietnamNowISO();
        await db.cashTransactions.add({
          code: generateCode('PC', cashCount),
          type: 'chi',
          category: 'tra_no_ncc',
          amount: payAmount,
          refCode: supp.code,
          personName: supp.name,
          staffName: currentStaff?.name || 'Chủ cửa hàng',
          note: `Thanh toán nợ cho nhà cung cấp ${supp.name} (${supp.code}): ${payNote || 'Chi trả nợ tiền hàng'}`,
          createdAt: now,
        });
      });

      alert(`Đã lập phiếu chi trả ${formatVND(payAmount)} cho nhà cung cấp ${selectedSupplier.name}!`);
      setIsPayDebtModalOpen(false);
      setPayAmount(0);
      setPayNote('');
      await loadSuppliers();
      const updated = await db.suppliers.get(selectedSupplier.id!);
      if (updated) setSelectedSupplier(updated);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.code.toLowerCase().includes(term) ||
      (s.phone && s.phone.includes(term))
    );
  });

  const totalAllDebt = suppliers.reduce((sum, s) => sum + (s.totalDebt || 0), 0);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 p-5 select-none gap-4">
      {/* Left List */}
      <div className="w-5/12 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" /> Nhà Cung Cấp
            </h2>
            <span className="text-xs text-amber-600 font-semibold">
              Tổng nợ phải trả NCC: {formatVND(totalAllDebt)}
            </span>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Thêm NCC
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên, SĐT, mã nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Suppliers List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Chưa có nhà cung cấp nào.
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const isSelected = selectedSupplier?.id === s.id;
              const hasDebt = (s.totalDebt || 0) > 0;

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSupplier(s)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-50 border-l-4 border-purple-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{s.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{s.code}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      {s.phone && <span>{s.phone}</span>}
                      {s.contactPerson && <span>• LH: {s.contactPerson}</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    {hasDebt ? (
                      <div className="rounded bg-amber-50 px-2 py-0.5 border border-amber-200">
                        <span className="text-[10px] text-amber-700 block leading-tight">Nợ:</span>
                        <span className="font-mono font-bold text-xs text-amber-800">
                          {formatVND(s.totalDebt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600">Đã hết nợ</span>
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
        {selectedSupplier ? (
          <>
            {/* Top Info */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-extrabold text-slate-800">{selectedSupplier.name}</h3>
                  <span className="rounded font-mono font-bold text-xs bg-slate-200 px-2 py-0.5 text-slate-700">
                    {selectedSupplier.code}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  {selectedSupplier.contactPerson && (
                    <p>Người liên hệ: <strong>{selectedSupplier.contactPerson}</strong></p>
                  )}
                  {selectedSupplier.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedSupplier.phone}</span>
                    </p>
                  )}
                  {selectedSupplier.address && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedSupplier.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenForm(selectedSupplier)}
                  className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                  title="Sửa thông tin NCC"
                >
                  <Edit className="h-4 w-4" />
                </button>
                {(selectedSupplier.totalDebt || 0) > 0 && (
                  <button
                    onClick={() => {
                      setPayAmount(selectedSupplier.totalDebt || 0);
                      setIsPayDebtModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-500 transition"
                  >
                    <DollarSign className="h-4 w-4" />
                    Thanh Toán Nợ NCC
                  </button>
                )}
              </div>
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-2 gap-4 p-5 border-b border-slate-200 bg-white">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Tổng tiền hàng đã nhập</span>
                <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                  {formatVND(selectedSupplier.totalPurchased)}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-200">
                <span className="text-xs text-amber-700 font-semibold">Công nợ phải trả</span>
                <div className="mt-1 text-lg font-extrabold font-mono text-amber-800">
                  {formatVND(selectedSupplier.totalDebt)}
                </div>
              </div>
            </div>

            {/* Purchase History */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600" /> Lịch Sử Nhập Hàng ({purchaseHistory.length} phiếu)
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3">Mã phiếu</th>
                      <th className="p-3">Ngày nhập</th>
                      <th className="p-3 text-right">Tổng tiền</th>
                      <th className="p-3 text-right">Đã thanh toán</th>
                      <th className="p-3 text-right">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Chưa có lịch sử nhập hàng từ nhà cung cấp này.
                        </td>
                      </tr>
                    ) : (
                      purchaseHistory.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-purple-700">{po.code}</td>
                          <td className="p-3 text-slate-500">{formatDate(po.createdAt)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatVND(po.totalAmount)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {formatVND(po.paidAmount)}
                          </td>
                          <td className="p-3 text-right font-mono text-amber-700">
                            {formatVND(po.debtAmount)}
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
            Chọn một nhà cung cấp từ danh sách để xem chi tiết
          </div>
        )}
      </div>

      {/* Supplier Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {editingSupp ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
            </h3>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên nhà cung cấp / Tổng kho <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  placeholder="VD: Tổng kho Bánh kẹo Đại Nam"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại liên hệ:</label>
                <input
                  type="text"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  placeholder="VD: 028 3899 9888"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người đại diện / Sale liên hệ:</label>
                <input
                  type="text"
                  value={suppContactPerson}
                  onChange={(e) => setSuppContactPerson(e.target.value)}
                  placeholder="VD: Anh Nam Giao hàng"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ kho hàng:</label>
                <input
                  type="text"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  placeholder="VD: Kho hàng KCN Tân Bình"
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-purple-500"
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
                  className="rounded-lg bg-purple-600 px-4 py-1.5 font-bold text-white hover:bg-purple-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Lưu Nhà Cung Cấp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Debt Payment Modal */}
      {isPayDebtModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 text-amber-700">
              <DollarSign className="h-5 w-5" /> Thanh Toán Nợ Nhà Cung Cấp
            </h3>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
              <p>Nhà cung cấp: <strong>{selectedSupplier.name}</strong></p>
              <p className="mt-1">
                Công nợ còn phải trả: <strong className="font-mono text-sm">{formatVND(selectedSupplier.totalDebt)}</strong>
              </p>
            </div>

            <form onSubmit={handlePaySupplierDebt} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tiền thanh toán cho NCC (VNĐ) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedSupplier.totalDebt}
                  required
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-amber-800 text-right outline-none text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú thanh toán:</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="VD: Chuyển khoản thanh toán đợt giao thứ 6..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayDebtModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || payAmount <= 0}
                  className="rounded-lg bg-amber-600 px-4 py-1.5 font-bold text-white hover:bg-amber-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Lập Phiếu Chi & Trừ Nợ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
