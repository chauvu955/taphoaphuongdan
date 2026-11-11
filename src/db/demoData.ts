import { db } from './db';
import type { Product, Customer, Supplier } from '../types';
import { getVietnamNowISO } from '../utils/formatters';

export const DEMO_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    code: 'SP000001',
    barcode: '8934563123456',
    name: 'Mì Hảo Hảo Tôm Chua Cay 75g',
    category: 'Thực phẩm khô',
    brand: 'Acecook',
    unit: 'Gói',
    costPrice: 3800,
    sellingPrice: 4500,
    wholesalePrice: 4200,
    stock: 120,
    minStock: 30,
    note: 'Hàng bán chạy số 1',
    status: 'active',
    additionalUnits: [
      {
        unitName: 'Thùng',
        conversionRate: 30,
        price: 128000,
        barcode: '8934563123499',
      },
    ],
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000002',
    barcode: '8934561010101',
    name: 'Bia Tiger Lon 330ml',
    category: 'Đồ uống & Bia',
    brand: 'Tiger Beer',
    unit: 'Lon',
    costPrice: 15500,
    sellingPrice: 18000,
    wholesalePrice: 17000,
    stock: 96,
    minStock: 24,
    note: 'Ướp lạnh bán chạy cuối tuần',
    status: 'active',
    additionalUnits: [
      {
        unitName: 'Thùng (24 lon)',
        conversionRate: 24,
        price: 395000,
        barcode: '8934561010124',
      },
      {
        unitName: 'Lốc (6 lon)',
        conversionRate: 6,
        price: 102000,
      },
    ],
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000003',
    barcode: '8935001700018',
    name: 'Nước Ngọt Coca Cola 320ml',
    category: 'Đồ uống & Bia',
    brand: 'Coca-Cola',
    unit: 'Lon',
    costPrice: 8500,
    sellingPrice: 11000,
    wholesalePrice: 10000,
    stock: 72,
    minStock: 20,
    status: 'active',
    additionalUnits: [
      {
        unitName: 'Thùng (24 lon)',
        conversionRate: 24,
        price: 235000,
      },
      {
        unitName: 'Lốc (6 lon)',
        conversionRate: 6,
        price: 62000,
      },
    ],
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000004',
    barcode: '8934563223344',
    name: 'Nước mắm Nam Ngư Đệ Nhị 900ml',
    category: 'Gia vị & Dầu ăn',
    brand: 'Masan Consumer',
    unit: 'Chai',
    costPrice: 22000,
    sellingPrice: 28000,
    stock: 25,
    minStock: 10,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000005',
    barcode: '8934563334455',
    name: 'Dầu ăn Cooking Tường An 1 Lít',
    category: 'Gia vị & Dầu ăn',
    brand: 'Tường An',
    unit: 'Chai',
    costPrice: 42000,
    sellingPrice: 51000,
    stock: 18,
    minStock: 8,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000006',
    barcode: '8934563445566',
    name: 'Gạo Thơm ST25 Túi 5kg',
    category: 'Gạo & Ngũ cốc',
    brand: 'ST25 Ông Cua',
    unit: 'Túi',
    costPrice: 145000,
    sellingPrice: 175000,
    stock: 12,
    minStock: 5,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000007',
    barcode: '8934563556677',
    name: 'Sữa đặc có đường Ông Thọ Xanh Lá 380g',
    category: 'Sữa & Sản phẩm từ sữa',
    brand: 'Vinamilk',
    unit: 'Lon',
    costPrice: 21000,
    sellingPrice: 26000,
    stock: 35,
    minStock: 10,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000008',
    barcode: '8934563667788',
    name: 'Bánh Chocopie Orion Hộp 12 cái',
    category: 'Bánh kẹo & Snack',
    brand: 'Orion',
    unit: 'Hộp',
    costPrice: 44000,
    sellingPrice: 54000,
    stock: 20,
    minStock: 6,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000009',
    barcode: '8934563778899',
    name: 'Bột ngọt Ajinomoto Gói 454g',
    category: 'Gia vị & Dầu ăn',
    brand: 'Ajinomoto',
    unit: 'Gói',
    costPrice: 29000,
    sellingPrice: 35000,
    stock: 4, // Low stock sample
    minStock: 10,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
  {
    code: 'SP000010',
    barcode: '8934563889900',
    name: 'Nước rửa chén Sunlight Chanh 750g',
    category: 'Hóa mỹ phẩm & Tẩy rửa',
    brand: 'Unilever',
    unit: 'Chai',
    costPrice: 24000,
    sellingPrice: 31000,
    stock: 0, // Out of stock sample
    minStock: 5,
    status: 'active',
    createdAt: getVietnamNowISO(),
    updatedAt: getVietnamNowISO(),
  },
];

