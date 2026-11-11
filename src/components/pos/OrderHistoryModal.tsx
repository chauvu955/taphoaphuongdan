import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Search,
  Printer,
  Ban,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Eye,
} from 'lucide-react';
import { db, cancelOrder } from '../../db/db';
import type { Order, StoreSettings, Employee } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';
import { PrintReceipt } from '../common/PrintReceipt';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings | null;
  currentStaff: Employee | null;
  onOrderUpdated: () => void;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentStaff,
  onOrderUpdated,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    const list = await db.orders.orderBy('id').reverse().limit(50).toArray();
    setOrders(list);
    if (list.length > 0 && !selectedOrder) {
      setSelectedOrder(list[0]);
    }
  };

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.code.toLowerCase().includes(term) ||
      (o.customerName && o.customerName.toLowerCase().includes(term)) ||
      (o.customerPhone && o.customerPhone.includes(term)) ||
      (o.staffName && o.staffName.toLowerCase().includes(term))
    );
  });

  const handlePrint = (order: Order) => {
    setSelectedOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrder || !selectedOrder.id) return;
    if (!cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy hóa đơn.');
      return;
    }

    // Permission check
    const canCancel = currentStaff?.role === 'owner' || currentStaff?.permissions.cancelOrder;
    if (!canCancel) {
      alert('Bạn không có quyền hủy hóa đơn. Chỉ Chủ cửa hàng hoặc Quản lý được phân quyền mới có thể hủy!');
      return;
    }

    setIsProcessing(true);
    try {
      await cancelOrder(selectedOrder.id, cancelReason.trim(), currentStaff?.name || 'Nhân viên');
      setNotification(`Đã hủy thành công hóa đơn ${selectedOrder.code}. Tồn kho và tiền đã được hoàn lại.`);
      setCancelModalOpen(false);
      setCancelReason('');
      await loadOrders();
      const updated = await db.orders.get(selectedOrder.id);
      if (updated) setSelectedOrder(updated);
      onOrderUpdated();
    } catch (err: any) {
      alert('Lỗi hủy hóa đơn: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Lịch Sử Hóa Đơn Bán Hàng</h3>
              <p className="text-xs text-slate-500">Xem lại, in lại hoặc hủy hóa đơn bán</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {notification && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{notification}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Order List */}
          <div className="w-1/2 border-r border-slate-200 flex flex-col bg-slate-50">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm mã HD, khách hàng, số điện thoại..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            {/* Orders scroll list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Không tìm thấy hóa đơn nào phù hợp.
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  const isCancelled = ord.status === 'cancelled';
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`p-3 cursor-pointer transition ${
                        isSelected
                          ? 'bg-sky-50 border-l-4 border-sky-600'
                          : 'bg-white hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-800 font-mono">
                          {ord.code}
                        </span>
                        <span className="font-bold text-xs text-sky-700">
                          {formatVND(ord.finalAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{ord.customerName || 'Khách lẻ'}</span>
                        <span>{formatDate(ord.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Thu ngân: {ord.staffName}</span>
                        {isCancelled ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Hoàn thành
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Order Detail & Actions */}
          <div className="w-1/2 flex flex-col bg-white">
            {selectedOrder ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-100">
                  <div className="bg-white p-3 rounded-xl shadow border border-slate-200 w-full max-w-sm">
                    {selectedOrder.status === 'cancelled' && (
                      <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                        <p className="font-bold flex items-center gap-1">
                          <Ban className="h-4 w-4" /> HÓA ĐƠN ĐÃ HỦY
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          Lý do: {selectedOrder.cancelReason || 'Không ghi nhận lý do'}
                        </p>
                      </div>
                    )}
                    <PrintReceipt order={selectedOrder} settings={settings} />
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div className="border-t border-slate-200 bg-white p-3.5 flex gap-2 justify-end">
                  {selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => setCancelModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 active:scale-95 transition"
                    >
                      <Ban className="h-4 w-4" />
                      Hủy Hóa Đơn
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint(selectedOrder)}
                    className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/30 hover:bg-sky-500 active:scale-95 transition"
                  >
                    <Printer className="h-4 w-4" />
                    In Lại Hóa Đơn
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Chọn một hóa đơn từ danh sách để xem chi tiết
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <h4 className="text-sm font-bold text-slate-800">
                Xác Nhận Hủy Hóa Đơn {selectedOrder.code}
              </h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Hành động này sẽ:
              <br />
              • Tự động hoàn trả <strong>{selectedOrder.totalQuantity}</strong> đơn vị sản phẩm vào lại kho.
              <br />
              • Hoàn lại số tiền <strong>{formatVND(selectedOrder.paidAmount)}</strong> vào quỹ tiền mặt.
              <br />
              • Giảm công nợ hoặc doanh số tích lũy của khách hàng tương ứng.
            </p>

            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do hủy hóa đơn <span className="text-rose-500">*</span>:
            </label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="VD: Khách đổi ý không mua nữa, tính nhầm giá..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
            />

            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isProcessing}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-rose-500 disabled:opacity-50"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác Nhận Hủy & Hoàn Kho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
