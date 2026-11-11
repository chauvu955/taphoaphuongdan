import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  Printer,
  History,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  AlertCircle,
  Check,
  Percent,
} from 'lucide-react';
import { db, processOrderCheckout } from '../../db/db';
import type {
  Product,
  Customer,
  OrderItem,
  PaymentMethod,
  Order,
  StoreSettings,
  Employee,
} from '../../types';
import { formatVND, parseNumberFromInput } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { OrderHistoryModal } from './OrderHistoryModal';

interface PosModuleProps {
  settings: StoreSettings | null;
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

interface CartTab {
  id: number;
  name: string;
  items: OrderItem[];
  selectedCustomer: Customer | null;
  discountValue: number;
  discountType: 'fixed' | 'percent';
  paymentMethod: PaymentMethod;
  amountGiven: number;
  cashPaid: number;
  transferPaid: number;
  note: string;
}

export const PosModule: React.FC<PosModuleProps> = ({
  settings,
  currentStaff,
  onRefreshData,
}) => {
  // Products & Customers
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart Tabs (Support holding multiple active orders simultaneously)
  const [tabs, setTabs] = useState<CartTab[]>([
    {
      id: 1,
      name: 'Đơn 1',
      items: [],
      selectedCustomer: null,
      discountValue: 0,
      discountType: 'fixed',
      paymentMethod: 'cash',
      amountGiven: 0,
      cashPaid: 0,
      transferPaid: 0,
      note: '',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<number>(1);

  // Modals & States
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(settings?.autoPrintReceipt ?? true);

  // Quick Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Active Cart Reference
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [prodList, custList] = await Promise.all([
      db.products.where('status').equals('active').toArray(),
      db.customers.toArray(),
    ]);
    setProducts(prodList);
    setCustomers(custList);

    const cats = Array.from(new Set(prodList.map((p) => p.category).filter(Boolean)));
    setCategories(['Tất cả', ...cats]);
  };

  // Keyboard Shortcuts (F2, F3, F4, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'Escape') {
        if (showReceiptModal) setShowReceiptModal(false);
        if (showHistoryModal) setShowHistoryModal(false);
        if (showCustomerModal) setShowCustomerModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isProcessing, showReceiptModal, showHistoryModal, showCustomerModal]);

  // Update Active Tab State Helper
  const updateActiveTab = (updater: (prevTab: CartTab) => CartTab) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? updater(t) : t))
    );
  };

  // Add Product to Cart
  const handleAddToCart = (product: Product, conversion?: { unitName: string; conversionRate: number; price: number }) => {
    const unit = conversion ? conversion.unitName : product.unit;
    const rate = conversion ? conversion.conversionRate : 1;
    const price = conversion ? conversion.price : product.sellingPrice;

    updateActiveTab((tab) => {
      const existingIndex = tab.items.findIndex(
        (i) => i.productId === product.id && i.unit === unit
      );

      let newItems = [...tab.items];
      if (existingIndex > -1) {
        const item = newItems[existingIndex];
        const newQty = item.quantity + 1;
        newItems[existingIndex] = {
          ...item,
          quantity: newQty,
          total: newQty * item.price - item.discount,
        };
      } else {
        newItems.push({
          productId: product.id!,
          productCode: product.code,
          productName: product.name,
          unit,
          conversionRate: rate,
          costPrice: product.costPrice,
          price,
          originalPrice: price,
          quantity: 1,
          discount: 0,
          total: price,
        });
      }
      return { ...tab, items: newItems };
    });
  };

  // Barcode / Search Enter Trigger
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return;

      // Exact match barcode or product code
      const matched = products.find(
        (p) =>
          p.barcode.toLowerCase() === query ||
          p.code.toLowerCase() === query ||
          (p.additionalUnits &&
            p.additionalUnits.some((u) => u.barcode && u.barcode.toLowerCase() === query))
      );

      if (matched) {
        // If matched additional unit barcode
        const matchedUnit = matched.additionalUnits?.find(
          (u) => u.barcode && u.barcode.toLowerCase() === query
        );
        handleAddToCart(matched, matchedUnit);
        setSearchTerm('');
      } else {
        // Find first item matching by name
        const firstMatch = filteredProducts[0];
        if (firstMatch) {
          handleAddToCart(firstMatch);
          setSearchTerm('');
        }
      }
    }
  };

  // Change Quantity
  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    updateActiveTab((tab) => {
      const items = [...tab.items];
      const item = items[index];
      items[index] = {
        ...item,
        quantity: newQty,
        total: newQty * item.price - item.discount,
      };
      return { ...tab, items };
    });
  };

  // Change Price (Requires permission)
  const handlePriceChange = (index: number, newPrice: number) => {
    const canEdit = currentStaff?.role === 'owner' || currentStaff?.permissions.editPrice;
    if (!canEdit) {
      alert('Nhân viên không có quyền chỉnh sửa giá bán. Hãy liên hệ Chủ cửa hàng!');
      return;
    }
    updateActiveTab((tab) => {
      const items = [...tab.items];
      const item = items[index];
      items[index] = {
        ...item,
        price: newPrice,
        total: item.quantity * newPrice - item.discount,
      };
      return { ...tab, items };
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    updateActiveTab((tab) => ({
      ...tab,
      items: tab.items.filter((_, i) => i !== index),
    }));
  };

  // Switch Unit for line item
  const handleUnitChange = (index: number, unitName: string) => {
    updateActiveTab((tab) => {
      const items = [...tab.items];
      const item = items[index];
      const product = products.find((p) => p.id === item.productId);
      if (!product) return tab;

      if (unitName === product.unit) {
        items[index] = {
          ...item,
          unit: product.unit,
          conversionRate: 1,
          price: product.sellingPrice,
          originalPrice: product.sellingPrice,
          total: item.quantity * product.sellingPrice - item.discount,
        };
      } else {
        const u = product.additionalUnits?.find((x) => x.unitName === unitName);
        if (u) {
          items[index] = {
            ...item,
            unit: u.unitName,
            conversionRate: u.conversionRate,
            price: u.price,
            originalPrice: u.price,
            total: item.quantity * u.price - item.discount,
          };
        }
      }
      return { ...tab, items };
    });
  };

  // Calculations
  const subtotal = activeTab.items.reduce((sum, i) => sum + i.total, 0);
  const totalQuantity = activeTab.items.reduce((sum, i) => sum + i.quantity, 0);

  let discountAmount = 0;
  if (activeTab.discountType === 'percent') {
    discountAmount = Math.round((subtotal * activeTab.discountValue) / 100);
  } else {
    discountAmount = activeTab.discountValue;
  }
  discountAmount = Math.min(discountAmount, subtotal);

  const finalAmount = Math.max(0, subtotal - discountAmount);

  // Payment amounts calculation
  let paidAmount = 0;
  let debtAmount = 0;
  let changeAmount = 0;

  if (activeTab.paymentMethod === 'debt') {
    paidAmount = 0;
    debtAmount = finalAmount;
    changeAmount = 0;
  } else if (activeTab.paymentMethod === 'combined') {
    paidAmount = (activeTab.cashPaid || 0) + (activeTab.transferPaid || 0);
    if (paidAmount >= finalAmount) {
      debtAmount = 0;
      changeAmount = paidAmount - finalAmount;
    } else {
      debtAmount = finalAmount - paidAmount;
      changeAmount = 0;
    }
  } else {
    // Cash or Transfer
    const given = activeTab.amountGiven > 0 ? activeTab.amountGiven : finalAmount;
    if (given >= finalAmount) {
      paidAmount = finalAmount;
      debtAmount = 0;
      changeAmount = given - finalAmount;
    } else {
      paidAmount = given;
      debtAmount = finalAmount - given;
      changeAmount = 0;
    }
  }

  // Quick Cash Preset Button
  const handleQuickCash = (amount: number) => {
    updateActiveTab((tab) => ({
      ...tab,
      amountGiven: amount,
    }));
  };

  // Checkout Execution
  const handleCheckout = async () => {
    if (activeTab.items.length === 0) {
      alert('Giỏ hàng đang trống! Vui lòng chọn sản phẩm trước khi thanh toán.');
      return;
    }

    if (activeTab.paymentMethod === 'debt' && !activeTab.selectedCustomer) {
      alert('Vui lòng chọn khách hàng (F4) khi thực hiện giao dịch Bán Nợ / Ghi Nợ!');
      return;
    }

    if (debtAmount > 0 && !activeTab.selectedCustomer) {
      alert('Khách trả thiếu tiền và còn nợ. Vui lòng chọn hoặc thêm thông tin khách hàng!');
      return;
    }

    setIsProcessing(true);
    try {
      const orderPayload = {
        customerId: activeTab.selectedCustomer?.id,
        customerName: activeTab.selectedCustomer?.name || 'Khách lẻ',
        customerPhone: activeTab.selectedCustomer?.phone,
        items: activeTab.items,
        totalQuantity,
        subtotal,
        discountAmount,
        finalAmount,
        paidAmount,
        debtAmount,
        paymentMethod: activeTab.paymentMethod,
        cashPaid: activeTab.paymentMethod === 'combined' ? activeTab.cashPaid : activeTab.paymentMethod === 'cash' ? paidAmount : 0,
        transferPaid: activeTab.paymentMethod === 'combined' ? activeTab.transferPaid : activeTab.paymentMethod === 'transfer' ? paidAmount : 0,
        changeAmount,
        status: 'completed' as const,
        staffId: currentStaff?.id || 1,
        staffName: currentStaff?.name || 'Thu ngân',
        note: activeTab.note,
      };

      const completed = await processOrderCheckout(orderPayload);
      setCompletedOrder(completed);

      // Reset Current Tab
      updateActiveTab((tab) => ({
        ...tab,
        items: [],
        selectedCustomer: null,
        discountValue: 0,
        amountGiven: 0,
        cashPaid: 0,
        transferPaid: 0,
        note: '',
      }));

      // Reload products for updated stock
      await loadData();
      if (onRefreshData) onRefreshData();

      // Open Receipt Modal
      setShowReceiptModal(true);
      if (autoPrint) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err: any) {
      alert('Lỗi thanh toán: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Customer Creation
  const handleSaveCustomer = async () => {
    if (!newCustName.trim()) {
      alert('Vui lòng nhập tên khách hàng.');
      return;
    }
    const count = await db.customers.count();
    const code = `KH${String(count + 1).padStart(6, '0')}`;
    const id = await db.customers.add({
      code,
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      totalSpent: 0,
      totalDebt: 0,
      createdAt: new Date().toISOString(),
    });
    const created = await db.customers.get(id);
    if (created) {
      setCustomers((prev) => [...prev, created]);
      updateActiveTab((tab) => ({ ...tab, selectedCustomer: created }));
    }
    setShowCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
  };

  // Add / Remove Tabs
  const handleAddTab = () => {
    const nextId = Math.max(...tabs.map((t) => t.id), 0) + 1;
    const newTab: CartTab = {
      id: nextId,
      name: `Đơn ${nextId}`,
      items: [],
      selectedCustomer: null,
      discountValue: 0,
      discountType: 'fixed',
      paymentMethod: 'cash',
      amountGiven: 0,
      cashPaid: 0,
      transferPaid: 0,
      note: '',
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextId);
  };

  const handleCloseTab = (tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      updateActiveTab((t) => ({ ...t, items: [] }));
      return;
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
    const query = searchTerm.toLowerCase();
    const matchQuery =
      !searchTerm ||
      p.name.toLowerCase().includes(query) ||
      p.code.toLowerCase().includes(query) ||
      p.barcode.includes(query);
    return matchCat && matchQuery;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 select-none">
      {/* LEFT: Product Catalog & Barcode Search */}
      <div className="w-5/12 flex flex-col border-r border-slate-300 bg-white">
        {/* Top Search & Barcode Bar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm kiếm SP hoặc Quét mã vạch (F2)..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-2.5 text-xs text-slate-800 shadow-inner focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
            />
            <div className="absolute right-2.5 flex items-center text-slate-400">
              <Barcode className="h-5 w-5" />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards List */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
          {filteredProducts.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-xs text-slate-400">
              {products.length === 0 ? (
                <div>
                  <p className="font-semibold text-slate-600 text-sm mb-1">Chưa có sản phẩm nào</p>
                  <p>Hãy vào mục <strong>Hàng hóa</strong> để thêm sản phẩm hoặc nhập file Excel.</p>
                </div>
              ) : (
                'Không tìm thấy sản phẩm nào khớp với tìm kiếm.'
              )}
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isOutOfStock = prod.stock <= 0;
              const isLowStock = prod.stock > 0 && prod.stock <= prod.minStock;

              return (
                <div
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className={`group relative flex flex-col justify-between rounded-xl border p-2.5 text-left transition cursor-pointer ${
                    isOutOfStock
                      ? 'border-rose-200 bg-rose-50/50 hover:border-rose-300'
                      : 'border-slate-200 bg-white hover:border-sky-400 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                      <span>{prod.code}</span>
                      <span
                        className={`font-semibold rounded px-1.5 py-0.2 ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Tồn: {prod.stock} {prod.unit}
                      </span>
                    </div>

                    <h4 className="mt-1 text-xs font-semibold text-slate-800 line-clamp-2 leading-tight group-hover:text-sky-700">
                      {prod.name}
                    </h4>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-sky-700">
                      {formatVND(prod.sellingPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400">/{prod.unit}</span>
                  </div>

                  {/* Additional Units preview */}
                  {prod.additionalUnits && prod.additionalUnits.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 border-t border-slate-100 pt-1">
                      {prod.additionalUnits.map((u, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(prod, u);
                          }}
                          className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          +{u.unitName} ({formatVND(u.price)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MIDDLE: Cart Table & Multi-Tabs */}
      <div className="w-4/12 flex flex-col border-r border-slate-300 bg-white">
        {/* Order Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-100 px-2 pt-2 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold cursor-pointer transition ${
                activeTabId === tab.id
                  ? 'bg-white text-sky-700 border-t-2 border-t-sky-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <span>{tab.name}</span>
              {tab.items.length > 0 && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] text-sky-800 font-bold">
                  {tab.items.length}
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddTab}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
            title="Mở thêm hóa đơn mới"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Cart Item Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
          <span>Giỏ hàng ({totalQuantity} món)</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1 text-sky-600 hover:text-sky-700 text-xs font-medium"
            >
              <History className="h-3.5 w-3.5" />
              Lịch sử (F8)
            </button>
            {activeTab.items.length > 0 && (
              <button
                onClick={() => updateActiveTab((t) => ({ ...t, items: [] }))}
                className="text-rose-600 hover:text-rose-700 text-xs font-medium"
              >
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {activeTab.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                <Barcode className="h-6 w-6" />
              </div>
              <p className="text-xs font-medium">Giỏ hàng đang trống</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Quét mã vạch hoặc chọn sản phẩm từ danh mục bên trái
              </p>
            </div>
          ) : (
            activeTab.items.map((item, idx) => {
              const prod = products.find((p) => p.id === item.productId);
              const hasOtherUnits = prod?.additionalUnits && prod.additionalUnits.length > 0;

              return (
                <div key={idx} className="p-2.5 hover:bg-slate-50 transition space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          #{idx + 1}
                        </span>
                        <h5 className="text-xs font-semibold text-slate-800 leading-tight">
                          {item.productName}
                        </h5>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        {/* Unit Switch Dropdown */}
                        {hasOtherUnits ? (
                          <select
                            value={item.unit}
                            onChange={(e) => handleUnitChange(idx, e.target.value)}
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-700 outline-none"
                          >
                            <option value={prod!.unit}>{prod!.unit}</option>
                            {prod!.additionalUnits!.map((u) => (
                              <option key={u.unitName} value={u.unitName}>
                                {u.unitName} (x{u.conversionRate})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>ĐVT: {item.unit}</span>
                        )}

                        <span>• Đơn giá: {formatVND(item.price)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Xóa món này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Quantity and Line Total */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                      <button
                        onClick={() => handleQuantityChange(idx, item.quantity - 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-l-lg"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                        className="w-12 text-center text-xs font-bold text-slate-800 outline-none"
                      />
                      <button
                        onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-r-lg"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {formatVND(item.total)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Payment & Order Completion */}
      <div className="w-3/12 flex flex-col bg-slate-50 p-3 justify-between overflow-y-auto">
        <div className="space-y-3">
          {/* Customer Selection */}
          <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Khách hàng</span>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Thêm (F4)
              </button>
            </div>

            <div className="relative">
              <select
                value={activeTab.selectedCustomer?.id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = customers.find((c) => String(c.id) === val) || null;
                  updateActiveTab((t) => ({ ...t, selectedCustomer: found }));
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
              >
                <option value="">-- Khách lẻ (Không lưu công nợ) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} - Nợ: {formatVND(c.totalDebt)}
                  </option>
                ))}
              </select>
            </div>

            {activeTab.selectedCustomer && (
              <div className="rounded-lg bg-sky-50 p-2 text-[11px] text-sky-900 border border-sky-100">
                <div className="flex justify-between">
                  <span>Nợ cũ:</span>
                  <strong className="text-rose-600 font-mono">
                    {formatVND(activeTab.selectedCustomer.totalDebt)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Summary */}
          <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Tổng tiền hàng:</span>
              <span className="font-bold font-mono">{formatVND(subtotal)}</span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">Giảm giá:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={activeTab.discountValue || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    updateActiveTab((t) => ({ ...t, discountValue: val }));
                  }}
                  className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateActiveTab((t) => ({
                      ...t,
                      discountType: t.discountType === 'fixed' ? 'percent' : 'fixed',
                    }))
                  }
                  className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                >
                  {activeTab.discountType === 'percent' ? '%' : 'đ'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">KHÁCH CẦN TRẢ:</span>
              <span className="text-lg font-extrabold text-sky-700 font-mono">
                {formatVND(finalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Phương thức thanh toán</span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => updateActiveTab((t) => ({ ...t, paymentMethod: 'cash' }))}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-semibold transition ${
                  activeTab.paymentMethod === 'cash'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Banknote className="h-3.5 w-3.5" />
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => updateActiveTab((t) => ({ ...t, paymentMethod: 'transfer' }))}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-semibold transition ${
                  activeTab.paymentMethod === 'transfer'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Chuyển khoản
              </button>
              <button
                type="button"
                onClick={() => updateActiveTab((t) => ({ ...t, paymentMethod: 'combined' }))}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-semibold transition ${
                  activeTab.paymentMethod === 'combined'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Kết hợp
              </button>
              <button
                type="button"
                onClick={() => updateActiveTab((t) => ({ ...t, paymentMethod: 'debt' }))}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-semibold transition ${
                  activeTab.paymentMethod === 'debt'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-rose-700 hover:bg-slate-200'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ghi nợ (Thiếu)
              </button>
            </div>

            {/* Quick cash suggestions */}
            {activeTab.paymentMethod === 'cash' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Tiền khách đưa:</span>
                  <input
                    type="number"
                    value={activeTab.amountGiven || ''}
                    placeholder={String(finalAmount)}
                    onChange={(e) =>
                      updateActiveTab((t) => ({
                        ...t,
                        amountGiven: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-xs font-bold font-mono outline-none focus:border-sky-500"
                  />
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(finalAmount)}
                    className="rounded bg-sky-50 border border-sky-200 py-1 font-bold text-sky-800 hover:bg-sky-100"
                  >
                    Đủ tiền
                  </button>
                  {[50000, 100000, 200000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="rounded bg-slate-100 border border-slate-200 py-1 font-mono text-slate-700 hover:bg-slate-200"
                    >
                      {formatVND(amt).replace(' đ', '')}
                    </button>
                  ))}
                </div>

                {/* Change amount */}
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-600">Tiền thừa trả khách:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {formatVND(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Combined Cash + Transfer */}
            {activeTab.paymentMethod === 'combined' && (
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between items-center">
                  <span>Tiền mặt:</span>
                  <input
                    type="number"
                    value={activeTab.cashPaid || ''}
                    onChange={(e) =>
                      updateActiveTab((t) => ({
                        ...t,
                        cashPaid: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-xs font-mono"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Chuyển khoản:</span>
                  <input
                    type="number"
                    value={activeTab.transferPaid || ''}
                    onChange={(e) =>
                      updateActiveTab((t) => ({
                        ...t,
                        transferPaid: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Debt summary */}
            {debtAmount > 0 && (
              <div className="rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-700 border border-rose-200 flex justify-between">
                <span>Ghi nợ đơn này:</span>
                <span className="font-mono">{formatVND(debtAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Checkout Actions */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>Tự động in hóa đơn nhiệt</span>
          </label>

          <button
            onClick={handleCheckout}
            disabled={isProcessing || activeTab.items.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            {isProcessing ? 'ĐANG THANH TOÁN...' : 'THANH TOÁN (F3)'}
          </button>
        </div>
      </div>

      {/* Quick Customer Add Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-sky-600" /> Thêm Khách Hàng Nhanh
            </h4>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">
                  Họ tên khách hàng <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="VD: Chị Lan Tiệm Tóc"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="VD: 0912 345 678"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Địa chỉ:</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="VD: Kế tiệm sửa xe"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
              >
                Lưu & Chọn Khách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Order Receipt Modal */}
      <ReceiptModal
        order={completedOrder}
        settings={settings}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />

      {/* Order History Modal */}
      <OrderHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        settings={settings}
        currentStaff={currentStaff}
        onOrderUpdated={loadData}
      />
    </div>
  );
};
