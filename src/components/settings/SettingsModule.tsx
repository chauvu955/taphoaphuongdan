import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDriveDownload,
  HardDriveUpload,
  Printer,
  Store,
  ShieldCheck,
  Database,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { db } from '../../db/db';
import type { StoreSettings } from '../../types';
import {
  exportDatabaseToJSON,
  triggerDownload,
  validateBackupFile,
  restoreDatabaseFromJSON,
} from '../../db/backupService';
import { loadDemoData, clearAllStoreData } from '../../db/demoData';
import { formatDate } from '../../utils/formatters';

interface SettingsModuleProps {
  settings: StoreSettings | null;
  onRefreshSettings: () => void;
  onRefreshAllData?: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  settings,
  onRefreshSettings,
  onRefreshAllData,
}) => {
  // Store form state
  const [storeName, setStoreName] = useState(settings?.storeName || '');
  const [storePhone, setStorePhone] = useState(settings?.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(settings?.storeAddress || '');
  const [receiptFooter, setReceiptFooter] = useState(settings?.receiptFooter || '');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(settings?.paperSize || '80mm');
  const [allowNegativeStock, setAllowNegativeStock] = useState(settings?.allowNegativeStock ?? false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(settings?.autoPrintReceipt ?? true);
  const [defaultPrinter, setDefaultPrinter] = useState(settings?.defaultPrinter || 'Máy in nhiệt tiêu chuẩn');

  // Backup & Storage
  const [lastBackup, setLastBackup] = useState<string | null>(settings?.lastBackupDate || null);
  const [storageUsage, setStorageUsage] = useState<string>('Đang tính...');
  const [isExporting, setIsExporting] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestorePkg, setPendingRestorePkg] = useState<any | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName);
      setStorePhone(settings.storePhone);
      setStoreAddress(settings.storeAddress);
      setReceiptFooter(settings.receiptFooter);
      setPaperSize(settings.paperSize);
      setAllowNegativeStock(settings.allowNegativeStock);
      setAutoPrintReceipt(settings.autoPrintReceipt);
      setDefaultPrinter(settings.defaultPrinter);
      setLastBackup(settings.lastBackupDate || null);
    }
    checkStorageEstimate();
  }, [settings]);

  const checkStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageMB = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((est.quota || 0) / (1024 * 1024 * 1024)).toFixed(2);
        setStorageUsage(`${usageMB} MB đã dùng trên tổng quota khả dụng ${quotaMB} GB`);
      } catch {
        setStorageUsage('Không thể đo lường');
      }
    } else {
      setStorageUsage('Lưu trữ IndexedDB cục bộ');
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const current = await db.settings.toCollection().first();
      const updatedData: StoreSettings = {
        storeName: storeName.trim(),
        storePhone: storePhone.trim(),
        storeAddress: storeAddress.trim(),
        receiptFooter: receiptFooter.trim(),
        paperSize,
        allowNegativeStock,
        autoPrintReceipt,
        defaultPrinter: defaultPrinter.trim(),
        barcodePrefix: current?.barcodePrefix || 'SP',
        currencySymbol: 'đ',
        lastBackupDate: lastBackup || undefined,
      };

      if (current && current.id) {
        await db.settings.update(current.id, updatedData);
      } else {
        await db.settings.add(updatedData);
      }

      alert('Đã lưu cấu hình cửa hàng thành công!');
      onRefreshSettings();
    } catch (err: any) {
      alert('Lỗi lưu cấu hình: ' + err.message);
    }
  };

  const handleBackupExport = async () => {
    setIsExporting(true);
    try {
      const { blob, filename, summary } = await exportDatabaseToJSON();
      triggerDownload(blob, filename);
      setLastBackup(new Date().toISOString());
      alert(`Đã sao lưu ${summary.productCount} sản phẩm, ${summary.orderCount} hóa đơn và toàn bộ dữ liệu ra tệp:\n${filename}`);
      onRefreshSettings();
    } catch (err: any) {
      alert('Lỗi sao lưu: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateBackupFile(parsed);

        if (!validation.valid) {
          alert('Tệp sao lưu không hợp lệ: ' + validation.error);
          return;
        }

        setPendingRestorePkg(validation.pkg);
        setRestoreSummary(validation.pkg?.metadata);
        setRestoreConfirmOpen(true);
      } catch (err: any) {
        alert('Lỗi đọc tệp backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestorePkg) return;
    setIsRestoring(true);
    try {
      await restoreDatabaseFromJSON(pendingRestorePkg);
      alert('Phục hồi dữ liệu từ bản sao lưu thành công!');
      setRestoreConfirmOpen(false);
      setPendingRestorePkg(null);
      onRefreshSettings();
      if (onRefreshAllData) onRefreshAllData();
      window.location.reload();
    } catch (err: any) {
      alert('Lỗi phục hồi: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLoadDemo = async () => {
    const confirm = window.confirm(
      'Nạp thêm danh sách sản phẩm và đối tác mẫu để thử nghiệm tính năng bán hàng và báo cáo?'
    );
    if (!confirm) return;
    await loadDemoData();
    alert('Đã nạp dữ liệu mẫu thành công!');
    if (onRefreshAllData) onRefreshAllData();
  };

  const handleClearAll = async () => {
    const confirm = window.confirm(
      'CẢNH BÁO: Thao tác này sẽ xóa toàn bộ hàng hóa, khách hàng, nhà cung cấp, hóa đơn và thẻ kho để đưa hệ thống về trạng thái sạch sẽ!\n\nBạn có muốn tiếp tục?'
    );
    if (!confirm) return;
    await clearAllStoreData();
    alert('Đã dọn dẹp sạch sẽ toàn bộ dữ liệu!');
    if (onRefreshAllData) onRefreshAllData();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-5 select-none space-y-5">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-sky-600" /> Cài Đặt Hệ Thống & Sao Lưu
        </h2>
        <p className="text-xs text-slate-500">
          Thông tin cửa hàng, mẫu in hóa đơn nhiệt, sao lưu phục hồi dữ liệu và kiểm tra lưu trữ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Store Profile & Printer */}
        <div className="space-y-5">
          <form
            onSubmit={handleSaveStoreSettings}
            className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="h-5 w-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">Thông Tin Cửa Hàng & Hóa Đơn</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên cửa hàng tạp hóa <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại liên hệ:</label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khổ giấy in hóa đơn nhiệt:</label>
                  <select
                    value={paperSize}
                    onChange={(e: any) => setPaperSize(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold outline-none"
                  >
                    <option value="80mm">Khổ giấy 80mm (Khuyên dùng cho POS quầy)</option>
                    <option value="58mm">Khổ giấy nhỏ 58mm</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ cửa hàng:</label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lời cảm ơn chân trang hóa đơn:</label>
                <input
                  type="text"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Cảm ơn quý khách! Hẹn gặp lại quý khách lần sau!"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Tự động mở lệnh in hóa đơn ngay sau khi bấm thanh toán</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowNegativeStock}
                    onChange={(e) => setAllowNegativeStock(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Cho phép bán hàng khi tồn kho âm (chưa kịp nhập kho nhưng cần bán gấp)</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-500 transition"
              >
                Lưu Thay Đổi Cài Đặt
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Backup, Restore & Demo Data Management */}
        <div className="space-y-5">
          {/* Backup and Restore Box */}
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Database className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Sao Lưu & Phục Hồi Dữ Liệu Cục Bộ</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Dữ liệu được lưu trữ an toàn trong IndexedDB của máy tính. Bạn có thể xuất file sao lưu
              (định dạng chuẩn JSON) sang ổ D, USB hoặc ổ cứng ngoài bất kỳ lúc nào mà không cần mạng Internet.
            </p>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Trạng thái lưu trữ:</span>
                <span className="font-semibold text-emerald-700">{storageUsage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lần sao lưu gần nhất:</span>
                <span className="font-mono font-bold text-slate-800">
                  {lastBackup ? formatDate(lastBackup) : 'Chưa sao lưu lần nào'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleBackupExport}
                disabled={isExporting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-500 active:scale-98 transition disabled:opacity-50"
              >
                <HardDriveDownload className="h-4 w-4" />
                {isExporting ? 'Đang xuất...' : 'Xuất File Sao Lưu (.JSON)'}
              </button>

              <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer transition">
                <HardDriveUpload className="h-4 w-4 text-slate-500" />
                <span>Phục Hồi Từ File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestoreSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Demo & Reset Data Management */}
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" /> Quản Lý Dữ Liệu Mẫu & Làm Sạch
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bạn có thể nạp các sản phẩm tạp hóa Việt Nam phổ biến để trải nghiệm, hoặc dọn sạch toàn bộ cơ sở dữ liệu để nhập hàng hóa thật.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={handleLoadDemo}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-300 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
              >
                <Sparkles className="h-4 w-4 text-amber-600" />
                Nạp Dữ Liệu Mẫu Để Dùng Thử
              </button>

              <button
                onClick={handleClearAll}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-300 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                Xóa Sạch Dữ Liệu (Về Trắng)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreConfirmOpen && restoreSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-sm font-bold text-slate-800">Xác Nhận Phục Hồi Dữ Liệu</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tệp sao lưu hợp lệ đã được xác thực toàn vẹn. Phục hồi sẽ ghi đè dữ liệu hiện tại bằng dữ liệu trong tệp sao lưu:
            </p>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs space-y-1 font-mono">
              <p>• Tên cửa hàng: <strong>{restoreSummary.storeName}</strong></p>
              <p>• Số lượng sản phẩm: <strong>{restoreSummary.productCount}</strong></p>
              <p>• Số lượng hóa đơn: <strong>{restoreSummary.orderCount}</strong></p>
              <p>• Khách hàng: <strong>{restoreSummary.customerCount}</strong></p>
              <p>• Nhà cung cấp: <strong>{restoreSummary.supplierCount}</strong></p>
              <p>• Giao dịch kho: <strong>{restoreSummary.inventoryTxCount}</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setRestoreConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
              >
                {isRestoring ? 'Đang phục hồi...' : 'Xác Nhận Phục Hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
