import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Customer,
  Supplier,
  Order,
  PurchaseOrder,
  InventoryTransaction,
  CashTransaction,
  StockCheck,
  Employee,
  StoreSettings,
} from '../types';
import { getVietnamNowISO, generateCode } from '../utils/formatters';

export class GroceryProDatabase extends Dexie {
  products!: Table<Product, number>;
  customers!: Table<Customer, number>;
  suppliers!: Table<Supplier, number>;
  orders!: Table<Order, number>;
  purchaseOrders!: Table<PurchaseOrder, number>;
  inventoryTransactions!: Table<InventoryTransaction, number>;
  cashTransactions!: Table<CashTransaction, number>;
  stockChecks!: Table<StockCheck, number>;
  employees!: Table<Employee, number>;
  settings!: Table<StoreSettings, number>;

  constructor() {
    super('GroceryProPOS_DB');
    this.version(1).stores({
      products: '++id, code, barcode, name, category, status, createdAt',
      customers: '++id, code, phone, name, createdAt',
      suppliers: '++id, code, phone, name, createdAt',
      orders: '++id, code, customerId, status, createdAt, staffId',
      purchaseOrders: '++id, code, supplierId, status, createdAt',
      inventoryTransactions: '++id, code, productId, type, createdAt, refCode',
      cashTransactions: '++id, code, type, category, createdAt, refCode',
      stockChecks: '++id, code, status, createdAt',
      employees: '++id, code, phone, role, active',
      settings: '++id',
    });
  }
}

export const db = new GroceryProDatabase();

/**
 * Initialize default settings and default staff accounts if empty
 */
export async function initDatabaseDefaults() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      storeName: 'Cửa Hàng Tạp Hóa GroceryPro',
      storePhone: '0988 123 456',
      storeAddress: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
      receiptFooter: 'Cảm ơn quý khách! Hẹn gặp lại quý khách lần sau!',
      paperSize: '80mm',
      allowNegativeStock: false,
      defaultPrinter: 'Máy in nhiệt tiêu chuẩn',
      barcodePrefix: 'SP',
      autoPrintReceipt: true,
      currencySymbol: 'đ',
    });
  }

  const staffCount = await db.employees.count();
  if (staffCount === 0) {
    const now = getVietnamNowISO();
    await db.employees.bulkAdd([
      {
        code: 'NV001',
        name: 'Chủ Cửa Hàng',
        phone: '0988123456',
        role: 'owner',
        pin: '1234',
        active: true,
        createdAt: now,
        permissions: {
          viewRevenue: true,
          viewProfit: true,
          editPrice: true,
          applyDiscount: true,
          cancelOrder: true,
          manageInventory: true,
          manageDebt: true,
          manageStaff: true,
          viewReports: true,
        },
      },
      {
        code: 'NV002',
        name: 'Nguyễn Thu Ngân',
        phone: '0912345678',
        role: 'cashier',
        pin: '0000',
        active: true,
        createdAt: now,
        permissions: {
          viewRevenue: false,
          viewProfit: false,
          editPrice: false,
          applyDiscount: true,
          cancelOrder: false,
          manageInventory: false,
          manageDebt: false,
          manageStaff: false,
          viewReports: false,
        },
      },
    ]);
  }
}

/**
 * Atomically process an order checkout:
 * - Checks stock (if negative stock not allowed)
 * - Decreases product stock
 * - Records inventory movement
 * - Records cash in (if cash / transfer paid)
 * - Updates customer debt and totalSpent
 * - Saves order
 */
