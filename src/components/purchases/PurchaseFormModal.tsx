import React, { useState, useEffect } from 'react';
import { Truck, X, Plus, Trash2, Check, Search } from 'lucide-react';
import { db, processPurchaseOrder } from '../../db/db';
import type { Product, Supplier, PurchaseItem, Employee } from '../../types';
import { formatVND } from '../../utils/formatters';

interface PurchaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentStaff: Employee | null;
}

export const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentStaff,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  const loadData = async () => {
    const [suppList, prodList] = await Promise.all([
      db.suppliers.toArray(),
      db.products.where('status').equals('active').toArray(),
    ]);
    setSuppliers(suppList);
    setProducts(prodList);
    if (suppList.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppList[0].id);
    }
  };

  const resetForm = () => {
    setItems([]);
    setPaidAmount(0);
    setNote('');
  };

  if (!isOpen) return null;

  const handleAddItem = (prod: Product) => {
    const existingIdx = items.findIndex((i) => i.productId === prod.id);
    if (existingIdx > -1) {
      const updated = [...items];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].costPrice;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          unit: prod.unit,
          costPrice: prod.costPrice || 0,
          quantity: 10,
          total: (prod.costPrice || 0) * 10,
        },
      ]);
    }
    setProductSearch('');
  };

  const handleUpdateItem = (idx: number, field: 'quantity' | 'costPrice', val: number) => {
    const updated = [...items];
    const it = updated[idx];
    if (field === 'quantity') it.quantity = Math.max(1, val);
    if (field === 'costPrice') it.costPrice = Math.max(0, val);
    it.total = it.quantity * it.costPrice;
    setItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((sum, i) => sum + i.total, 0);
  const debtAmount = Math.max(0, totalAmount - paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một sản phẩm vào phiếu nhập.');
      return;
    }
    const supp = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supp) {
      alert('Vui lòng chọn Nhà cung cấp.');
      return;
    }

    setIsProcessing(true);
    try {
      await processPurchaseOrder({
        supplierId: supp.id,
        supplierName: supp.name,
        items,
        totalAmount,
        paidAmount,
        debtAmount,
        status: 'completed',
        staffId: currentStaff?.id || 1,
        staffName: currentStaff?.name || 'Chủ cửa hàng',
        note: note.trim(),
      });

      alert('Đã hoàn tất nhập kho và cập nhật giá vốn bình quân cho sản phẩm!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Lỗi nhập hàng: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProdSearch = products.filter(
    (p) =>
      productSearch &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode.includes(productSearch))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Tạo Phiếu Nhập Hàng Mới</h3>
              <p className="text-xs text-slate-500">Tự động tăng tồn kho và tính lại giá vốn bình quân gia quyền</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Supplier select & Search products */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nhà cung cấp <span className="text-rose-500">*</span>:
              </label>
              <select
                required
                value={selectedSupplierId || ''}
                onChange={(e) => setSelectedSupplierId(parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none focus:border-purple-500 font-medium"
              >
                <option value="">-- Chọn Nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - Đang nợ: {formatVND(s.totalDebt)}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Quick Search */}
            <div className="relative">
              <label className="block font-semibold text-slate-700 mb-1">
                Tìm sản phẩm thêm vào phiếu:
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Gõ tên sản phẩm, mã hàng để chọn nhanh..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Suggestions Popup */}
              {productSearch && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl bg-white shadow-xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {filteredProdSearch.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy sản phẩm</div>
                  ) : (
                    filteredProdSearch.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        className="p-2.5 hover:bg-purple-50 cursor-pointer flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <span className="text-[10px] text-slate-400">Tồn hiện tại: {p.stock} {p.unit}</span>
                        </div>
                        <span className="font-mono font-bold text-purple-700">
                          {formatVND(p.costPrice)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3 text-center">ĐVT</th>
                  <th className="p-3 text-center w-28">Số lượng nhập</th>
                  <th className="p-3 text-right w-36">Giá nhập (VNĐ)</th>
                  <th className="p-3 text-right">Thành tiền</th>
                  <th className="p-3 text-center w-12">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Chưa có sản phẩm nào trong phiếu nhập. Hãy tìm và chọn sản phẩm ở ô trên.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold text-slate-800">{it.productName}</p>
                        <span className="text-[10px] font-mono text-slate-400">{it.productCode}</span>
                      </td>
                      <td className="p-3 text-center font-medium">{it.unit}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-20 rounded border border-slate-300 p-1 text-center font-bold font-mono outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={it.costPrice}
                          onChange={(e) => handleUpdateItem(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                          className="w-28 rounded border border-slate-300 p-1 text-right font-bold font-mono outline-none"
                        />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatVND(it.total)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Details */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ghi chú phiếu nhập:</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Nhập đợt cuối tuần, lô sản xuất tháng 10..."
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-bold text-sm text-slate-800">
                <span>Tổng tiền hàng nhập:</span>
                <span className="font-mono text-purple-700">{formatVND(totalAmount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Đã thanh toán cho NCC:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-32 rounded border border-slate-300 p-1 text-right font-bold font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPaidAmount(totalAmount)}
                    className="rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                  >
                    Đủ
                  </button>
                </div>
              </div>

              <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-rose-700">
                <span>Ghi nợ nhà cung cấp:</span>
                <span className="font-mono">{formatVND(debtAmount)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isProcessing || items.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isProcessing ? 'Đang cập nhật kho...' : 'Hoàn Tất Nhập Hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
