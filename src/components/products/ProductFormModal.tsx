import React, { useState, useEffect } from 'react';
import { Package, X, Plus, Trash2, Check, Barcode } from 'lucide-react';
import { db } from '../../db/db';
import type { Product, UnitConversion, Supplier } from '../../types';
import { getVietnamNowISO, generateCode } from '../../utils/formatters';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSuccess: () => void;
  categories: string[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSuccess,
  categories,
}) => {
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Thực phẩm');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('Gói');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [additionalUnits, setAdditionalUnits] = useState<UnitConversion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadSuppliers();
    if (productToEdit) {
      setCode(productToEdit.code);
      setBarcode(productToEdit.barcode || '');
      setName(productToEdit.name);
      setCategory(productToEdit.category || 'Thực phẩm');
      setBrand(productToEdit.brand || '');
      setUnit(productToEdit.unit || 'Cái');
      setCostPrice(productToEdit.costPrice || 0);
      setSellingPrice(productToEdit.sellingPrice || 0);
      setWholesalePrice(productToEdit.wholesalePrice || 0);
      setStock(productToEdit.stock || 0);
      setMinStock(productToEdit.minStock || 5);
      setNote(productToEdit.note || '');
      setStatus(productToEdit.status || 'active');
      setSupplierId(productToEdit.supplierId);
      setAdditionalUnits(productToEdit.additionalUnits || []);
    } else {
      resetForm();
    }
  }, [productToEdit, isOpen]);

  const loadSuppliers = async () => {
    const s = await db.suppliers.toArray();
    setSuppliers(s);
  };

  const resetForm = async () => {
    const count = await db.products.count();
    const newCode = generateCode('SP', count);
    setCode(newCode);
    setBarcode(newCode);
    setName('');
    setCategory(categories[0] || 'Thực phẩm');
    setBrand('');
    setUnit('Gói');
    setCostPrice(0);
    setSellingPrice(0);
    setWholesalePrice(0);
    setStock(0);
    setMinStock(5);
    setNote('');
    setStatus('active');
    setSupplierId(undefined);
    setAdditionalUnits([]);
  };

  if (!isOpen) return null;

  const handleAddUnit = () => {
    setAdditionalUnits([
      ...additionalUnits,
      {
        unitName: 'Thùng',
        conversionRate: 24,
        price: sellingPrice * 24,
        barcode: '',
      },
    ]);
  };

  const handleUpdateUnit = (idx: number, field: keyof UnitConversion, value: any) => {
    const updated = [...additionalUnits];
    updated[idx] = { ...updated[idx], [field]: value };
    setAdditionalUnits(updated);
  };

  const handleRemoveUnit = (idx: number) => {
    setAdditionalUnits(additionalUnits.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên sản phẩm.');
      return;
    }

    setIsProcessing(true);
    try {
      const now = getVietnamNowISO();
      const productData: Omit<Product, 'id'> = {
        code: code.trim(),
        barcode: barcode.trim() || code.trim(),
        name: name.trim(),
        category: category.trim(),
        brand: brand.trim(),
        unit: unit.trim(),
        costPrice,
        sellingPrice,
        wholesalePrice: wholesalePrice || undefined,
        stock,
        minStock,
        supplierId,
        supplierName: suppliers.find((s) => s.id === supplierId)?.name,
        note: note.trim(),
        status,
        additionalUnits,
        createdAt: productToEdit ? productToEdit.createdAt : now,
        updatedAt: now,
      };

      if (productToEdit && productToEdit.id) {
        await db.products.update(productToEdit.id, productData);
      } else {
        const id = await db.products.add(productData);
        // Record initial inventory if stock > 0
        if (stock > 0) {
          const txCount = await db.inventoryTransactions.count();
          await db.inventoryTransactions.add({
            code: generateCode('NK', txCount),
            productId: id,
            productCode: productData.code,
            productName: productData.name,
            type: 'stock_in',
            quantityChange: stock,
            stockBefore: 0,
            stockAfter: stock,
            unit: productData.unit,
            reason: 'Khởi tạo số dư tồn ban đầu',
            staffName: 'Quản trị viên',
            createdAt: now,
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Lỗi lưu sản phẩm: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <Package className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {productToEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tên sản phẩm <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Mì Hảo Hảo Tôm Chua Cay"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nhóm hàng / Danh mục:</label>
              <input
                type="text"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Thực phẩm khô, Đồ uống, Gia vị..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mã sản phẩm (Mã nội bộ):</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mã vạch (Barcode quét):</label>
              <div className="relative">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Quét hoặc nhập mã vạch..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono outline-none focus:border-sky-500 pr-8"
                />
                <Barcode className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Đơn vị tính cơ bản:</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="VD: Lon, Chai, Gói, Hộp, Kg..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Thương hiệu / Xuất xứ:</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="VD: Acecook, Masan, Vinamilk..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-3">Giá Bán & Tồn Kho</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Giá vốn (Giá nhập):</label>
                <input
                  type="number"
                  min="0"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Giá bán lẻ <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={sellingPrice || ''}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold text-sky-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Giá bán sỉ:</label>
                <input
                  type="number"
                  min="0"
                  value={wholesalePrice || ''}
                  onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Số lượng tồn kho:</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tồn tối thiểu (cảnh báo):</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Trạng thái:</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold outline-none"
                >
                  <option value="active">Đang kinh doanh</option>
                  <option value="inactive">Ngừng kinh doanh</option>
                </select>
              </div>
            </div>
          </div>

          {/* Multi-unit conversions */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Đơn Vị Tính Quy Đổi (Nhiều ĐVT)</h4>
                <p className="text-[11px] text-slate-500">
                  Ví dụ: 1 Thùng = 24 Lon (hệ thống tự trừ 24 lon khi bán 1 thùng)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddUnit}
                className="flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm đơn vị
              </button>
            </div>

            {additionalUnits.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa thiết lập đơn vị quy đổi phụ</p>
            ) : (
              <div className="space-y-2">
                {additionalUnits.map((u, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="w-28">
                      <input
                        type="text"
                        placeholder="Tên ĐVT (Thùng, Lốc)"
                        value={u.unitName}
                        onChange={(e) => handleUpdateUnit(idx, 'unitName', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1 text-xs outline-none"
                      />
                    </div>
                    <span className="text-slate-400">=</span>
                    <div className="w-20">
                      <input
                        type="number"
                        min="2"
                        placeholder="Quy đổi"
                        value={u.conversionRate}
                        onChange={(e) =>
                          handleUpdateUnit(idx, 'conversionRate', parseFloat(e.target.value) || 1)
                        }
                        className="w-full rounded border border-slate-300 p-1 text-xs font-mono outline-none"
                      />
                    </div>
                    <span className="text-slate-500 text-[11px]">{unit}</span>

                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder="Giá bán theo ĐVT này"
                        value={u.price}
                        onChange={(e) =>
                          handleUpdateUnit(idx, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-slate-300 p-1 text-xs font-mono text-sky-700 font-bold outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveUnit(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier and Note */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nhà cung cấp chính:</label>
              <select
                value={supplierId || ''}
                onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ghi chú hàng hóa:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Hàng dễ vỡ, bảo quản mát..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isProcessing ? 'Đang lưu...' : 'Lưu Sản Phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