export async function processOrderCheckout(orderData: Omit<Order, 'id' | 'code' | 'createdAt'>): Promise<Order> {
  return await db.transaction('rw', [db.orders, db.products, db.customers, db.inventoryTransactions, db.cashTransactions, db.settings], async () => {
    const settings = await db.settings.toCollection().first();
    const allowNegative = settings?.allowNegativeStock ?? false;

    // Check stock availability
    for (const item of orderData.items) {
      const prod = await db.products.get(item.productId);
      if (!prod) {
        throw new Error(`Sản phẩm "${item.productName}" không tồn tại trong hệ thống.`);
      }
      const requiredBaseQty = item.quantity * (item.conversionRate || 1);
      if (!allowNegative && prod.stock < requiredBaseQty) {
        throw new Error(`Sản phẩm "${item.productName}" chỉ còn tồn kho ${prod.stock} ${prod.unit}, không đủ để bán ${requiredBaseQty} ${prod.unit}!`);
      }
    }

    const orderCount = await db.orders.count();
    const orderCode = generateCode('HD', orderCount);
    const now = getVietnamNowISO();

    // 1. Save order
    const fullOrder: Order = {
      ...orderData,
      code: orderCode,
      createdAt: now,
    };
    const orderId = await db.orders.add(fullOrder);
    fullOrder.id = orderId;

    // 2. Deduct stock & create inventory records
    const txCount = await db.inventoryTransactions.count();
    let currentTxIndex = txCount;

    for (const item of orderData.items) {
      const prod = await db.products.get(item.productId)!;
      if (prod) {
        const baseQty = item.quantity * (item.conversionRate || 1);
        const oldStock = prod.stock;
        const newStock = oldStock - baseQty;

        await db.products.update(prod.id!, {
          stock: newStock,
          updatedAt: now,
        });

        currentTxIndex++;
        await db.inventoryTransactions.add({
          code: generateCode('XK', currentTxIndex),
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: 'sale',
          quantityChange: -baseQty,
          stockBefore: oldStock,
          stockAfter: newStock,
          unit: prod.unit,
          refCode: orderCode,
          reason: `Bán hàng hóa đơn ${orderCode}`,
          staffName: orderData.staffName,
          createdAt: now,
        });
      }
    }

    // 3. Record cash inflow if actual money was received
    const actualReceived = orderData.paidAmount;
    if (actualReceived > 0) {
      const cashCount = await db.cashTransactions.count();
      await db.cashTransactions.add({
        code: generateCode('PT', cashCount),
        type: 'thu',
        category: 'ban_hang',
        amount: actualReceived,
        refCode: orderCode,
        personName: orderData.customerName || 'Khách lẻ',
        staffName: orderData.staffName,
        note: `Thu tiền hóa đơn bán hàng ${orderCode} (${orderData.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'})`,
        createdAt: now,
      });
    }

    // 4. Update customer totalSpent and debt
    if (orderData.customerId) {
      const cust = await db.customers.get(orderData.customerId);
      if (cust) {
        const newSpent = (cust.totalSpent || 0) + orderData.finalAmount;
        const newDebt = (cust.totalDebt || 0) + (orderData.debtAmount || 0);
        await db.customers.update(cust.id!, {
          totalSpent: newSpent,
          totalDebt: newDebt,
        });
      }
    }

    return fullOrder;
  });
}

/**
 * Cancel an order safely:
 * - Restores stock for all items
 * - Records inventory movement
 * - Reverses cash if money was collected (creates Chi transaction or negative record)
 * - Reverses customer debt & spending
 * - Updates order status to cancelled
 */
export async function cancelOrder(orderId: number, reason: string, staffName: string): Promise<void> {
  await db.transaction('rw', [db.orders, db.products, db.customers, db.inventoryTransactions, db.cashTransactions], async () => {
    const order = await db.orders.get(orderId);
    if (!order) throw new Error('Không tìm thấy hóa đơn cần hủy.');
    if (order.status === 'cancelled') throw new Error('Hóa đơn này đã được hủy trước đó.');

    const now = getVietnamNowISO();

    // 1. Restore stock
    let currentTxIndex = await db.inventoryTransactions.count();
    for (const item of order.items) {
      const prod = await db.products.get(item.productId);
      if (prod) {
        const baseQty = item.quantity * (item.conversionRate || 1);
        const oldStock = prod.stock;
        const newStock = oldStock + baseQty;

        await db.products.update(prod.id!, {
          stock: newStock,
          updatedAt: now,
        });

        currentTxIndex++;
        await db.inventoryTransactions.add({
          code: generateCode('NK', currentTxIndex),
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: 'sale_cancel',
          quantityChange: baseQty,
          stockBefore: oldStock,
          stockAfter: newStock,
          unit: prod.unit,
          refCode: order.code,
          reason: `Hoàn hàng do hủy hóa đơn ${order.code} (${reason})`,
          staffName,
          createdAt: now,
        });
      }
    }

    // 2. Refund cash paid (create cash out transaction)
    if (order.paidAmount > 0) {
      const cashCount = await db.cashTransactions.count();
      await db.cashTransactions.add({
        code: generateCode('PC', cashCount),
        type: 'chi',
        category: 'khac',
        amount: order.paidAmount,
        refCode: order.code,
        personName: order.customerName,
        staffName,
        note: `Hoàn tiền khách do hủy hóa đơn ${order.code}. Lý do: ${reason}`,
        createdAt: now,
      });
    }

    // 3. Revert customer debt and total spent
    if (order.customerId) {
      const cust = await db.customers.get(order.customerId);
      if (cust) {
        const updatedSpent = Math.max(0, (cust.totalSpent || 0) - order.finalAmount);
        const updatedDebt = Math.max(0, (cust.totalDebt || 0) - (order.debtAmount || 0));
        await db.customers.update(cust.id!, {
          totalSpent: updatedSpent,
          totalDebt: updatedDebt,
        });
      }
    }

    // 4. Mark order as cancelled
    await db.orders.update(orderId, {
      status: 'cancelled',
      cancelReason: reason,
    });
  });
}

