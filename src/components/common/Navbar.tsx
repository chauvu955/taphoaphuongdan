import React, { useState, useEffect } from 'react';
import {
  Store,
  Clock,
  User,
  HardDriveDownload,
  Download,
  WifiOff,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { Employee, StoreSettings } from '../../types';
import { formatDate } from '../../utils/formatters';
import { exportDatabaseToJSON, triggerDownload } from '../../db/backupService';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface NavbarProps {
  settings: StoreSettings | null;
  currentStaff: Employee | null;
  onOpenPinModal: () => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  currentStaff,
  onOpenPinModal,
  onRefreshData,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [backupToast, setBackupToast] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isInstallable, install } = usePWAInstall();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[now.getDay()];
      const timeStr = formatDate(now.toISOString(), true);
      setCurrentTime(`${dayName}, ${timeStr}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickBackup = async () => {
    try {
      setIsBackingUp(true);
      const { blob, filename, summary } = await exportDatabaseToJSON();
      triggerDownload(blob, filename);
      setBackupToast(`Đã sao lưu thành công ${summary.productCount} SP, ${summary.orderCount} hóa đơn!`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setBackupToast(null), 4000);
    } catch (err: any) {
      alert('Lỗi sao lưu: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">Chủ Cửa Hàng</span>;
      case 'manager':
        return <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-200">Quản Lý</span>;
      default:
        return <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">Thu Ngân</span>;
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-sky-800 bg-sky-900 px-4 text-white shadow-md select-none">
      {/* Brand & Store Name */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
          <Store className="h-5 w-5 text-sky-200" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            {settings?.storeName || 'GroceryPro POS'}
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              Windows POS
            </span>
          </h1>
        </div>
      </div>

      {/* Center: Live Vietnamese Clock */}
      <div className="hidden lg:flex items-center gap-2 rounded-md bg-sky-950/50 px-3 py-1 text-xs font-medium text-sky-200 ring-1 ring-sky-700/50">
        <Clock className="h-3.5 w-3.5 text-sky-400" />
        <span>{currentTime}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Offline Badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <WifiOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Offline (Dữ liệu cục bộ)</span>
        </div>

        {/* PWA Install Button if available */}
        {isInstallable && (
          <button
            onClick={install}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 transition active:scale-95"
            title="Cài đặt GroceryPro lên máy tính Windows"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Cài App Windows</span>
          </button>
        )}

        {/* Quick Backup Button */}
        <button
          onClick={handleQuickBackup}
          disabled={isBackingUp}
          className="flex items-center gap-1.5 rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition active:scale-95 disabled:opacity-50"
          title="Sao lưu toàn bộ cơ sở dữ liệu ngay ra file máy tính"
        >
          <HardDriveDownload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isBackingUp ? 'Đang xuất...' : 'Sao lưu nhanh'}</span>
        </button>

        {/* Staff Switch / Profile */}
        <button
          onClick={onOpenPinModal}
          className="flex items-center gap-2 rounded-md bg-sky-950/70 px-2.5 py-1 text-xs text-white ring-1 ring-sky-700/60 hover:bg-sky-800 transition active:scale-95"
          title="Nhấn để đổi ca hoặc đăng nhập mã PIN"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-700 text-sky-100">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-semibold leading-tight">{currentStaff?.name || 'Nhân viên'}</span>
            <div className="flex items-center gap-1">
              {getRoleBadge(currentStaff?.role)}
              <KeyRound className="h-3 w-3 text-sky-400" />
            </div>
          </div>
        </button>
      </div>

      {/* Backup Notification Toast */}
      {backupToast && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-emerald-400 shadow-xl ring-1 ring-emerald-500/50 backdrop-blur animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{backupToast}</span>
        </div>
      )}
    </header>
  );
};
