import { DAILY_OPERATING_COST, type DailySales, type Menu } from '@/lib/mock-data';

export function estimateHppRatio(menus: Menu[]): number {
  const revenue = menus.reduce((sum, menu) => sum + menu.soldToday * menu.price, 0);
  const cost = menus.reduce((sum, menu) => sum + menu.soldToday * menu.hpp, 0);
  return revenue === 0 ? 0 : cost / revenue;
}

export function summarizeDay(day: DailySales, hppRatio: number) {
  const estimatedHpp = Math.round(day.omzet * hppRatio);
  const estimatedProfit = day.omzet - estimatedHpp - DAILY_OPERATING_COST;
  return {
    omzet: day.omzet,
    transactions: day.transactions,
    averageTicket: Math.round(day.omzet / day.transactions),
    estimatedHpp,
    estimatedProfit,
  };
}