/**
 * Process a purchase receipt:
 * - Updates stock
 * - Recalculates weighted average cost price
 * - Records inventory movement
 * - Records cash out
 * - Updates supplier balance
 */
export async function processPurchaseOrder(purchaseData: Omit<PurchaseOrder, 'id' | 'code' | 'createdAt'>): Promise<PurchaseOrder> {
  return await db.transaction('rw', [db.purchaseOrders, db.products, db.suppliers, db.inventoryTransactions, db.cashTransactions], async () => {
    const pCount = await db.purchaseOrders.count();
    const purchaseCode = generateCode('PN', pCount);
    const now = getVietnamNowISO();

    const fullPurchase: PurchaseOrder = {
      ...purchaseData,
      code: purchaseCode,
      createdAt: now,
    };
    const pId = await db.purchaseOrders.add(fullPurchase);
    fullPurchase.id = pId;

    let txCount = await db.inventoryTransactions.count();

    for (const item of purchaseData.items) {
      const prod = await db.products.get(item.productId);
      if (prod) {
        const oldStock = prod.stock;
        const newStock = oldStock + item.quantity;
        
        // Recalculate weighted average cost price (Giá vốn bình quân gia quyền)
        let newCostPrice = prod.costPrice;
        if (newStock > 0) {
          const oldTotalCost = Math.max(0, oldStock) * (prod.costPrice || 0);
          const newImportCost = item.quantity * item.costPrice;
          newCostPrice = Math.round((oldTotalCost + newImportCost) / newStock);
        } else {
          newCostPrice = item.costPrice;
        }

        await db.products.update(prod.id!, {
          stock: newStock,
          costPrice: newCostPrice,
          updatedAt: now,
        });

        txCount++;
        await db.inventoryTransactions.add({
          code: generateCode('NK', txCount),
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: 'purchase',
          quantityChange: item.quantity,
          stockBefore: oldStock,
          stockAfter: newStock,
          unit: prod.unit,
          refCode: purchaseCode,
          reason: `Nhập hàng theo phiếu ${purchaseCode}`,
          staffName: purchaseData.staffName,
          createdAt: now,
        });
      }
    }

    // Cash transaction for supplier payment
    if (purchaseData.paidAmount > 0) {
      const cashCount = await db.cashTransactions.count();
      await db.cashTransactions.add({
        code: generateCode('PC', cashCount),
        type: 'chi',
        category: 'nhap_hang',
        amount: purchaseData.paidAmount,
        refCode: purchaseCode,
        personName: purchaseData.supplierName,
        staffName: purchaseData.staffName,
        note: `Thanh toán tiền nhập hàng phiếu ${purchaseCode}`,
        createdAt: now,
      });
    }

    // Update supplier debt and total purchased
    if (purchaseData.supplierId) {
      const supp = await db.suppliers.get(purchaseData.supplierId);
      if (supp) {
        const updatedPurchased = (supp.totalPurchased || 0) + purchaseData.totalAmount;
        const updatedDebt = (supp.totalDebt || 0) + (purchaseData.debtAmount || 0);
        await db.suppliers.update(supp.id!, {
          totalPurchased: updatedPurchased,
          totalDebt: updatedDebt,
        });
      }
    }

    return fullPurchase;
  });
}
