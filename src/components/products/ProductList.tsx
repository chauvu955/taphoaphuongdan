import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Package,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Edit,
  Trash2,
  AlertTriangle,
  XCircle,
  Barcode,
  Layers,
  Sparkles,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Product } from '../../types';
import { formatVND } from '../../utils/formatters';
import { ProductFormModal } from './ProductFormModal';
import { ExcelImportModal } from './ExcelImportModal';
import { loadDemoData, clearAllStoreData } from '../../db/demoData';

interface ProductListProps {
  onRefreshData?: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({ onRefreshData }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'priceAsc' | 'priceDesc'>('name');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const list = await db.products.toArray();
    setProducts(list);

    const cats = Array.from(new Set(list.map((p) => p.category).filter(Boolean)));
    setCategories(cats);
    setLoading(false);
  };

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsFormOpen(true);
  };

  const handleDelete = async (prod: Product) => {
    if (!prod.id) return;
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa sản phẩm "${prod.name}" khỏi hệ thống?`
    );
    if (confirmDelete) {
      await db.products.delete(prod.id);
      await loadProducts();
      if (onRefreshData) onRefreshData();
    }
  };

  const handleExportExcel = () => {
    if (products.length === 0) {
      alert('Không có sản phẩm nào để xuất.');
      return;
    }
    const exportData = products.map((p) => ({
      'Mã hàng': p.code,
      'Mã vạch': p.barcode,
      'Tên sản phẩm': p.name,
      'Nhóm hàng': p.category,
      'Thương hiệu': p.brand || '',
      'Đơn vị tính': p.unit,
      'Giá vốn': p.costPrice,
      'Giá bán': p.sellingPrice,
      'Giá sỉ': p.wholesalePrice || '',
      'Tồn kho': p.stock,
      'Tồn tối thiểu': p.minStock,
      'Trạng thái': p.status === 'active' ? 'Đang bán' : 'Ngừng bán',
      'Ghi chú': p.note || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHangHoa');
    XLSX.writeFile(wb, `GroceryPro_HangHoa_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleLoadDemo = async () => {
    await loadDemoData();
    await loadProducts();
    if (onRefreshData) onRefreshData();
    alert('Đã nạp 10 sản phẩm tạp hóa mẫu phổ biến thành công!');
  };

  // Filter & Sort
  const filteredProducts = products
    .filter((p) => {
      const matchCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
      const term = searchTerm.toLowerCase();
      const matchTerm =
        !searchTerm ||
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        p.barcode.includes(term) ||
        (p.brand && p.brand.toLowerCase().includes(term));

      let matchStock = true;
      if (stockFilter === 'low') matchStock = p.stock > 0 && p.stock <= p.minStock;
      else if (stockFilter === 'out') matchStock = p.stock <= 0;
      else if (stockFilter === 'active') matchStock = p.status === 'active';
      else if (stockFilter === 'inactive') matchStock = p.status === 'inactive';

      return matchCat && matchTerm && matchStock;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'vi');
      if (sortBy === 'stock') return b.stock - a.stock;
      if (sortBy === 'priceAsc') return a.sellingPrice - b.sellingPrice;
      if (sortBy === 'priceDesc') return b.sellingPrice - a.sellingPrice;
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Quản Lý Hàng Hóa & Giá Bán
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
              {products.length} mặt hàng
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi tồn kho, giá vốn, giá bán, nhiều đơn vị tính và nhập xuất dữ liệu Excel
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {products.length === 0 && (
            <button
              onClick={handleLoadDemo}
              className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-xs"
            >
              <Sparkles className="h-4 w-4 text-amber-600" />
              Nạp Dữ Liệu Tạp Hóa Mẫu
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Xuất Excel
          </button>

          <button
            onClick={() => setIsExcelOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Nhập File Excel
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-md shadow-sky-600/30"
          >
            <Plus className="h-4 w-4" />
            Thêm Sản Phẩm Mới
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên SP, mã hàng, mã vạch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="Tất cả">Tất cả nhóm hàng</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Stock state */}
          <select
            value={stockFilter}
            onChange={(e: any) => setStockFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="all">Tất cả trạng thái tồn</option>
            <option value="low">Cảnh báo: Sắp hết kho</option>
            <option value="out">Cảnh báo: Đã hết hàng (0)</option>
            <option value="active">Đang kinh doanh</option>
            <option value="inactive">Ngừng kinh doanh</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="name">Sắp xếp: Tên A-Z</option>
            <option value="stock">Sắp xếp: Tồn kho giảm dần</option>
            <option value="priceAsc">Sắp xếp: Giá bán tăng dần</option>
            <option value="priceDesc">Sắp xếp: Giá bán giảm dần</option>
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="flex-1 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-3 w-10 text-center">STT</th>
                <th className="p-3">Mã hàng</th>
                <th className="p-3">Mã vạch</th>
                <th className="p-3">Tên sản phẩm</th>
                <th className="p-3">Nhóm hàng</th>
                <th className="p-3 text-center">ĐVT</th>
                <th className="p-3 text-right">Giá vốn</th>
                <th className="p-3 text-right">Giá bán lẻ</th>
                <th className="p-3 text-center">Tồn kho</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-center w-20">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400">
                    Không tìm thấy sản phẩm nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{p.code}</td>
                      <td className="p-3 font-mono text-slate-500">{p.barcode}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        <div>{p.name}</div>
                        {p.additionalUnits && p.additionalUnits.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {p.additionalUnits.map((u, i) => (
                              <span
                                key={i}
                                className="inline-block rounded bg-sky-50 px-1.5 py-0.2 text-[10px] font-medium text-sky-700 border border-sky-100"
                              >
                                1 {u.unitName} = {u.conversionRate} {p.unit} ({formatVND(u.price)})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{p.category}</td>
                      <td className="p-3 text-center font-medium">{p.unit}</td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatVND(p.costPrice)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-sky-700">
                        {formatVND(p.sellingPrice)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span
                          className={`inline-block font-bold rounded-lg px-2 py-0.5 ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700 font-extrabold'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.status === 'active' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Đang bán
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Ngừng bán
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1 rounded-lg text-slate-500 hover:bg-sky-100 hover:text-sky-700"
                            title="Sửa sản phẩm"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={editingProduct}
        onSuccess={loadProducts}
        categories={categories}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelOpen}
        onClose={() => setIsExcelOpen(false)}
        onSuccess={() => {
          loadProducts();
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
