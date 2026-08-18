import { addDays, format, parseISO } from 'date-fns';
import { create } from 'zustand';

export type TodayMode = 'browse' | 'scheduling';

interface DayDetailState {
  visible: boolean;
  date: string;
}

interface UiState {
  // 今日 Tab 目前模式:瀏覽 / 排班
  todayMode: TodayMode;

  // 瀏覽狀態:行事曆目前選中的日期
  selectedDate: string;
  setSelectedDate: (date: string) => void;

  // 排班狀態:sheet 目前操作的目標日期
  schedulingDate: string;
  enterSchedulingMode: () => void;
  exitSchedulingMode: () => void;
  setSchedulingDate: (date: string) => void;
  advanceSchedulingDate: () => void;

  // 瀏覽狀態:點某天彈出的當天清單 sheet
  dayDetail: DayDetailState;
  openDayDetail: (date: string) => void;
  closeDayDetail: () => void;

  // DayDetailSheet 內的刪除模式開關
  deleteModeActive: boolean;
  toggleDeleteMode: () => void;

  // 單筆班次編輯 sheet(疊在 DayDetailSheet 上面)
  editingShiftId: number | null;
  openShiftEdit: (shiftId: number) => void;
  closeShiftEdit: () => void;

  // 今日 Tab 被再次點擊時:回到瀏覽狀態、日期重置回今天、關掉所有 sheet
  resetToday: () => void;
}

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function firstOfThisMonth(): string {
  return format(new Date(), 'yyyy-MM-01');
}

export const useUiStore = create<UiState>((set, get) => ({
  todayMode: 'browse',
  selectedDate: today(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  schedulingDate: firstOfThisMonth(),
  enterSchedulingMode: () => set({ todayMode: 'scheduling', schedulingDate: firstOfThisMonth() }),
  exitSchedulingMode: () => set({ todayMode: 'browse' }),
  setSchedulingDate: (date) => set({ schedulingDate: date }),
  advanceSchedulingDate: () =>
    set({ schedulingDate: format(addDays(parseISO(get().schedulingDate), 1), 'yyyy-MM-dd') }),

  dayDetail: { visible: false, date: today() },
  openDayDetail: (date) => set({ dayDetail: { visible: true, date }, deleteModeActive: false }),
  closeDayDetail: () => set((state) => ({ dayDetail: { ...state.dayDetail, visible: false }, deleteModeActive: false })),

  deleteModeActive: false,
  toggleDeleteMode: () => set((state) => ({ deleteModeActive: !state.deleteModeActive })),

  editingShiftId: null,
  openShiftEdit: (shiftId) => set({ editingShiftId: shiftId }),
  closeShiftEdit: () => set({ editingShiftId: null }),

  resetToday: () =>
    set({
      todayMode: 'browse',
      selectedDate: today(),
      dayDetail: { visible: false, date: today() },
      deleteModeActive: false,
      editingShiftId: null,
    }),
}));
