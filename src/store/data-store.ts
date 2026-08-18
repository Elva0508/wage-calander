import { eq } from 'drizzle-orm';
import { Alert } from 'react-native';
import { create } from 'zustand';

import { db } from '@/db/client';
import {
  NewShift,
  NewShiftType,
  NewWorkplace,
  Shift,
  ShiftType,
  Workplace,
  shiftTypes,
  shifts,
  workplaces,
} from '@/db/schema';

interface DataState {
  shifts: Shift[];
  shiftTypes: ShiftType[];
  workplaces: Workplace[];
  loaded: boolean;
  refresh: () => Promise<void>;

  addShift: (shift: NewShift) => Promise<void>;
  updateShift: (id: number, shift: Partial<NewShift>) => Promise<void>;
  deleteShift: (id: number) => Promise<void>;

  addWorkplace: (workplace: NewWorkplace) => Promise<void>;
  updateWorkplace: (id: number, workplace: Partial<NewWorkplace>) => Promise<void>;
  deleteWorkplace: (id: number) => Promise<void>;

  addShiftType: (shiftType: NewShiftType) => Promise<void>;
  updateShiftType: (id: number, shiftType: Partial<NewShiftType>) => Promise<void>;
  deleteShiftType: (id: number) => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  shifts: [],
  shiftTypes: [],
  workplaces: [],
  loaded: false,
  refresh: async () => {
    const [allShifts, allShiftTypes, allWorkplaces] = await Promise.all([
      db.select().from(shifts),
      db.select().from(shiftTypes),
      db.select().from(workplaces),
    ]);
    set({ shifts: allShifts, shiftTypes: allShiftTypes, workplaces: allWorkplaces, loaded: true });
  },

  addShift: async (shift) => {
    await db.insert(shifts).values(shift);
    await get().refresh();
  },
  updateShift: async (id, shift) => {
    await db.update(shifts).set(shift).where(eq(shifts.id, id));
    await get().refresh();
  },
  deleteShift: async (id) => {
    await db.delete(shifts).where(eq(shifts.id, id));
    await get().refresh();
  },

  addWorkplace: async (workplace) => {
    await db.insert(workplaces).values(workplace);
    await get().refresh();
  },
  updateWorkplace: async (id, workplace) => {
    await db.update(workplaces).set(workplace).where(eq(workplaces.id, id));
    await get().refresh();
  },
  deleteWorkplace: async (id) => {
    const usedByShiftType = get().shiftTypes.some((st) => st.workplaceId === id);
    const usedByManualShift = get().shifts.some((s) => s.shiftTypeId == null && s.workplaceId === id);
    if (usedByShiftType || usedByManualShift) {
      Alert.alert('無法刪除', '這個工作地點還有班別或班次正在使用,請先移除後再刪除。');
      return;
    }
    await db.delete(workplaces).where(eq(workplaces.id, id));
    await get().refresh();
  },

  addShiftType: async (shiftType) => {
    await db.insert(shiftTypes).values(shiftType);
    await get().refresh();
  },
  updateShiftType: async (id, shiftType) => {
    await db.update(shiftTypes).set(shiftType).where(eq(shiftTypes.id, id));
    await get().refresh();
  },
  deleteShiftType: async (id) => {
    const usedByShift = get().shifts.some((s) => s.shiftTypeId === id);
    if (usedByShift) {
      Alert.alert('無法刪除', '這個班別還有班次正在使用,請先移除後再刪除。');
      return;
    }
    await db.delete(shiftTypes).where(eq(shiftTypes.id, id));
    await get().refresh();
  },
}));
