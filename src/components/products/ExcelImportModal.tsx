import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, X, CheckCircle, AlertTriangle, ArrowRight, Upload } from 'lucide-react';
import { db } from '../../db/db';
import type { Product } from '../../types';
import { getVietnamNowISO } from '../../utils/formatters';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ColumnMap {
  code: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  stock: string;
  minStock: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  // Column Mapping state
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    code: '',
    barcode: '',
    name: '',
    category: '',
    brand: '',
    unit: '',
    costPrice: '',
    sellingPrice: '',
    wholesalePrice: '',
    stock: '',
    minStock: '',
  });

  const [previewProducts, setPreviewProducts] = useState<Omit<Product, 'id'>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
          alert('Tệp Excel không có đủ dữ liệu hàng hóa.');
          return;
        }

        const rawHeaders = (data[0] || []).map((h: any) => String(h || '').trim());
        setHeaders(rawHeaders);

        // Convert rows to key-value objects
        const rows: any[] = [];
        for (let i = 1; i < data.length; i++) {
          const rowData = data[i];
          if (!rowData || rowData.length === 0) continue;
          const obj: any = {};
          rawHeaders.forEach((h: string, colIdx: number) => {
            obj[h] = rowData[colIdx];
          });
          rows.push(obj);
        }
        setRawRows(rows);

        // Auto guess columns
        autoMapHeaders(rawHeaders);
        setStep('mapping');
      } catch (err: any) {
        alert('Lỗi đọc tệp Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(selected);
  };

  const autoMapHeaders = (fileHeaders: string[]) => {
    const map: ColumnMap = { ...columnMap };
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    fileHeaders.forEach((h) => {
      const n = normalize(h);
      if (n.includes('mahang') || n.includes('masp') || n.includes('code')) map.code = h;
      else if (n.includes('barcode') || n.includes('mavait') || n.includes('mavach')) map.barcode = h;
      else if (n.includes('tenhang') || n.includes('tensp') || n.includes('name') || n.includes('sanpham')) map.name = h;
      else if (n.includes('nhom') || n.includes('danhmuc') || n.includes('category')) map.category = h;
      else if (n.includes('thuonghieu') || n.includes('hang') || n.includes('brand')) map.brand = h;
      else if (n.includes('dvt') || n.includes('donvi') || n.includes('unit')) map.unit = h;
      else if (n.includes('gianhap') || n.includes('giavon') || n.includes('cost')) map.costPrice = h;
      else if (n.includes('giaban') || n.includes('price') || n.includes('banle')) map.sellingPrice = h;
      else if (n.includes('giasi') || n.includes('bansii') || n.includes('wholesale')) map.wholesalePrice = h;
      else if (n.includes('ton') || n.includes('tonkho') || n.includes('soluong') || n.includes('stock')) map.stock = h;
      else if (n.includes('tontoithieu') || n.includes('minstock')) map.minStock = h;
    });

    setColumnMap(map);
  };

  const handleValidateAndPreview = async () => {
    if (!columnMap.name) {
      alert('Vui lòng chọn cột Tên sản phẩm.');
      return;
    }

    const errors: string[] = [];
    const productsToImport: Omit<Product, 'id'>[] = [];
    const existingCodes = new Set((await db.products.toArray()).map((p) => p.code.toLowerCase()));
    const now = getVietnamNowISO();

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const name = String(row[columnMap.name] || '').trim();
      if (!name) {
        errors.push(`Dòng ${rowNum}: Thiếu tên sản phẩm.`);
        return;
      }

      let code = columnMap.code ? String(row[columnMap.code] || '').trim() : '';
      if (!code) {
        code = `SP_EX_${String(index + 1).padStart(5, '0')}`;
      } else if (existingCodes.has(code.toLowerCase())) {
        errors.push(`Dòng ${rowNum}: Mã hàng "${code}" đã tồn tại trong phần mềm.`);
      }

      const barcode = columnMap.barcode ? String(row[columnMap.barcode] || '').trim() : code;
      const category = columnMap.category ? String(row[columnMap.category] || 'Mặc định').trim() : 'Mặc định';
      const brand = columnMap.brand ? String(row[columnMap.brand] || '').trim() : '';
      const unit = columnMap.unit ? String(row[columnMap.unit] || 'Cái').trim() : 'Cái';

      const costPrice = columnMap.costPrice ? parseFloat(String(row[columnMap.costPrice]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const sellingPrice = columnMap.sellingPrice ? parseFloat(String(row[columnMap.sellingPrice]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const wholesalePrice = columnMap.wholesalePrice ? parseFloat(String(row[columnMap.wholesalePrice]).replace(/[^0-9.]/g, '')) || 0 : undefined;
      const stock = columnMap.stock ? parseFloat(String(row[columnMap.stock]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const minStock = columnMap.minStock ? parseFloat(String(row[columnMap.minStock]).replace(/[^0-9.]/g, '')) || 5 : 5;

      productsToImport.push({
        code,
        barcode,
        name,
        category,
        brand,
        unit,
        costPrice,
        sellingPrice,
        wholesalePrice,
        stock,
        minStock,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    });

    setImportErrors(errors);
    setPreviewProducts(productsToImport);
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    if (previewProducts.length === 0) {
      alert('Không có sản phẩm hợp lệ để nhập vào hệ thống.');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.products, db.inventoryTransactions], async () => {
        for (const prod of previewProducts) {
          const id = await db.products.add(prod);
          if (prod.stock > 0) {
            await db.inventoryTransactions.add({
              code: `NK_EXCEL_${prod.code}`,
              productId: id,
              productCode: prod.code,
              productName: prod.name,
              type: 'stock_in',
              quantityChange: prod.stock,
              stockBefore: 0,
              stockAfter: prod.stock,
              unit: prod.unit,
              reason: 'Nhập tồn đầu kỳ từ file Excel',
              staffName: 'Quản trị viên',
              createdAt: getVietnamNowISO(),
            });
          }
        }
      });

      alert(`Đã nhập thành công ${previewProducts.length} sản phẩm từ file Excel!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Lỗi nhập dữ liệu: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Nhập Danh Sách Hàng Hóa Từ File Excel</h3>
              <p className="text-xs text-slate-500">Hỗ trợ tệp .xlsx, .xls, .csv không giới hạn số lượng</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-10 hover:border-emerald-500 transition">
              <Upload className="h-12 w-12 text-slate-400 mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Kéo thả hoặc Chọn file Excel hàng hóa</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">Hỗ trợ định dạng .xlsx, .xls, .csv</p>

              <label className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition">
                <span>Chọn File Từ Máy Tính</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800">
                Tìm thấy <strong>{rawRows.length} dòng</strong> trong file. Vui lòng ghép các cột dữ liệu tương ứng bên dưới:
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên sản phẩm <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={columnMap.name}
                    onChange={(e) => setColumnMap({ ...columnMap, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Tên hàng --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã sản phẩm:</label>
                  <select
                    value={columnMap.code}
                    onChange={(e) => setColumnMap({ ...columnMap, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Tự động sinh nếu để trống --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã vạch (Barcode):</label>
                  <select
                    value={columnMap.barcode}
                    onChange={(e) => setColumnMap({ ...columnMap, barcode: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Mã vạch --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhóm hàng / Danh mục:</label>
                  <select
                    value={columnMap.category}
                    onChange={(e) => setColumnMap({ ...columnMap, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Nhóm hàng --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn vị tính:</label>
                  <select
                    value={columnMap.unit}
                    onChange={(e) => setColumnMap({ ...columnMap, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Đơn vị tính --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giá bán lẻ:</label>
                  <select
                    value={columnMap.sellingPrice}
                    onChange={(e) => setColumnMap({ ...columnMap, sellingPrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Giá bán --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giá vốn (Giá nhập):</label>
                  <select
                    value={columnMap.costPrice}
                    onChange={(e) => setColumnMap({ ...columnMap, costPrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Giá vốn --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số lượng tồn kho ban đầu:</label>
                  <select
                    value={columnMap.stock}
                    onChange={(e) => setColumnMap({ ...columnMap, stock: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn cột Tồn kho --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Chọn lại file
                </button>
                <button
                  onClick={handleValidateAndPreview}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-500 shadow-sm"
                >
                  Kiểm Tra & Xem Trước →
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {importErrors.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1 max-h-36 overflow-y-auto">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4" /> Phát hiện {importErrors.length} cảnh báo/lỗi:
                  </div>
                  {importErrors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span>
                  Sẵn sàng nhập <strong>{previewProducts.length} sản phẩm</strong> hợp lệ vào cơ sở dữ liệu.
                </span>
                <span className="font-semibold text-emerald-800">Không làm mất dữ liệu cũ</span>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2">Mã SP</th>
                      <th className="p-2">Tên sản phẩm</th>
                      <th className="p-2">Nhóm hàng</th>
                      <th className="p-2">ĐVT</th>
                      <th className="p-2 text-right">Giá vốn</th>
                      <th className="p-2 text-right">Giá bán</th>
                      <th className="p-2 text-right">Tồn đầu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewProducts.slice(0, 50).map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-[11px]">{p.code}</td>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 text-slate-500">{p.category}</td>
                        <td className="p-2">{p.unit}</td>
                        <td className="p-2 text-right font-mono">{p.costPrice.toLocaleString()} đ</td>
                        <td className="p-2 text-right font-mono font-bold text-sky-700">{p.sellingPrice.toLocaleString()} đ</td>
                        <td className="p-2 text-right font-mono">{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setStep('mapping')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Quay lại ghép cột
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isProcessing || previewProducts.length === 0}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {isProcessing ? 'Đang nhập dữ liệu...' : 'Xác Nhận Nhập Hàng Hóa'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
