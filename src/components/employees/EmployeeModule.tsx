import React, { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Edit,
  Trash2,
  Shield,
  KeyRound,
  Check,
  X,
  Phone,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Employee, Role, StaffPermissions } from '../../types';
import { getVietnamNowISO, generateCode } from '../../utils/formatters';

interface EmployeeModuleProps {
  currentStaff: Employee | null;
  onRefreshData?: () => void;
}

export const EmployeeModule: React.FC<EmployeeModuleProps> = ({ currentStaff, onRefreshData }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [pin, setPin] = useState('');
  const [permissions, setPermissions] = useState<StaffPermissions>({
    viewRevenue: false,
    viewProfit: false,
    editPrice: false,
    applyDiscount: true,
    cancelOrder: false,
    manageInventory: false,
    manageDebt: false,
    manageStaff: false,
    viewReports: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    const list = await db.employees.toArray();
    setEmployees(list);
  };

  const handleOpenForm = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setName(emp.name);
      setPhone(emp.phone);
      setRole(emp.role);
      setPin(emp.pin);
      setPermissions(emp.permissions);
    } else {
      setEditingEmp(null);
      setName('');
      setPhone('');
      setRole('cashier');
      setPin('');
      setPermissions({
        viewRevenue: false,
        viewProfit: false,
        editPrice: false,
        applyDiscount: true,
        cancelOrder: false,
        manageInventory: false,
        manageDebt: false,
        manageStaff: false,
        viewReports: false,
      });
    }
    setIsFormOpen(true);
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    if (newRole === 'owner') {
      setPermissions({
        viewRevenue: true,
        viewProfit: true,
        editPrice: true,
        applyDiscount: true,
        cancelOrder: true,
        manageInventory: true,
        manageDebt: true,
        manageStaff: true,
        viewReports: true,
      });
    } else if (newRole === 'manager') {
      setPermissions({
        viewRevenue: true,
        viewProfit: false,
        editPrice: true,
        applyDiscount: true,
        cancelOrder: true,
        manageInventory: true,
        manageDebt: true,
        manageStaff: false,
        viewReports: true,
      });
    } else {
      setPermissions({
        viewRevenue: false,
        viewProfit: false,
        editPrice: false,
        applyDiscount: true,
        cancelOrder: false,
        manageInventory: false,
        manageDebt: false,
        manageStaff: false,
        viewReports: false,
      });
    }
  };

  const handleTogglePermission = (key: keyof StaffPermissions) => {
    setPermissions({ ...permissions, [key]: !permissions[key] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên nhân viên.');
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      alert('Mã PIN đăng nhập phải từ 4 số trở lên.');
      return;
    }

    setIsProcessing(true);
    try {
      if (editingEmp && editingEmp.id) {
        await db.employees.update(editingEmp.id, {
          name: name.trim(),
          phone: phone.trim(),
          role,
          pin: pin.trim(),
          permissions,
        });
      } else {
        const count = await db.employees.count();
        const code = generateCode('NV', count);
        await db.employees.add({
          code,
          name: name.trim(),
          phone: phone.trim(),
          role,
          pin: pin.trim(),
          permissions,
          active: true,
          createdAt: getVietnamNowISO(),
        });
      }

      setIsFormOpen(false);
      await loadEmployees();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-5 select-none space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-sky-600" /> Quản Lý Nhân Viên & Phân Quyền
          </h2>
          <p className="text-xs text-slate-500">
            Cài đặt mã PIN đăng nhập nhanh, vai trò và phân quyền chi tiết cho từng tài khoản
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 shadow-md shadow-sky-600/30"
        >
          <Plus className="h-4 w-4" />
          Thêm Nhân Viên
        </button>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => {
          const isOwner = emp.role === 'owner';
          const isCurrent = currentStaff?.code === emp.code;

          return (
            <div
              key={emp.id}
              className={`rounded-2xl bg-white p-5 shadow-xs border transition ${
                isCurrent ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-800">{emp.name}</h3>
                    {isCurrent && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold text-sky-700">
                        Đang làm việc
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Mã NV: {emp.code}</p>
                </div>

                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    emp.role === 'owner'
                      ? 'bg-amber-100 text-amber-800'
                      : emp.role === 'manager'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {emp.role === 'owner' ? 'Chủ cửa hàng' : emp.role === 'manager' ? 'Quản lý' : 'Thu ngân'}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Số điện thoại:</span>
                  <span className="font-semibold text-slate-800">{emp.phone || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mã PIN đăng nhập:</span>
                  <span className="font-mono font-bold text-slate-800 tracking-wider">
                    {emp.pin.slice(0, 2) + '**'}
                  </span>
                </div>
              </div>

              {/* Permissions Preview */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Quyền hạn:</span>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {emp.permissions.viewRevenue && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Xem doanh thu</span>
                  )}
                  {emp.permissions.viewProfit && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Xem lợi nhuận</span>
                  )}
                  {emp.permissions.editPrice && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Sửa giá bán</span>
                  )}
                  {emp.permissions.cancelOrder && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Hủy hóa đơn</span>
                  )}
                  {emp.permissions.manageInventory && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Quản lý kho</span>
                  )}
                  {emp.permissions.manageDebt && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Quản lý nợ</span>
                  )}
                  {emp.permissions.viewReports && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Xem báo cáo</span>
                  )}
                </div>
              </div>

              {/* Edit button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleOpenForm(emp)}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Edit className="h-3.5 w-3.5" /> Chỉnh sửa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800">
              {editingEmp ? 'Cập Nhật Tài Khoản Nhân Viên' : 'Thêm Nhân Viên Mới'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Họ và tên <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại:</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0988 123 456"
                    className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vai trò:</label>
                  <select
                    value={role}
                    onChange={(e: any) => handleRoleChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 outline-none font-semibold"
                  >
                    <option value="owner">Chủ cửa hàng (Toàn quyền)</option>
                    <option value="manager">Quản lý cửa hàng</option>
                    <option value="cashier">Nhân viên bán hàng (Thu ngân)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã PIN đăng nhập nhanh (4-6 số) <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="VD: 1234"
                    className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold tracking-widest outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 mb-3">Phân Quyền Chi Tiết</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: 'viewRevenue', label: 'Xem doanh thu cửa hàng' },
                    { key: 'viewProfit', label: 'Xem giá vốn và lợi nhuận' },
                    { key: 'editPrice', label: 'Chỉnh sửa giá bán khi POS' },
                    { key: 'applyDiscount', label: 'Áp dụng giảm giá hóa đơn' },
                    { key: 'cancelOrder', label: 'Hủy hóa đơn đã thanh toán' },
                    { key: 'manageInventory', label: 'Điều chỉnh và kiểm kho' },
                    { key: 'manageDebt', label: 'Quản lý và thu/trả công nợ' },
                    { key: 'viewReports', label: 'Xem 12 báo cáo kinh doanh' },
                  ].map((p) => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={(permissions as any)[p.key]}
                        onChange={() => handleTogglePermission(p.key as keyof StaffPermissions)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-bold text-white hover:bg-sky-500"
                >
                  {isProcessing ? 'Đang lưu...' : 'Lưu Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
