export type Role = 'owner' | 'manager' | 'cashier';

export interface StaffPermissions {
  viewRevenue: boolean;
  viewProfit: boolean;
  editPrice: boolean;
  applyDiscount: boolean;
  cancelOrder: boolean;
  manageInventory: boolean;
  manageDebt: boolean;
  manageStaff: boolean;
  viewReports: boolean;
}

export interface Employee {
  id?: number;
  code: string;
  name: string;
  phone: string;
  role: Role;
  pin: string; // 4 or 6 digit PIN
  permissions: StaffPermissions;
  active: boolean;
  createdAt: string;
}

export interface UnitConversion {
  unitName: string; // e.g., 'Thùng'
  conversionRate: number; // e.g., 24 (1 Thùng = 24 Lon)
  price: number; // Selling price for this unit
  barcode?: string;
}

export interface Product {
  id?: number;
  code: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  unit: string; // Base unit e.g., 'Lon', 'Gói', 'Chai', 'Kg'
  costPrice: number; // Giá vốn bình quân
  sellingPrice: number; // Giá bán lẻ
  wholesalePrice?: number; // Giá bán sỉ
  stock: number; // Số lượng tồn kho
  minStock: number; // Mức tồn tối thiểu
  supplierId?: number;
  supplierName?: string;
  note?: string;
  status: 'active' | 'inactive';
  additionalUnits?: UnitConversion[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id?: number;
  code: string;
  name: string;
  phone: string;
  address?: string;
  totalSpent: number;
  totalDebt: number; // Công nợ hiện tại
  note?: string;
  createdAt: string;
}

export interface Supplier {
  id?: number;
  code: string;
  name: string;
  phone: string;
  address?: string;
  contactPerson?: string;
  totalPurchased: number;
  totalDebt: number; // Tiền nợ nhà cung cấp
  note?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  conversionRate: number;
  costPrice: number;
  price: number;
  originalPrice: number;
  quantity: number;
  discount: number; // Giảm giá trên từng dòng
  total: number;
}

export type PaymentMethod = 'cash' | 'transfer' | 'combined' | 'debt';

export interface Order {
  id?: number;
  code: string; // HD000001
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalQuantity: number;
  subtotal: number;
  discountAmount: number;
  finalAmount: number; // Khách cần trả
  paidAmount: number; // Khách đã trả
  debtAmount: number; // Còn nợ (ghi nợ)
  paymentMethod: PaymentMethod;
  cashPaid: number;
  transferPaid: number;
  changeAmount: number; // Tiền thừa trả khách
  status: 'completed' | 'cancelled';
  cancelReason?: string;
  staffId: number;
  staffName: string;
  note?: string;
  createdAt: string; // ISO string
}

export interface PurchaseItem {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  costPrice: number;
  quantity: number;
  total: number;
}

export interface PurchaseOrder {
  id?: number;
  code: string; // PN000001
  supplierId?: number;
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number; // Còn nợ nhà cung cấp
  status: 'completed' | 'cancelled';
  staffId: number;
  staffName: string;
  note?: string;
  createdAt: string;
}

export type InventoryTransactionType =
  | 'sale'
  | 'sale_cancel'
  | 'purchase'
  | 'purchase_cancel'
  | 'adjustment'
  | 'stock_in'
  | 'stock_out'
  | 'audit';

export interface InventoryTransaction {
  id?: number;
  code: string; // XK000001, NK000001, etc.
  productId: number;
  productCode: string;
  productName: string;
  type: InventoryTransactionType;
  quantityChange: number; // + hoặc -
  stockBefore: number;
  stockAfter: number;
  unit: string;
  refCode?: string; // Mã HD hoặc PN liên quan
  reason: string;
  staffName: string;
  createdAt: string;
}

export type CashType = 'thu' | 'chi';
export type CashCategory =
  | 'ban_hang'
  | 'thu_no_khach'
  | 'nhap_hang'
  | 'tra_no_ncc'
  | 'dien_nuoc'
  | 'van_hanh'
  | 'khac';

export interface CashTransaction {
  id?: number;
  code: string; // PT000001 hoặc PC000001
  type: CashType;
  category: CashCategory;
  amount: number;
  refCode?: string; // Liên kết tới HD, PN hoặc mã phiếu nợ
  personName: string; // Người nộp / Người nhận
  staffName: string;
  note?: string;
  createdAt: string;
}

export interface StockCheckItem {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  systemStock: number;
  actualStock: number;
  difference: number;
  note?: string;
}

export interface StockCheck {
  id?: number;
  code: string; // KK000001
  items: StockCheckItem[];
  totalDifference: number;
  staffName: string;
  status: 'balanced' | 'draft';
  note?: string;
  createdAt: string;
}

export interface StoreSettings {
  id?: number;
  storeName: string;
  storePhone: string;
  storeAddress: string;
  receiptFooter: string;
  paperSize: '58mm' | '80mm';
  allowNegativeStock: boolean;
  defaultPrinter: string;
  barcodePrefix: string;
  autoPrintReceipt: boolean;
  currencySymbol: string;
  lastBackupDate?: string;
}
