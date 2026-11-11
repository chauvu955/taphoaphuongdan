import React, { useState, useEffect } from 'react';
import { db, initDatabaseDefaults } from './db/db';
import type { StoreSettings } from './types';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/common/Navbar';
import { Sidebar, type TabKey } from './components/common/Sidebar';
import { PinAuthModal } from './components/common/PinAuthModal';

// Modules
import { DashboardModule } from './components/dashboard/DashboardModule';
import { PosModule } from './components/pos/PosModule';
import { ProductList } from './components/products/ProductList';
import { PurchaseModule } from './components/purchases/PurchaseModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { CustomerModule } from './components/customers/CustomerModule';
import { SupplierModule } from './components/suppliers/SupplierModule';
import { DebtModule } from './components/debts/DebtModule';
import { CashbookModule } from './components/cashbook/CashbookModule';
import { ReportModule } from './components/reports/ReportModule';
import { EmployeeModule } from './components/employees/EmployeeModule';
import { SettingsModule } from './components/settings/SettingsModule';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('pos');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);

  const { currentStaff, switchStaffByPin, loading: authLoading } = useAuth();

  useEffect(() => {
    async function boot() {
      try {
        await initDatabaseDefaults();
        await loadSettings();
        await updateLowStockCount();
        setIsDbReady(true);
      } catch (err) {
        console.error('Lỗi khởi động cơ sở dữ liệu POS:', err);
      }
    }
    boot();
  }, []);

  const loadSettings = async () => {
    const s = await db.settings.toCollection().first();
    setSettings(s || null);
  };

  const updateLowStockCount = async () => {
    const products = await db.products.toArray();
    const count = products.filter((p) => p.stock <= p.minStock).length;
    setLowStockCount(count);
  };

  const handleRefreshAll = async () => {
    await loadSettings();
    await updateLowStockCount();
  };

  if (!isDbReady || authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <h2 className="text-base font-bold tracking-tight">Đang tải GroceryPro POS...</h2>
          <p className="text-xs text-slate-400">Đang khởi tạo cơ sở dữ liệu IndexedDB cục bộ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans">
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        currentStaff={currentStaff}
        onOpenPinModal={() => setIsPinModalOpen(true)}
        onRefreshData={handleRefreshAll}
      />

      {/* Main Body: Sidebar + Active Module */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          lowStockCount={lowStockCount}
        />

        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'dashboard' && (
            <DashboardModule onNavigateTab={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'pos' && (
            <PosModule
              settings={settings}
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'products' && (
            <ProductList onRefreshData={handleRefreshAll} />
          )}

          {activeTab === 'purchases' && (
            <PurchaseModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'suppliers' && (
            <SupplierModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'debt' && (
            <DebtModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'cashbook' && (
            <CashbookModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'reports' && <ReportModule />}

          {activeTab === 'employees' && (
            <EmployeeModule
              currentStaff={currentStaff}
              onRefreshData={handleRefreshAll}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              settings={settings}
              onRefreshSettings={loadSettings}
              onRefreshAllData={handleRefreshAll}
            />
          )}
        </main>
      </div>

      {/* PIN Authentication Keypad Modal */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={switchStaffByPin}
      />
    </div>
  );
}
