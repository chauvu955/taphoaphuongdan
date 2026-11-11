import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Warehouse,
  Users,
  Building2,
  ReceiptText,
  BadgeDollarSign,
  BarChart3,
  UserCog,
  Settings,
  AlertTriangle,
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'purchases'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'debt'
  | 'cashbook'
  | 'reports'
  | 'employees'
  | 'settings';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  lowStockCount?: number;
}

interface MenuItem {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  badge?: number;
  highlight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, lowStockCount = 0 }) => {
  const menuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'pos', label: 'Bán hàng (POS)', icon: ShoppingCart, highlight: true },
    { key: 'products', label: 'Hàng hóa', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { key: 'purchases', label: 'Nhập hàng', icon: Truck },
    { key: 'inventory', label: 'Quản lý kho', icon: Warehouse },
    { key: 'customers', label: 'Khách hàng', icon: Users },
    { key: 'suppliers', label: 'Nhà cung cấp', icon: Building2 },
    { key: 'debt', label: 'Công nợ', icon: ReceiptText },
    { key: 'cashbook', label: 'Thu chi', icon: BadgeDollarSign },
    { key: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { key: 'employees', label: 'Nhân viên', icon: UserCog },
    { key: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 select-none">
      {/* Navigation Links */}
      <nav className="p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold shadow-sm shadow-sky-900/50'
                  : item.highlight
                  ? 'bg-slate-800/80 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 font-semibold border border-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex items-center gap-1 bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[10px] animate-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <span>Hệ thống:</span>
          <span className="text-emerald-400 font-mono font-medium">Sẵn sàng</span>
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
          <span>Phiên bản POS:</span>
          <span className="font-mono">v1.2.0 (Offline)</span>
        </div>
      </div>
    </aside>
  );
};
