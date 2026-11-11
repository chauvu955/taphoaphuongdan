import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Package,
  Users,
  Building2,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Order, Product, CashTransaction, PurchaseOrder, Customer, Supplier, InventoryTransaction } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';

export const ReportModule: React.FC = () => {
  const [reportType, setReportType] = useState<number>(1);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'year' | 'all'>('month');
  const [loading, setLoading] = useState(true);

  // Raw collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [cashList, setCashList] = useState<CashTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryTx, setInventoryTx] = useState<InventoryTransaction[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const [o, p, pu, c, cu, su, it] = await Promise.all([
      db.orders.where('status').equals('completed').toArray(),
      db.products.toArray(),
      db.purchaseOrders.where('status').equals('completed').toArray(),
      db.cashTransactions.toArray(),
      db.customers.toArray(),
      db.suppliers.toArray(),
      db.inventoryTransactions.toArray(),
    ]);
    setOrders(o);
    setProducts(p);
    setPurchases(pu);
    setCashList(c);
    setCustomers(cu);
    setSuppliers(su);
    setInventoryTx(it);
    setLoading(false);
  };

  // Date Filtering bounds
  const getFilterBounds = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    let start = 0;
    if (dateFilter === 'today') start = startOfToday;
    else if (dateFilter === '7days') start = sevenDaysAgo;
    else if (dateFilter === 'month') start = startOfMonth;
    else if (dateFilter === 'year') start = startOfYear;

    return { start, end: Date.now() };
  };

  const { start: startTime } = getFilterBounds();

  const filteredOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= startTime);
  const filteredPurchases = purchases.filter((p) => new Date(p.createdAt).getTime() >= startTime);
  const filteredCash = cashList.filter((c) => new Date(c.createdAt).getTime() >= startTime);

  // 12 Report Types Definitions
  const reportTabs = [
    { id: 1, name: '1. Doanh thu theo ngày' },
    { id: 2, name: '2. Doanh thu theo tháng' },
    { id: 3, name: '3. Doanh thu theo năm' },
    { id: 4, name: '4. Báo cáo lợi nhuận thực tế' },
    { id: 5, name: '5. Top hàng bán chạy' },
    { id: 6, name: '6. Hàng bán chậm / Tồn ế' },
    { id: 7, name: '7. Báo cáo tồn kho hiện tại' },
    { id: 8, name: '8. Nhập xuất tồn (XNT)' },
    { id: 9, name: '9. Công nợ khách hàng' },
    { id: 10, name: '10. Công nợ nhà cung cấp' },
    { id: 11, name: '11. Sổ quỹ thu chi' },
    { id: 12, name: '12. Hiệu quả kinh doanh tổng thể' },
  ];

  // Export Table to Excel
  const handleExportExcel = () => {
    const wsName = reportTabs.find((r) => r.id === reportType)?.name || 'BaoCao';
    let dataToExport: any[] = [];

    if (reportType === 1 || reportType === 2 || reportType === 3) {
      dataToExport = filteredOrders.map((o) => ({
        'Mã hóa đơn': o.code,
        'Thời gian': formatDate(o.createdAt),
        'Khách hàng': o.customerName,
        'Số lượng món': o.totalQuantity,
        'Tổng tiền': o.finalAmount,
        'Phương thức': o.paymentMethod,
        'Thu ngân': o.staffName,
      }));
    } else if (reportType === 4 || reportType === 12) {
      dataToExport = filteredOrders.map((o) => {
        let cost = 0;
        o.items.forEach((it) => (cost += (it.costPrice || 0) * it.quantity * (it.conversionRate || 1)));
        return {
          'Mã hóa đơn': o.code,
          'Ngày bán': formatDate(o.createdAt),
          'Doanh thu': o.finalAmount,
          'Giá vốn': cost,
          'Lợi nhuận gộp': o.finalAmount - cost,
        };
      });
    } else if (reportType === 5 || reportType === 6) {
      const salesMap: { [name: string]: { qty: number; rev: number } } = {};
      filteredOrders.forEach((o) => {
        o.items.forEach((it) => {
          if (!salesMap[it.productName]) salesMap[it.productName] = { qty: 0, rev: 0 };
          salesMap[it.productName].qty += it.quantity;
          salesMap[it.productName].rev += it.total;
        });
      });
      dataToExport = Object.entries(salesMap).map(([name, d]) => ({
        'Tên hàng': name,
        'Số lượng bán': d.qty,
        'Doanh thu': d.rev,
      }));
    } else if (reportType === 7) {
      dataToExport = products.map((p) => ({
        'Mã hàng': p.code,
        'Tên sản phẩm': p.name,
        'ĐVT': p.unit,
        'Tồn kho': p.stock,
        'Giá vốn': p.costPrice,
        'Giá trị tồn': p.stock * p.costPrice,
      }));
    } else {
      dataToExport = filteredCash.map((c) => ({
        'Mã phiếu': c.code,
        'Thời gian': formatDate(c.createdAt),
        'Loại': c.type === 'thu' ? 'Thu' : 'Chi',
        'Danh mục': c.category,
        'Số tiền': c.amount,
        'Người nộp/nhận': c.personName,
        'Ghi chú': c.note || '',
      }));
    }

    if (dataToExport.length === 0) {
      alert('Không có dữ liệu trong kỳ báo cáo đã chọn.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCao');
    XLSX.writeFile(wb, `GroceryPro_BaoCao_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Calculations for Financial Summary
  let totalRevenue = 0;
  let totalCostOfGoods = 0;
  let totalItemsSold = 0;

  filteredOrders.forEach((o) => {
    totalRevenue += o.finalAmount;
    o.items.forEach((it) => {
      totalItemsSold += it.quantity;
      totalCostOfGoods += (it.costPrice || 0) * it.quantity * (it.conversionRate || 1);
    });
  });

  const grossProfit = totalRevenue - totalCostOfGoods;
  const operationalExpenses = filteredCash
    .filter((c) => c.type === 'chi' && (c.category === 'dien_nuoc' || c.category === 'van_hanh' || c.category === 'khac'))
    .reduce((sum, c) => sum + c.amount, 0);

  const netOperatingProfit = grossProfit - operationalExpenses;

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 p-5 select-none gap-4">
      {/* Left 12 Reports Selector */}
      <div className="w-72 shrink-0 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sky-600" />
          <h3 className="text-sm font-bold text-slate-800">Danh Mục 12 Báo Cáo</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {reportTabs.map((r) => (
            <button
              key={r.id}
              onClick={() => setReportType(r.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-between ${
                reportType === r.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{r.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Top Header & Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              {reportTabs.find((r) => r.id === reportType)?.name}
            </h3>
            <p className="text-xs text-slate-500">Dữ liệu phân tích thực tế từ các giao dịch đã hoàn tất</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Filter */}
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="today">Hôm nay</option>
              <option value="7days">7 ngày gần nhất</option>
              <option value="month">Tháng này</option>
              <option value="year">Năm nay</option>
              <option value="all">Toàn bộ thời gian</option>
            </select>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
            >
              <Download className="h-4 w-4" />
              Xuất File Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Financial Highlights Ribbon */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-200 bg-slate-50/50 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 font-semibold block">Doanh thu bán hàng</span>
            <span className="text-base font-bold font-mono text-sky-700 mt-1 block">
              {formatVND(totalRevenue)}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 font-semibold block">Giá vốn hàng bán</span>
            <span className="text-base font-bold font-mono text-slate-800 mt-1 block">
              {formatVND(totalCostOfGoods)}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 font-semibold block">Lợi nhuận gộp</span>
            <span className="text-base font-bold font-mono text-emerald-600 mt-1 block">
              {formatVND(grossProfit)}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 font-semibold block">Lãi ròng (trừ chi phí)</span>
            <span className="text-base font-bold font-mono text-emerald-700 mt-1 block">
              {formatVND(netOperatingProfit)}
            </span>
          </div>
        </div>

        {/* Report Main Data Table */}
        <div className="flex-1 overflow-y-auto">
          {/* If Sales Reports (1, 2, 3) */}
          {(reportType === 1 || reportType === 2 || reportType === 3) && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3">Mã HD</th>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Khách hàng</th>
                  <th className="p-3 text-center">Số món</th>
                  <th className="p-3 text-right">Tổng tiền hàng</th>
                  <th className="p-3 text-right">Giảm giá</th>
                  <th className="p-3 text-right">Thực thu</th>
                  <th className="p-3">Thu ngân</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      Không có đơn hàng nào trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, idx) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-sky-700">{o.code}</td>
                      <td className="p-3 text-slate-500">{formatDate(o.createdAt)}</td>
                      <td className="p-3 font-semibold text-slate-800">{o.customerName}</td>
                      <td className="p-3 text-center font-mono font-bold">{o.totalQuantity}</td>
                      <td className="p-3 text-right font-mono">{formatVND(o.subtotal)}</td>
                      <td className="p-3 text-right font-mono text-rose-600">
                        {o.discountAmount > 0 ? `-${formatVND(o.discountAmount)}` : '0 đ'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatVND(o.finalAmount)}
                      </td>
                      <td className="p-3 text-slate-600">{o.staffName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Report 4: Profit Analysis */}
          {(reportType === 4 || reportType === 12) && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã hóa đơn</th>
                  <th className="p-3">Ngày bán</th>
                  <th className="p-3 text-right">Doanh thu</th>
                  <th className="p-3 text-right">Giá vốn</th>
                  <th className="p-3 text-right">Lợi nhuận gộp</th>
                  <th className="p-3 text-center">Tỷ suất lãi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => {
                  let cost = 0;
                  o.items.forEach((it) => (cost += (it.costPrice || 0) * it.quantity * (it.conversionRate || 1)));
                  const profit = o.finalAmount - cost;
                  const margin = o.finalAmount > 0 ? Math.round((profit / o.finalAmount) * 100) : 0;

                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-sky-700">{o.code}</td>
                      <td className="p-3 text-slate-500">{formatDate(o.createdAt)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatVND(o.finalAmount)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatVND(cost)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {formatVND(profit)}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold">
                        <span className={margin > 20 ? 'text-emerald-700' : 'text-slate-600'}>
                          {margin}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Report 5 & 6: Best / Slow selling goods */}
          {(reportType === 5 || reportType === 6) && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3 w-12 text-center">Hạng</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3 text-center">Số lượng đã bán</th>
                  <th className="p-3 text-right">Tổng doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const map: { [name: string]: { qty: number; rev: number } } = {};
                  filteredOrders.forEach((o) => {
                    o.items.forEach((it) => {
                      if (!map[it.productName]) map[it.productName] = { qty: 0, rev: 0 };
                      map[it.productName].qty += it.quantity;
                      map[it.productName].rev += it.total;
                    });
                  });
                  let list = Object.entries(map).map(([name, d]) => ({ name, ...d }));
                  list = list.sort((a, b) =>
                    reportType === 5 ? b.qty - a.qty : a.qty - b.qty
                  );

                  return list.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold font-mono text-slate-400">#{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-3 text-center font-mono font-bold text-sky-700">
                        {item.qty}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatVND(item.rev)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}

          {/* Report 7 & 8: Inventory / XNT */}
          {(reportType === 7 || reportType === 8) && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3">ĐVT</th>
                  <th className="p-3 text-center">Tồn kho hiện tại</th>
                  <th className="p-3 text-right">Giá vốn</th>
                  <th className="p-3 text-right">Giá trị vốn tồn</th>
                  <th className="p-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-700">{p.code}</td>
                    <td className="p-3 font-medium text-slate-800">{p.name}</td>
                    <td className="p-3">{p.unit}</td>
                    <td className="p-3 text-center font-mono font-bold">{p.stock}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{formatVND(p.costPrice)}</td>
                    <td className="p-3 text-right font-mono font-bold text-sky-800">
                      {formatVND(p.stock * p.costPrice)}
                    </td>
                    <td className="p-3 text-center">
                      {p.stock <= 0 ? (
                        <span className="text-rose-600 font-bold">Hết hàng</span>
                      ) : p.stock <= p.minStock ? (
                        <span className="text-amber-600 font-bold">Sắp hết</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Đủ hàng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Report 9 & 10: Debts */}
          {reportType === 9 && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã KH</th>
                  <th className="p-3">Tên khách hàng</th>
                  <th className="p-3">SĐT</th>
                  <th className="p-3 text-right">Tổng mua</th>
                  <th className="p-3 text-right">Công nợ còn lại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-700">{c.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="p-3 text-slate-500">{c.phone || '-'}</td>
                    <td className="p-3 text-right font-mono text-slate-700">{formatVND(c.totalSpent)}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      {formatVND(c.totalDebt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 10 && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã NCC</th>
                  <th className="p-3">Tên nhà cung cấp</th>
                  <th className="p-3">Liên hệ</th>
                  <th className="p-3 text-right">Tổng nhập</th>
                  <th className="p-3 text-right">Nợ phải trả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-700">{s.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{s.name}</td>
                    <td className="p-3 text-slate-500">{s.contactPerson || s.phone || '-'}</td>
                    <td className="p-3 text-right font-mono text-slate-700">{formatVND(s.totalPurchased)}</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      {formatVND(s.totalDebt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Report 11: Cash Flow */}
          {reportType === 11 && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Mã phiếu</th>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">Người nộp/nhận</th>
                  <th className="p-3 text-right">Số tiền</th>
                  <th className="p-3">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCash.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-700">{c.code}</td>
                    <td className="p-3 text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          c.type === 'thu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {c.type === 'thu' ? 'Thu' : 'Chi'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{c.personName}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={c.type === 'thu' ? 'text-emerald-600' : 'text-rose-600'}>
                        {c.type === 'thu' ? '+' : '-'}{formatVND(c.amount)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{c.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