export const DEMO_CUSTOMERS: Omit<Customer, 'id'>[] = [
  {
    code: 'KH000001',
    name: 'Anh Hùng (Tiệm sửa xe kế bên)',
    phone: '0903112233',
    address: '125 Nguyễn Huệ, Q.1',
    totalSpent: 850000,
    totalDebt: 120000,
    note: 'Khách quen hay uống nước và mua thuốc lá',
    createdAt: getVietnamNowISO(),
  },
  {
    code: 'KH000002',
    name: 'Chị Lan (Bán bún riêu)',
    phone: '0918445566',
    address: 'Hẻm 121 Nguyễn Huệ',
    totalSpent: 3200000,
    totalDebt: 0,
    note: 'Lấy gia vị và mì gói số lượng nhiều',
    createdAt: getVietnamNowISO(),
  },
  {
    code: 'KH000003',
    name: 'Cô Mai (Giáo viên hưu trí)',
    phone: '0938778899',
    address: 'Chung cư 118 Nguyễn Huệ',
    totalSpent: 1450000,
    totalDebt: 50000,
    note: 'Thường mua sữa và bánh',
    createdAt: getVietnamNowISO(),
  },
];

export const DEMO_SUPPLIERS: Omit<Supplier, 'id'>[] = [
  {
    code: 'NCC00001',
    name: 'Đại Lý Bia & Nước Giải Khát Minh Khang',
    phone: '02838999888',
    address: 'Kho hàng Tân Bình, TP.HCM',
    contactPerson: 'Anh Khang (0909123888)',
    totalPurchased: 18500000,
    totalDebt: 2500000,
    note: 'Giao thứ 3 và thứ 6 hàng tuần',
    createdAt: getVietnamNowISO(),
  },
  {
    code: 'NCC00002',
    name: 'Nhà Phân Phối Bánh Kẹo & Thực Phẩm Đại Nam',
    phone: '02837654321',
    address: 'Khu công nghiệp Vĩnh Lộc, Bình Tân',
    contactPerson: 'Chị Thảo (0933444555)',
    totalPurchased: 12400000,
    totalDebt: 0,
    note: 'Chính sách chiết khấu 2% khi thanh toán ngay',
    createdAt: getVietnamNowISO(),
  },
];

export async function loadDemoData(): Promise<void> {
  await db.transaction('rw', [db.products, db.customers, db.suppliers, db.inventoryTransactions], async () => {
    // Add products
    for (const prod of DEMO_PRODUCTS) {
      const existing = await db.products.where('code').equals(prod.code).first();
      if (!existing) {
        const id = await db.products.add(prod);
        // Add initial stock record
        if (prod.stock > 0) {
          await db.inventoryTransactions.add({
            code: `NK_INIT_${prod.code}`,
            productId: id,
            productCode: prod.code,
            productName: prod.name,
            type: 'stock_in',
            quantityChange: prod.stock,
            stockBefore: 0,
            stockAfter: prod.stock,
            unit: prod.unit,
            reason: 'Tồn đầu kỳ khởi tạo dữ liệu mẫu',
            staffName: 'Hệ thống',
            createdAt: getVietnamNowISO(),
          });
        }
      }
    }

    // Add customers
    for (const cust of DEMO_CUSTOMERS) {
      const existing = await db.customers.where('code').equals(cust.code).first();
      if (!existing) {
        await db.customers.add(cust);
      }
    }

    // Add suppliers
    for (const supp of DEMO_SUPPLIERS) {
      const existing = await db.suppliers.where('code').equals(supp.code).first();
      if (!existing) {
        await db.suppliers.add(supp);
      }
    }
  });
}

export async function clearAllStoreData(): Promise<void> {
  await db.transaction('rw', [
    db.products,
    db.customers,
    db.suppliers,
    db.orders,
    db.purchaseOrders,
    db.inventoryTransactions,
    db.cashTransactions,
    db.stockChecks,
  ], async () => {
    await db.products.clear();
    await db.customers.clear();
    await db.suppliers.clear();
    await db.orders.clear();
    await db.purchaseOrders.clear();
    await db.inventoryTransactions.clear();
    await db.cashTransactions.clear();
    await db.stockChecks.clear();
  });
}
