import ExcelJS from 'exceljs';
import { aggregateSalesByItem, summarizeToday } from '@/lib/metrics';
import { getStockStatus } from '@/lib/stock';
import { fetchReportData, todayJakarta } from '@/lib/operations-data';
import {
  type ExpenseCategory,
  type Shift,
} from '@/types/operations';

const SHIFT_LABEL: Record<Shift, string> = { 'pagi-siang': 'Pagi–Siang', 'siang-sore': 'Siang–Sore' };
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Pembelian Stok', 'Operasional', 'Kerugian Stok', 'Lainnya'];
const RUPIAH_FMT = '"Rp"#,##0';

const BRAND = 'FFC8102E';
const LINE = 'FFE8E8E8';

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
  });
}

function applyPrintSetup(ws: ExcelJS.Worksheet) {
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.pageSetup = { fitToPage: true, orientation: 'landscape', paperSize: 9 };
}

function rupiahCell(ws: ExcelJS.Worksheet, row: number, col: number, value: number) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.numFmt = RUPIAH_FMT;
  cell.alignment = { horizontal: 'right' };
}

async function buildWorkbook(): Promise<ExcelJS.Workbook> {
  const { expenses, shiftSales, stockItems, stockTakes } = await fetchReportData();
  const today = todayJakarta();
  const todayExpenses = expenses.filter((expense) => expense.date === today);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nestation';
  wb.created = new Date();

  const todaySales = shiftSales.filter((shift) => shift.date === today);
  const todayTakes = stockTakes.filter((take) => {
    const d = new Date(take.datetime);
    const jakartaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
    return jakartaDate === today;
  });
  const summary = summarizeToday(todaySales, stockItems, todayExpenses, todayTakes);

  // ---- Sheet 1: Ringkasan ----
  const ringkasan = wb.addWorksheet('Ringkasan', { properties: { defaultColWidth: 28 } });
  ringkasan.columns = [{ width: 30 }, { width: 22 }];
  ringkasan.addRow(['Nestation — Laporan Operasional']);
  ringkasan.getCell('A1').font = { bold: true, size: 16, color: { argb: BRAND } };
  ringkasan.addRow([`Periode: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${today}T12:00:00+07:00`))}`]);
  ringkasan.getCell('A2').font = { italic: true, color: { argb: 'FF777777' } };
  ringkasan.addRow([]);
  ringkasan.addRow(['Metrik', 'Nilai']);
  styleHeaderRow(ringkasan);
  ringkasan.addRow(['Omzet Hari Ini', summary.omzet]);
  rupiahCell(ringkasan, ringkasan.rowCount, 2, summary.omzet);
  ringkasan.addRow(['Estimasi HPP (Transfer)', summary.estimatedHpp]);
  rupiahCell(ringkasan, ringkasan.rowCount, 2, summary.estimatedHpp);
  ringkasan.addRow(['Kerugian Stok (Rusak/Tumpah)', summary.lossCost]);
  rupiahCell(ringkasan, ringkasan.rowCount, 2, summary.lossCost);
  ringkasan.addRow(['Biaya Operasional', summary.operatingCost]);
  rupiahCell(ringkasan, ringkasan.rowCount, 2, summary.operatingCost);
  ringkasan.addRow(['Estimasi Laba', summary.estimatedProfit]);
  rupiahCell(ringkasan, ringkasan.rowCount, 2, summary.estimatedProfit);
  ringkasan.getCell(`A${ringkasan.rowCount}`).font = { bold: true };
  ringkasan.getCell(`B${ringkasan.rowCount}`).font = { bold: true };
  applyPrintSetup(ringkasan);

  // ---- Sheet 2: Penjualan per Shift (rincian) ----
  const penjualan = wb.addWorksheet('Penjualan', { properties: { defaultColWidth: 18 } });
  penjualan.columns = [
    { width: 14 }, { width: 16 }, { width: 26 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 16 },
  ];
  penjualan.getRow(1).values = ['Tanggal', 'Shift', 'Menu', 'Qty', 'Harga Jual', 'Omzet', 'HPP / Unit', 'HPP Total'];
  styleHeaderRow(penjualan);
  for (const shift of todaySales) {
    for (const line of shift.lines) {
      const currentItem = stockItems.find((item) => item.id === line.itemId);
      const unitCost = line.unitCost ?? currentItem?.unitCost ?? 0;
      const r = penjualan.addRow([
        shift.date, SHIFT_LABEL[shift.shift], line.name, line.qty,
        line.price, line.qty * line.price, unitCost, line.qty * unitCost,
      ]);
      rupiahCell(penjualan, r.number, 5, line.price);
      rupiahCell(penjualan, r.number, 6, line.qty * line.price);
      rupiahCell(penjualan, r.number, 7, unitCost);
      rupiahCell(penjualan, r.number, 8, line.qty * unitCost);
    }
  }
  const totalHpp = todaySales.reduce(
    (sum, shift) => sum + shift.lines.reduce((lineSum, line) => {
      const currentItem = stockItems.find((item) => item.id === line.itemId);
      return lineSum + line.qty * (line.unitCost ?? currentItem?.unitCost ?? 0);
    }, 0),
    0,
  );
  const totalPenjualanRow = penjualan.addRow(['', '', '', '', 'Total', todaySales.reduce((sum, s) => sum + s.total, 0), '', totalHpp]);
  totalPenjualanRow.font = { bold: true };
  rupiahCell(penjualan, totalPenjualanRow.number, 6, todaySales.reduce((sum, s) => sum + s.total, 0));
  rupiahCell(penjualan, totalPenjualanRow.number, 8, totalHpp);
  applyPrintSetup(penjualan);

  // ---- Sheet 3: Pengeluaran ----
  const pengeluaran = wb.addWorksheet('Pengeluaran', { properties: { defaultColWidth: 16 } });
  pengeluaran.columns = [{ width: 14 }, { width: 40 }, { width: 18 }, { width: 16 }];
  pengeluaran.getRow(1).values = ['Tanggal', 'Deskripsi', 'Kategori', 'Jumlah'];
  styleHeaderRow(pengeluaran);
  for (const expense of expenses) {
    const r = pengeluaran.addRow([expense.date, expense.description, expense.category, expense.amount]);
    rupiahCell(pengeluaran, r.number, 4, expense.amount);
  }
  // Ringkasan per kategori
  pengeluaran.addRow([]);
  pengeluaran.addRow(['', 'Ringkasan per Kategori', '', '']);
  pengeluaran.getCell(`B${pengeluaran.rowCount}`).font = { bold: true };
  for (const category of EXPENSE_CATEGORIES) {
    const total = expenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0);
    const r = pengeluaran.addRow(['', category, '', total]);
    rupiahCell(pengeluaran, r.number, 4, total);
  }
  const totalExpRow = pengeluaran.addRow(['', 'Total', '', expenses.reduce((sum, e) => sum + e.amount, 0)]);
  totalExpRow.font = { bold: true };
  rupiahCell(pengeluaran, totalExpRow.number, 4, expenses.reduce((sum, e) => sum + e.amount, 0));
  applyPrintSetup(pengeluaran);

  // ---- Sheet 4: Stok & Menu ----
  const stok = wb.addWorksheet('Stok & Menu', { properties: { defaultColWidth: 14 } });
  stok.columns = [
    { width: 26 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ];
  stok.getRow(1).values = ['Nama', 'Kategori', 'Stok Gudang', 'Stok Outlet', 'Min. Outlet', 'Satuan', 'Harga Beli', 'Harga Jual', 'Menu', 'Status Outlet'];
  styleHeaderRow(stok);
  for (const item of stockItems) {
    const r = stok.addRow([
      item.name, item.category, item.stock, item.outletStock, item.minStock, item.unit,
      item.unitCost, item.price, item.available ? 'Dijual' : 'Tidak dijual', getStockStatus(item),
    ]);
    rupiahCell(stok, r.number, 7, item.unitCost);
    rupiahCell(stok, r.number, 8, item.price);
  }
  applyPrintSetup(stok);

  // ---- Sheet 5: Menu Terlaris ----
  const terlaris = wb.addWorksheet('Menu Terlaris', { properties: { defaultColWidth: 16 } });
  terlaris.columns = [{ width: 10 }, { width: 30 }, { width: 16 }];
  terlaris.getRow(1).values = ['Peringkat', 'Menu', 'Porsi Terjual'];
  styleHeaderRow(terlaris);
  const ranked = Array.from(aggregateSalesByItem(todaySales).values()).sort((a, b) => b.qty - a.qty);
  ranked.forEach((item, index) => {
    terlaris.addRow([index + 1, item.name, item.qty]);
  });
  applyPrintSetup(terlaris);

  // ---- Sheet 6: Kerugian Stok ----
  const kerugian = wb.addWorksheet('Kerugian Stok', { properties: { defaultColWidth: 16 } });
  kerugian.columns = [{ width: 16 }, { width: 26 }, { width: 10 }, { width: 34 }, { width: 18 }, { width: 16 }];
  kerugian.getRow(1).values = ['Waktu', 'Item', 'Qty', 'Alasan', 'Staff', 'Estimasi Rugi'];
  styleHeaderRow(kerugian);
  const waste = stockTakes.filter((take) => take.kind === 'rusak');
  for (const take of waste) {
    const item = stockItems.find((i) => i.id === take.itemId);
    const r = kerugian.addRow([
      take.datetime, take.itemName, take.qty, take.reason ?? '', take.staffName,
      take.qty * (take.unitCost ?? item?.unitCost ?? 0),
    ]);
    rupiahCell(kerugian, r.number, 6, take.qty * (take.unitCost ?? item?.unitCost ?? 0));
  }
  const totalWaste = waste.reduce((sum, take) => {
    const item = stockItems.find((i) => i.id === take.itemId);
    return sum + take.qty * (take.unitCost ?? item?.unitCost ?? 0);
  }, 0);
  if (waste.length === 0) {
    kerugian.addRow(['', 'Tidak ada kerugian tercatat', '', '', '', '']);
  } else {
    const r = kerugian.addRow(['', '', '', '', 'Total', totalWaste]);
    r.font = { bold: true };
    rupiahCell(kerugian, r.number, 6, totalWaste);
  }
  applyPrintSetup(kerugian);

  return wb;
}

export async function exportReportToExcel() {
  const wb = await buildWorkbook();
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Laporan-Nestation-${todayJakarta()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
