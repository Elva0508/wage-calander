import { eq } from 'drizzle-orm';
import { create } from 'zustand';

import { db } from '@/db/client';
import { NewShift, NewWageRule, Shift, WageRule, shifts, wageRules } from '@/db/schema';

interface DataState {
  shifts: Shift[];
  wageRules: WageRule[];
  loaded: boolean;
  refresh: () => Promise<void>;
  addShift: (shift: NewShift) => Promise<void>;
  updateShift: (id: number, shift: Partial<NewShift>) => Promise<void>;
  deleteShift: (id: number) => Promise<void>;
  addWageRule: (rule: NewWageRule) => Promise<void>;
  updateWageRule: (id: number, rule: Partial<NewWageRule>) => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  shifts: [],
  wageRules: [],
  loaded: false,
  refresh: async () => {
    const [allShifts, allRules] = await Promise.all([
      db.select().from(shifts),
      db.select().from(wageRules),
    ]);
    set({ shifts: allShifts, wageRules: allRules, loaded: true });
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
  addWageRule: async (rule) => {
    await db.insert(wageRules).values(rule);
    await get().refresh();
  },
  updateWageRule: async (id, rule) => {
    await db.update(wageRules).set(rule).where(eq(wageRules.id, id));
    await get().refresh();
  },
}));
