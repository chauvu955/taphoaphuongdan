import { useState, useEffect } from 'react';
import { db } from '../db/db';
import type { Employee } from '../types';

export function useAuth() {
  const [currentStaff, setCurrentStaff] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCurrentStaff() {
      const savedCode = localStorage.getItem('grocerypro_current_staff_code');
      const staffList = await db.employees.where('active').equals(1).toArray();
      
      if (staffList.length === 0) {
        // Fallback default
        const defaultOwner: Employee = {
          code: 'NV001',
          name: 'Chủ Cửa Hàng',
          phone: '0988123456',
          role: 'owner',
          pin: '1234',
          active: true,
          createdAt: new Date().toISOString(),
          permissions: {
            viewRevenue: true,
            viewProfit: true,
            editPrice: true,
            applyDiscount: true,
            cancelOrder: true,
            manageInventory: true,
            manageDebt: true,
            manageStaff: true,
            viewReports: true,
          },
        };
        setCurrentStaff(defaultOwner);
      } else {
        const found = staffList.find((s) => s.code === savedCode) || staffList[0];
        setCurrentStaff(found);
      }
      setLoading(false);
    }
    loadCurrentStaff();
  }, []);

  const switchStaffByPin = async (pin: string): Promise<{ success: boolean; message?: string }> => {
    const staffList = await db.employees.toArray();
    const matched = staffList.find((s) => s.pin === pin.trim() && s.active);
    if (!matched) {
      return { success: false, message: 'Mã PIN không đúng hoặc nhân viên đã bị vô hiệu hóa!' };
    }
    setCurrentStaff(matched);
    localStorage.setItem('grocerypro_current_staff_code', matched.code);
    return { success: true };
  };

  const logoutToCashier = async () => {
    const cashiers = await db.employees.where('role').equals('cashier').toArray();
    if (cashiers.length > 0) {
      setCurrentStaff(cashiers[0]);
      localStorage.setItem('grocerypro_current_staff_code', cashiers[0].code);
    }
  };

  return {
    currentStaff,
    setCurrentStaff,
    switchStaffByPin,
    logoutToCashier,
    loading,
  };
}
