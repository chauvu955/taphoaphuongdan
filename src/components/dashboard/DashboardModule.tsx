import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  PackageCheck,
  AlertTriangle,
  XCircle,
  Truck,
  Users,
  Wallet,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Filter,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Order, Product, CashTransaction, Customer, Supplier } from '../../types';
import { formatVND, formatDateShort } from '../../utils/formatters';

interface DashboardProps {
  onNavigateTab: (tabKey: any) => void;
}

export const DashboardModule: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'all'>('today');
  const [loading, setLoading] = useState(true);

  // Metrics
  const [revenue, setRevenue] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [itemsSold, setItemsSold] = useState(0);
  const [profit, setProfit] = useState(0);
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [totalCustomerDebt, setTotalCustomerDebt] = useState(0);
  const [totalSupplierDebt, setTotalSupplierDebt] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);

  // Charts data
  const [chartData, setChartData] = useState<{ date: string; revenue: number; profit: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [timeFilter]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [allOrders, allProducts, allCash, allCust, allSupp, allPurchases] = await Promise.all([
        db.orders.where('status').equals('completed').toArray(),
        db.products.toArray(),
        db.cashTransactions.toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
        db.purchaseOrders.where('status').equals('completed').toArray(),
      ]);

      // Stock statistics
      let lowCount = 0;
      let outCount = 0;
      allProducts.forEach((p) => {
        if (p.stock <= 0) outCount++;
        else if (p.stock <= p.minStock) lowCount++;
      });
      setLowStockCount(lowCount);
      setOutOfStockCount(outCount);

      // Debts
      const custDebt = allCust.reduce((s, c) => s + (c.totalDebt || 0), 0);
      const suppDebt = allSupp.reduce((s, sup) => s + (sup.totalDebt || 0), 0);
      setTotalCustomerDebt(custDebt);
      setTotalSupplierDebt(suppDebt);

      // Cash balance
      const totalCashIn = allCash.filter((c) => c.type === 'thu').reduce((s, c) => s + c.amount, 0);
      const totalCashOut = allCash.filter((c) => c.type === 'chi').reduce((s, c) => s + c.amount, 0);
      setCashBalance(totalCashIn - totalCashOut);

      // Date filtering for orders and purchases
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = startOfToday - 29 * 24 * 60 * 60 * 1000;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const filteredOrders = allOrders.filter((o) => {
        const orderTime = new Date(o.createdAt).getTime();
        if (timeFilter === 'today') return orderTime >= startOfToday;
        if (timeFilter === '7days') return orderTime >= sevenDaysAgo;
        if (timeFilter === '30days') return orderTime >= thirtyDaysAgo;
        if (timeFilter === 'thisMonth') return orderTime >= startOfMonth;
        return true;
      });

      const filteredPurchases = allPurchases.filter((p) => {
        const pTime = new Date(p.createdAt).getTime();
        if (timeFilter === 'today') return pTime >= startOfToday;
        if (timeFilter === '7days') return pTime >= sevenDaysAgo;
        if (timeFilter === '30days') return pTime >= thirtyDaysAgo;
        if (timeFilter === 'thisMonth') return pTime >= startOfMonth;
        return true;
      });

      // Calculate Metrics
      let rev = 0;
      let totalCost = 0;
      let qtySold = 0;
      const productSalesMap: { [name: string]: { quantity: number; revenue: number } } = {};

      filteredOrders.forEach((o) => {
        rev += o.finalAmount;
        o.items.forEach((item) => {
          qtySold += item.quantity;
          const cost = (item.costPrice || 0) * item.quantity * (item.conversionRate || 1);
          totalCost += cost;

          if (!productSalesMap[item.productName]) {
            productSalesMap[item.productName] = { quantity: 0, revenue: 0 };
          }
          productSalesMap[item.productName].quantity += item.quantity;
          productSalesMap[item.productName].revenue += item.total;
        });
      });

      setRevenue(rev);
      setOrderCount(filteredOrders.length);
      setItemsSold(qtySold);
      setProfit(rev - totalCost);
      setPurchaseAmount(filteredPurchases.reduce((s, p) => s + p.totalAmount, 0));

      // Top 10 products
      const topList = Object.entries(productSalesMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
      setTopProducts(topList);

      // 7-day trend chart
      const trendDays: { date: string; revenue: number; profit: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday - i * 24 * 60 * 60 * 1000);
        const dayStart = d.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

        const dayOrders = allOrders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= dayStart && t < dayEnd;
        });

        let dayRev = 0;
        let dayCost = 0;
        dayOrders.forEach((o) => {
          dayRev += o.finalAmount;
          o.items.forEach((it) => {
            dayCost += (it.costPrice || 0) * it.quantity * (it.conversionRate || 1);
          });
        });

        trendDays.push({
          date: dStr,
          revenue: dayRev,
          profit: dayRev - dayCost,
        });
      }
      setChartData(trendDays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const maxChartValue = Math.max(...chartData.map((d) => d.revenue), 100000);

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-slate-100 select-none space-y-5">
      {/* Top Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Tổng Quan Cửa Hàng
          </h2>
          <p className="text-xs text-slate-500">
            Hiệu quả bán hàng, lợi nhuận, tồn kho và công nợ cập nhật thời gian thực
          </p>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-xs border border-slate-200 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1" />
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeFilter === 'today'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setTimeFilter('7days')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeFilter === '7days'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            7 ngày
          </button>
          <button
            onClick={() => setTimeFilter('thisMonth')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeFilter === 'thisMonth'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tháng này
          </button>
          <button
            onClick={() => setTimeFilter('30days')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeFilter === '30days'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            30 ngày
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Doanh thu */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Doanh thu bán hàng</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {formatVND(revenue)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span>{orderCount} hóa đơn</span>
            <span>•</span>
            <span>{itemsSold} sản phẩm</span>
          </div>
        </div>

        {/* Lợi nhuận tạm tính */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Lợi nhuận tạm tính</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 font-mono">
            {formatVND(profit)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {revenue > 0 ? `Biên lãi ~${Math.round((profit / revenue) * 100)}% trên doanh thu` : 'Chưa có phát sinh'}
          </div>
        </div>

        {/* Tiền mặt trong két */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tiền mặt trong két</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 font-mono">
            {formatVND(cashBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tổng quỹ tiền mặt ròng hiện có
          </div>
        </div>

        {/* Tiền nhập hàng */}
        <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tiền nhập hàng</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-700 font-mono">
            {formatVND(purchaseAmount)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tổng chi phí nhập kho theo kỳ
          </div>
        </div>
      </div>

      {/* Second Row: Debts & Inventory Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Khách nợ */}
        <div
          onClick={() => onNavigateTab('debt')}
          className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 cursor-pointer hover:border-sky-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Khách hàng còn nợ</span>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              Cần thu
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600 font-mono">
            {formatVND(totalCustomerDebt)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Xem sổ nợ khách hàng →</p>
        </div>

        {/* Nợ nhà cung cấp */}
        <div
          onClick={() => onNavigateTab('debt')}
          className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 cursor-pointer hover:border-sky-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nợ nhà cung cấp</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Phải trả
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-700 font-mono">
            {formatVND(totalSupplierDebt)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Xem sổ nợ nhà cung cấp →</p>
        </div>

        {/* Hàng sắp hết */}
        <div
          onClick={() => onNavigateTab('products')}
          className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 cursor-pointer hover:border-sky-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Hàng sắp hết kho</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600 font-mono">
            {lowStockCount} sản phẩm
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Tồn kho ≤ mức tối thiểu →</p>
        </div>

        {/* Hàng đã hết */}
        <div
          onClick={() => onNavigateTab('products')}
          className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 cursor-pointer hover:border-sky-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Hàng đã hết (Tồn 0)</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600 font-mono">
            {outOfStockCount} sản phẩm
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Cần lập phiếu nhập gấp →</p>
        </div>
      </div>

      {/* Third Row: Charts & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: 7-Day Revenue & Profit Visual Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Xu Hướng Doanh Thu & Lợi Nhuận (7 Ngày Gần Nhất)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> Doanh thu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lợi nhuận
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-slate-200 px-2">
            {chartData.map((d, idx) => {
              const revPercent = Math.min(100, Math.max(8, (d.revenue / maxChartValue) * 100));
              const profPercent = Math.min(100, Math.max(4, (d.profit / maxChartValue) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="text-[10px] font-mono font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {formatVND(d.revenue)}
                  </div>

                  <div className="w-full max-w-[42px] flex items-end justify-center gap-1 h-full">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revPercent}%` }}
                      className="w-1/2 rounded-t-md bg-sky-600 group-hover:bg-sky-500 transition-all duration-300"
                    />
                    {/* Profit Bar */}
                    <div
                      style={{ height: `${profPercent}%` }}
                      className="w-1/2 rounded-t-md bg-emerald-500 group-hover:bg-emerald-400 transition-all duration-300"
                    />
                  </div>

                  <span className="text-[11px] font-semibold text-slate-500 mt-1">{d.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Top 10 Best-Selling Products */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Top Sản Phẩm Bán Chạy</h3>
              <span className="text-xs text-sky-600 font-semibold cursor-pointer" onClick={() => onNavigateTab('reports')}>
                Chi tiết →
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
              {topProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chưa có dữ liệu bán hàng trong kỳ này.
                </div>
              ) : (
                topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 font-mono">
                        {idx + 1}
                      </span>
                      <span className="truncate text-slate-800 font-medium">{p.name}</span>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="font-bold text-slate-900">{p.quantity} đã bán</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick POS Trigger Action */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('pos')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 hover:bg-sky-500 transition active:scale-98"
            >
              <ShoppingCart className="h-4 w-4" />
              Mở Màn Hình Bán Hàng POS (F2)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
