import React from 'react';
import type { Order, StoreSettings } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';

interface PrintReceiptProps {
  order: Order | null;
  settings: StoreSettings | null;
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ order, settings }) => {
  if (!order) return null;

  const is58mm = settings?.paperSize === '58mm';

  return (
    <div
      id="printable-receipt"
      className={`font-mono text-black bg-white ${is58mm ? 'paper-58mm' : 'paper-80mm'}`}
      style={{
        width: is58mm ? '58mm' : '80mm',
        margin: '0 auto',
        padding: '3mm 2mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Store Header */}
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-sm font-bold uppercase tracking-tight">
          {settings?.storeName || 'CỬA HÀNG TẠP HÓA'}
        </h2>
        <p className="text-[10px] leading-tight">
          {settings?.storeAddress || '123 Đường Nguyễn Huệ, TP.HCM'}
        </p>
        <p className="text-[10px]">ĐT: {settings?.storePhone || '0988 123 456'}</p>
        <div className="border-t border-dashed border-black my-1.5" />
        <h3 className="text-xs font-bold uppercase">HÓA ĐƠN BÁN HÀNG</h3>
        <p className="text-[10px] font-bold">Số: {order.code}</p>
        <p className="text-[9px] text-gray-700">Ngày: {formatDate(order.createdAt)}</p>
      </div>

      {/* Order Meta */}
      <div className="text-[10px] space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span>Thu ngân:</span>
          <span>{order.staffName}</span>
        </div>
        <div className="flex justify-between">
          <span>Khách hàng:</span>
          <span className="font-semibold">{order.customerName || 'Khách lẻ'}</span>
        </div>
        {order.customerPhone && (
          <div className="flex justify-between">
            <span>Điện thoại:</span>
            <span>{order.customerPhone}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* Items Table */}
      <table className="w-full text-[10px] mb-2">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-0.5">Tên hàng</th>
            <th className="py-0.5 text-center">SL</th>
            <th className="py-0.5 text-right">Đ.Giá</th>
            <th className="py-0.5 text-right">T.Tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dotted divide-gray-400">
          {order.items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1 pr-1 font-sans text-[10.5px]">
                <div>{item.productName}</div>
                {item.conversionRate > 1 && (
                  <span className="text-[9px] text-gray-600">({item.unit})</span>
                )}
                {item.discount > 0 && (
                  <span className="text-[9px] text-red-600 block">
                    -GG: {formatVND(item.discount)}
                  </span>
                )}
              </td>
              <td className="py-1 text-center whitespace-nowrap">{item.quantity}</td>
              <td className="py-1 text-right whitespace-nowrap">{formatVND(item.price)}</td>
              <td className="py-1 text-right font-bold whitespace-nowrap">{formatVND(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black my-1" />

      {/* Calculation Totals */}
      <div className="text-[10.5px] space-y-1 mb-2">
        <div className="flex justify-between">
          <span>Tổng tiền hàng:</span>
          <span>{formatVND(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Chiết khấu hóa đơn:</span>
            <span>-{formatVND(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs font-bold border-t border-b border-black py-0.5 my-1">
          <span>TỔNG CẦN TRẢ:</span>
          <span>{formatVND(order.finalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Khách đã trả:</span>
          <span className="font-bold">{formatVND(order.paidAmount)}</span>
        </div>
        {order.changeAmount > 0 && (
          <div className="flex justify-between text-[11px] font-bold">
            <span>Tiền thừa trả khách:</span>
            <span>{formatVND(order.changeAmount)}</span>
          </div>
        )}
        {order.debtAmount > 0 && (
          <div className="flex justify-between text-[11px] font-bold text-red-700">
            <span>GHI NỢ ĐƠN NÀY:</span>
            <span>{formatVND(order.debtAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[9px] text-gray-600 pt-0.5">
          <span>Hình thức thanh toán:</span>
          <span>
            {order.paymentMethod === 'cash'
              ? 'Tiền mặt'
              : order.paymentMethod === 'transfer'
              ? 'Chuyển khoản'
              : order.paymentMethod === 'combined'
              ? 'Kết hợp'
              : 'Ghi nợ'}
          </span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* Footer Notes */}
      <div className="text-center space-y-1 text-[9.5px]">
        <p className="font-semibold italic">
          {settings?.receiptFooter || 'Cảm ơn Quý Khách! Hẹn gặp lại!'}
        </p>
        <p className="text-[8.5px] text-gray-600">Phần mềm quản lý bán hàng GroceryPro POS</p>
      </div>
    </div>
  );
};
