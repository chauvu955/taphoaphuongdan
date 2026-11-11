import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  Minus,
  Search,
  ClipboardCheck,
  History,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Product, InventoryTransaction, Employee } from '../../types';
import { formatVND, formatDate, getVietnamNowISO, generateCode } from '../../utils/formatters';

interface InventoryModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [activeSubTab, setActiveSubTab] = useState<'balance' | 'ledger' | 'audit'>('balance');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'set'>('in');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Stock Audit State
  const [auditItems, setAuditItems] = useState<{ [productId: number]: number }>({});
  const [auditNotes, setAuditNotes] = useState<{ [productId: number]: string }>({});
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pList, tList] = await Promise.all([
      db.products.toArray(),
      db.inventoryTransactions.orderBy('id').reverse().limit(200).toArray(),
    ]);
    setProducts(pList);
    setTransactions(tList);
  };

  const handleOpenAdjust = (prod: Product) => {
    setSelectedProduct(prod);
    setAdjustType('in');
    setAdjustQty(1);
    setAdjustReason('Nhập bù kiểm kho');
    setIsAdjustOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProduct.id) return;
    if (!adjustReason.trim()) {
      alert('Vui lòng nhập lý do điều chỉnh kho.');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.products, db.inventoryTransactions], async () => {
        const prod = await db.products.get(selectedProduct.id!);
        if (!prod) return;

        const oldStock = prod.stock;
        let newStock = oldStock;
        let change = 0;

        if (adjustType === 'in') {
          change = adjustQty;
          newStock = oldStock + adjustQty;
        } else if (adjustType === 'out') {
          change = -adjustQty;
          newStock = oldStock - adjustQty;
        } else {
          // 'set' exact
          change = adjustQty - oldStock;
          newStock = adjustQty;
        }

        const now = getVietnamNowISO();
        await db.products.update(prod.id!, {
          stock: newStock,
          updatedAt: now,
        });

        const txCount = await db.inventoryTransactions.count();
        await db.inventoryTransactions.add({
          code: generateCode('DCK', txCount),
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: adjustType === 'in' ? 'stock_in' : adjustType === 'out' ? 'stock_out' : 'adjustment',
          quantityChange: change,
          stockBefore: oldStock,
          stockAfter: newStock,
          unit: prod.unit,
          reason: adjustReason.trim(),
          staffName: currentStaff?.name || 'Quản lý kho',
          createdAt: now,
        });
      });

      alert('Đã cập nhật tồn kho và ghi lại thẻ kho thành công!');
      setIsAdjustOpen(false);
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Stock Audit Balanced Execution
  const handleBalanceStockAudit = async () => {
    const diffProducts = products.filter((p) => {
      const actual = auditItems[p.id!];
      return actual !== undefined && actual !== p.stock;
    });

    if (diffProducts.length === 0) {
      alert('Tất cả số lượng thực tế đều khớp với số lượng trên phần mềm. Không có chênh lệch!');
      setIsAuditing(false);
      return;
    }

    const confirmAudit = window.confirm(
      `Phát hiện ${diffProducts.length} mặt hàng có chênh lệch tồn. Bạn có chắc chắn muốn cân bằng kho tự động và ghi sổ thẻ kho?`
    );
    if (!confirmAudit) return;

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.products, db.inventoryTransactions, db.stockChecks], async () => {
        const now = getVietnamNowISO();
        let currentTx = await db.inventoryTransactions.count();
        const auditLogItems: any[] = [];

        for (const prod of diffProducts) {
          const actual = auditItems[prod.id!];
          const oldStock = prod.stock;
          const diff = actual - oldStock;
          const note = auditNotes[prod.id!] || 'Cân bằng sau đợt kiểm kho';

          await db.products.update(prod.id!, {
            stock: actual,
            updatedAt: now,
          });

          currentTx++;
          await db.inventoryTransactions.add({
            code: generateCode('KK', currentTx),
            productId: prod.id!,
            productCode: prod.code,
            productName: prod.name,
            type: 'audit',
            quantityChange: diff,
            stockBefore: oldStock,
            stockAfter: actual,
            unit: prod.unit,
            reason: `Kiểm kê kho: ${note} (Lệch ${diff > 0 ? '+' : ''}${diff})`,
            staffName: currentStaff?.name || 'Quản lý',
            createdAt: now,
          });

          auditLogItems.push({
            productId: prod.id!,
            productCode: prod.code,
            productName: prod.name,
            unit: prod.unit,
            systemStock: oldStock,
            actualStock: actual,
            difference: diff,
            note,
          });
        }

        const checkCount = await db.stockChecks.count();
        await db.stockChecks.add({
          code: generateCode('KK', checkCount),
          items: auditLogItems,
          totalDifference: diffProducts.length,
          staffName: currentStaff?.name || 'Quản lý',
          status: 'balanced',
          note: 'Đợt kiểm kê định kỳ',
          createdAt: now,
        });
      });

      alert('Đã cân bằng kho và lưu lịch sử kiểm kê thành công!');
      setIsAuditing(false);
      setAuditItems({});
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi cân bằng kho: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Inventory value calculations
  const totalStockQty = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalStockCostValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0);
  const totalStockRetailValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.sellingPrice || 0), 0);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Quản Lý Tồn Kho & Thẻ Kho
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi tồn kho thực tế, lịch sử xuất nhập tồn và đối soát kiểm kê kho
          </p>
        </div>

        {/* Sub-tabs buttons */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-xs border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('balance')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'balance'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tồn Kho Hiện Tại
          </button>
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'ledger'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Thẻ Kho (Lịch Sử)
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'audit'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kiểm Kho (Đối Soát)
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-3.5 shadow-xs border border-slate-200">
          <span className="text-xs font-semibold text-slate-500">Tổng số lượng tồn kho</span>
          <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono">
            {totalStockQty.toLocaleString()} đơn vị
          </div>
        </div>
        <div className="rounded-xl bg-white p-3.5 shadow-xs border border-slate-200">
          <span className="text-xs font-semibold text-slate-500">Giá trị tồn theo giá vốn</span>
          <div className="mt-1 text-xl font-extrabold text-sky-700 font-mono">
            {formatVND(totalStockCostValue)}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3.5 shadow-xs border border-slate-200">
          <span className="text-xs font-semibold text-slate-500">Giá trị tồn theo giá bán</span>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 font-mono">
            {formatVND(totalStockRetailValue)}
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: Tồn Kho Hiện Tại */}
      {activeSubTab === 'balance' && (
        <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="relative w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm sản phẩm cần xem tồn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3">ĐVT</th>
                  <th className="p-3 text-center">Tồn kho</th>
                  <th className="p-3 text-right">Giá vốn</th>
                  <th className="p-3 text-right">Giá trị vốn tồn</th>
                  <th className="p-3 text-center">Mức cảnh báo</th>
                  <th className="p-3 text-center w-28">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{p.code}</td>
                      <td className="p-3 font-medium text-slate-800">{p.name}</td>
                      <td className="p-3">{p.unit}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            p.stock <= 0
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'text-slate-800'
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatVND(p.costPrice)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-sky-800">
                        {formatVND((p.stock || 0) * (p.costPrice || 0))}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{p.minStock}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleOpenAdjust(p)}
                          className="rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Điều chỉnh
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Thẻ Kho (Lịch Sử Giao Dịch Kho) */}
      {activeSubTab === 'ledger' && (
        <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50 text-xs text-slate-600 flex justify-between items-center">
            <span>
              Lưu vết đầy đủ mọi giao dịch bán hàng, hủy đơn, nhập hàng và điều chỉnh kho
            </span>
            <span className="font-bold text-slate-700">{transactions.length} giao dịch gần nhất</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Mã phiếu</th>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3 text-center">Thay đổi</th>
                  <th className="p-3 text-center">Tồn trước</th>
                  <th className="p-3 text-center">Tồn sau</th>
                  <th className="p-3">Lý do giao dịch</th>
                  <th className="p-3">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      Chưa có giao dịch kho nào.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                      <td className="p-3 font-mono font-bold text-sky-700">{tx.code}</td>
                      <td className="p-3 font-mono text-slate-600">{tx.productCode}</td>
                      <td className="p-3 font-medium text-slate-800">{tx.productName}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={
                            tx.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }
                        >
                          {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}{' '}
                          {tx.unit}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{tx.stockBefore}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {tx.stockAfter}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{tx.reason}</td>
                      <td className="p-3 text-slate-500">{tx.staffName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Kiểm Kho (Audit & Balance) */}
      {activeSubTab === 'audit' && (
        <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div className="text-xs text-slate-600">
              Nhập số lượng thực tế kiểm đếm được tại quầy để hệ thống tính chênh lệch và tự động cân bằng kho.
            </div>
            <button
              onClick={handleBalanceStockAudit}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              Cân Bằng Kho Tự Động
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3 text-center">ĐVT</th>
                  <th className="p-3 text-center">Tồn phần mềm</th>
                  <th className="p-3 text-center w-36">Thực tế kiểm kê</th>
                  <th className="p-3 text-center">Chênh lệch</th>
                  <th className="p-3">Ghi chú kiểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const actual = auditItems[p.id!] ?? p.stock;
                  const diff = actual - p.stock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{p.code}</td>
                      <td className="p-3 font-medium text-slate-800">{p.name}</td>
                      <td className="p-3 text-center">{p.unit}</td>
                      <td className="p-3 text-center font-mono font-bold">{p.stock}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          value={actual}
                          onChange={(e) =>
                            setAuditItems({
                              ...auditItems,
                              [p.id!]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 rounded border border-slate-300 p-1 text-center font-bold font-mono outline-none focus:border-sky-500"
                        />
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={
                            diff === 0
                              ? 'text-slate-400'
                              : diff > 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="Lý do chênh lệch (nếu có)..."
                          value={auditNotes[p.id!] || ''}
                          onChange={(e) =>
                            setAuditNotes({ ...auditNotes, [p.id!]: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 p-1 text-xs outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Điều Chỉnh Kho: {selectedProduct.name}
            </h3>

            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span>Tồn hiện tại: </span>
              <strong className="font-mono text-sky-700">{selectedProduct.stock} {selectedProduct.unit}</strong>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại điều chỉnh:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('in')}
                    className={`py-1.5 rounded-lg font-semibold transition ${
                      adjustType === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
                    }`}
                  >
                    + Nhập thêm
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('out')}
                    className={`py-1.5 rounded-lg font-semibold transition ${
                      adjustType === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-100'
                    }`}
                  >
                    - Xuất hủy/trả
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('set')}
                    className={`py-1.5 rounded-lg font-semibold transition ${
                      adjustType === 'set' ? 'bg-sky-600 text-white' : 'bg-slate-100'
                    }`}
                  >
                    = Đặt tồn mới
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số lượng:</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-center outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do điều chỉnh <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="VD: Hàng hỏng vỡ, kiểm đếm lại quầy..."
                  className="w-full rounded-lg border border-slate-300 p-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-bold text-white hover:bg-sky-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Xác Nhận & Ghi Sổ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
