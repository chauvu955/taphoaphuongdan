import { db } from './db';
import { getVietnamNowISO } from '../utils/formatters';

export interface BackupPackage {
  app: 'GroceryProPOS';
  version: '1.0.0';
  createdAt: string;
  metadata: {
    storeName: string;
    productCount: number;
    orderCount: number;
    customerCount: number;
    supplierCount: number;
    inventoryTxCount: number;
    cashTxCount: number;
  };
  data: {
    products: any[];
    customers: any[];
    suppliers: any[];
    orders: any[];
    purchaseOrders: any[];
    inventoryTransactions: any[];
    cashTransactions: any[];
    stockChecks: any[];
    employees: any[];
    settings: any[];
  };
}

export async function exportDatabaseToJSON(): Promise<{ blob: Blob; filename: string; summary: BackupPackage['metadata'] }> {
  const [
    products,
    customers,
    suppliers,
    orders,
    purchaseOrders,
    inventoryTransactions,
    cashTransactions,
    stockChecks,
    employees,
    settings,
  ] = await Promise.all([
    db.products.toArray(),
    db.customers.toArray(),
    db.suppliers.toArray(),
    db.orders.toArray(),
    db.purchaseOrders.toArray(),
    db.inventoryTransactions.toArray(),
    db.cashTransactions.toArray(),
    db.stockChecks.toArray(),
    db.employees.toArray(),
    db.settings.toArray(),
  ]);

  const currentSettings = settings[0];
  const now = getVietnamNowISO();

  const metadata = {
    storeName: currentSettings?.storeName || 'GroceryPro Store',
    productCount: products.length,
    orderCount: orders.length,
    customerCount: customers.length,
    supplierCount: suppliers.length,
    inventoryTxCount: inventoryTransactions.length,
    cashTxCount: cashTransactions.length,
  };

  const backupPackage: BackupPackage = {
    app: 'GroceryProPOS',
    version: '1.0.0',
    createdAt: now,
    metadata,
    data: {
      products,
      customers,
      suppliers,
      orders,
      purchaseOrders,
      inventoryTransactions,
      cashTransactions,
      stockChecks,
      employees,
      settings,
    },
  };

  // Update last backup date in settings
  if (currentSettings && currentSettings.id) {
    await db.settings.update(currentSettings.id, { lastBackupDate: now });
  }

  const jsonString = JSON.stringify(backupPackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  const dateStr = now.slice(0, 10);
  const timeStr = now.slice(11, 19).replace(/:/g, '-');
  const filename = `GroceryPro_Backup_${dateStr}_${timeStr}.json`;

  return { blob, filename, summary: metadata };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateBackupFile(content: any): { valid: boolean; error?: string; pkg?: BackupPackage } {
  try {
    if (!content || typeof content !== 'object') {
      return { valid: false, error: 'Tệp không phải định dạng JSON hợp lệ.' };
    }
    if (content.app !== 'GroceryProPOS') {
      return { valid: false, error: 'Tệp không phải bản sao lưu hợp lệ của GroceryPro POS.' };
    }
    if (!content.data || !Array.isArray(content.data.products) || !Array.isArray(content.data.orders)) {
      return { valid: false, error: 'Cấu trúc dữ liệu trong tệp sao lưu bị thiếu hoặc hư hỏng.' };
    }
    return { valid: true, pkg: content as BackupPackage };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Lỗi khi kiểm tra tính toàn vẹn bản sao lưu.' };
  }
}

export async function restoreDatabaseFromJSON(pkg: BackupPackage): Promise<void> {
  await db.transaction('rw', [
    db.products,
    db.customers,
    db.suppliers,
    db.orders,
    db.purchaseOrders,
    db.inventoryTransactions,
    db.cashTransactions,
    db.stockChecks,
    db.employees,
    db.settings,
  ], async () => {
    // 1. Clear current tables
    await Promise.all([
      db.products.clear(),
      db.customers.clear(),
      db.suppliers.clear(),
      db.orders.clear(),
      db.purchaseOrders.clear(),
      db.inventoryTransactions.clear(),
      db.cashTransactions.clear(),
      db.stockChecks.clear(),
      db.employees.clear(),
      db.settings.clear(),
    ]);

    // 2. Restore data
    const d = pkg.data;
    if (d.products?.length) await db.products.bulkAdd(d.products);
    if (d.customers?.length) await db.customers.bulkAdd(d.customers);
    if (d.suppliers?.length) await db.suppliers.bulkAdd(d.suppliers);
    if (d.orders?.length) await db.orders.bulkAdd(d.orders);
    if (d.purchaseOrders?.length) await db.purchaseOrders.bulkAdd(d.purchaseOrders);
    if (d.inventoryTransactions?.length) await db.inventoryTransactions.bulkAdd(d.inventoryTransactions);
    if (d.cashTransactions?.length) await db.cashTransactions.bulkAdd(d.cashTransactions);
    if (d.stockChecks?.length) await db.stockChecks.bulkAdd(d.stockChecks);
    if (d.employees?.length) await db.employees.bulkAdd(d.employees);
    if (d.settings?.length) await db.settings.bulkAdd(d.settings);
  });
}
