import * as XLSX from 'xlsx';
import { state, CATEGORIES, CAT_LOOKUP } from './state.js';
import { $, normalizeDate, dateToMonth, toast, markClean } from './utils.js';
import { ytdRevenue, ytdExpenses, ytdExpenseByCategory, computedImprovements } from './overview.js';

/* ── File I/O ─────────────────────────────────────────────────────── */
export async function openFile() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
      });
      state.fileHandle = handle;
      const file = await handle.getFile();
      $('filename').textContent = file.name;
      const buf = await file.arrayBuffer();
      parseXlsx(buf);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        $('filename').textContent = file.name;
        const buf = await file.arrayBuffer();
        parseXlsx(buf);
      };
      input.click();
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

export function parseXlsx(buf) {
  const wb = XLSX.read(buf, { cellDates: true, cellNF: true });

  // Bookings
  state.bookings = [];
  const wsBk = wb.Sheets['Bookings'];
  if (wsBk) {
    const range = XLSX.utils.decode_range(wsBk['!ref'] || 'A1');
    for (let r = 1; r <= range.e.r; r++) {
      const cv = (c) => { const cell = wsBk[XLSX.utils.encode_cell({r, c})]; return cell ? cell.v : null; };
      const month = cv(0);
      if (month == null || String(month).startsWith('=')) continue;
      const b = {
        month: String(month || ''),
        platform: String(cv(1) || ''),
        guestName: String(cv(2) || ''),
        checkIn: normalizeDate(cv(3)),
        checkOut: normalizeDate(cv(4)),
        nights: Number(cv(5)) || 0,
        nightlyRate: Number(cv(6)) || 0,
        cleaningFee: Number(cv(7)) || 0,
        grossRevenue: Number(cv(8)) || 0,
        platformFees: Number(cv(9)) || 0,
        netPayout: Number(cv(10)) || 0,
        notes: String(cv(11) || ''),
      };
      state.bookings.push(b);
    }
  }

  // Expenses
  state.expenses = [];
  const wsEx = wb.Sheets['Expenses'];
  if (wsEx) {
    const range = XLSX.utils.decode_range(wsEx['!ref'] || 'A1');
    for (let r = 1; r <= range.e.r; r++) {
      const cv = (c) => { const cell = wsEx[XLSX.utils.encode_cell({r, c})]; return cell ? cell.v : null; };
      const date = cv(0);
      if (date == null || String(date).startsWith('=')) continue;
      const rawCat = String(cv(2) || '');
      const e = {
        date: normalizeDate(date),
        month: '', // computed
        category: CAT_LOOKUP[rawCat.toLowerCase()] || rawCat,
        vendor: String(cv(3) || ''),
        description: String(cv(4) || ''),
        amount: Number(cv(5)) || 0,
        paymentMethod: String(cv(6) || ''),
        receipt: String(cv(7) || ''),
        status: String(cv(8) || 'Business'),
        taxPeriod: String(cv(9) || ''),
      };
      // Compute tax period if not set (placed-in-service: 2026-03-01)
      if (!e.taxPeriod && e.date) e.taxPeriod = e.date < '2026-03-01' ? 'Pre-Service' : 'Operational';
      e.month = dateToMonth(e.date);
      state.expenses.push(e);
    }
  }

  // Mileage Log
  state.mileage = [];
  const wsMl = wb.Sheets['Mileage Log'];
  if (wsMl) {
    const range = XLSX.utils.decode_range(wsMl['!ref'] || 'A1');
    for (let r = 1; r <= range.e.r; r++) {
      const cv = (c) => { const cell = wsMl[XLSX.utils.encode_cell({r, c})]; return cell ? cell.v : null; };
      const date = cv(0);
      if (date == null || String(date) === 'TOTAL') break;
      state.mileage.push({
        date: normalizeDate(date),
        origin: String(cv(1) || ''),
        destination: String(cv(2) || ''),
        miles: Number(cv(3)) || 0,
        purpose: String(cv(4) || ''),
        stops: String(cv(5) || ''),
        rate: Number(cv(6)) || 0.70,
        deduction: Number(cv(7)) || 0,
      });
    }
  }

  // Budget
  CATEGORIES.forEach(c => state.budgets[c] = 0);
  const wsBgt = wb.Sheets['Budget vs Actual'];
  if (wsBgt) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      const r = 4 + i; // row 4 = first data row (0-indexed)
      const cellA = wsBgt[XLSX.utils.encode_cell({r, c: 0})];
      const cellB = wsBgt[XLSX.utils.encode_cell({r, c: 1})];
      if (cellA && cellB && typeof cellB.v === 'number') {
        state.budgets[String(cellA.v)] = cellB.v;
      }
    }
  }

  // Investment
  const wsROI = wb.Sheets['Investment & ROI'];
  if (wsROI) {
    const pp = wsROI[XLSX.utils.encode_cell({r: 3, c: 1})];
    const tgt = wsROI[XLSX.utils.encode_cell({r: 8, c: 1})];
    if (pp && typeof pp.v === 'number') state.investment.propertyPurchase = pp.v;
    // improvements now computed from expenses, not read from sheet
    if (tgt && typeof tgt.v === 'number') state.investment.targetYears = tgt.v;
  }

  // Show UI
  window._showDashboard();
  window._persistToLocal();
  toast('Loaded from spreadsheet ✓');
}

export async function saveFile() {
  const wb = XLSX.utils.book_new();

  // Bookings sheet
  const bkData = [['Month','Platform','Guest Name','Check-In','Check-Out','Nights','Nightly Rate','Cleaning Fee','Gross Revenue','Platform Fees','Net Payout','Notes']];
  state.bookings.forEach(b => {
    bkData.push([b.month, b.platform, b.guestName, b.checkIn, b.checkOut, b.nights, b.nightlyRate, b.cleaningFee, b.grossRevenue, b.platformFees, b.netPayout, b.notes]);
  });
  const wsBk = XLSX.utils.aoa_to_sheet(bkData);
  XLSX.utils.book_append_sheet(wb, wsBk, 'Bookings');

  // Expenses sheet
  const exData = [['Date','Month','Category','Vendor/Payee','Description','Amount','Payment Method','Receipt? (Y/N)','Status','Tax Period']];
  state.expenses.forEach(e => {
    exData.push([e.date, e.month, e.category, e.vendor, e.description, e.amount, e.paymentMethod, e.receipt, e.status || 'Business', e.taxPeriod || '']);
  });
  const wsEx = XLSX.utils.aoa_to_sheet(exData);
  XLSX.utils.book_append_sheet(wb, wsEx, 'Expenses');

  // Mileage Log — preserve existing mileage data
  if (state.mileage.length > 0) {
    const mlData = [['Date','Origin','Destination','Round Trip Miles','Purpose','Stops/Evidence','IRS Rate ($/mi)','Deduction ($)']];
    state.mileage.forEach(t => {
      mlData.push([t.date, t.origin, t.destination, t.miles, t.purpose, t.stops, t.rate, t.deduction]);
    });
    const totalMiles = state.mileage.reduce((s, t) => s + t.miles, 0);
    const totalDeduction = state.mileage.reduce((s, t) => s + t.deduction, 0);
    mlData.push(['TOTAL','','',totalMiles,'','','',totalDeduction]);
    const wsMl = XLSX.utils.aoa_to_sheet(mlData);
    XLSX.utils.book_append_sheet(wb, wsMl, 'Mileage Log');
  }

  // Budget vs Actual — row 1-3 are headers/title, row 4 is header, rows 5+ are data
  const bgtData = [
    ["Keng's Landing — Annual Budget vs Actual"],
    ['Set your Annual Budget per category in column B.'],
    [],
    ['Category','Annual Budget','Monthly Budget','YTD Actual','YTD Variance','% Used'],
  ];
  CATEGORIES.forEach(cat => {
    const budget = state.budgets[cat] || 0;
    const ytd = ytdExpenseByCategory(cat);
    bgtData.push([cat, budget, budget / 12, ytd, budget - ytd, budget > 0 ? ytd / budget : 0]);
  });
  const wsBgt = XLSX.utils.aoa_to_sheet(bgtData);
  XLSX.utils.book_append_sheet(wb, wsBgt, 'Budget vs Actual');

  // Investment & ROI — write key/value pairs in correct positions for Python compatibility
  const inv = state.investment;
  const improv = computedImprovements();
  const totalInv = inv.propertyPurchase + improv;
  const netProfit = ytdRevenue() - ytdExpenses();
  const roiData = [
    ["Keng's Landing — Investment Recovery Tracker"],
    [],
    ['INITIAL INVESTMENT'],
    ['Property Purchase (4 acres + house, hot tub, pond)', inv.propertyPurchase],
    ['Improvements (computed from expenses)', improv],
    ['Total Investment', totalInv],
    [],
    ['ROI TARGET'],
    ['Target payback (years)', inv.targetYears],
    ['Required annual net profit', totalInv / inv.targetYears],
    ['Required monthly net profit', totalInv / inv.targetYears / 12],
    [],
    ['PROGRESS'],
    ['Total revenue to date', ytdRevenue()],
    ['Total expenses to date', ytdExpenses()],
    ['Net profit to date', netProfit],
    ['Remaining to recover', totalInv - netProfit],
    ['% recovered', totalInv > 0 ? netProfit / totalInv : 0],
  ];
  const wsROI = XLSX.utils.aoa_to_sheet(roiData);
  XLSX.utils.book_append_sheet(wb, wsROI, 'Investment & ROI');

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  try {
    if (state.fileHandle) {
      const writable = await state.fileHandle.createWritable();
      await writable.write(new Uint8Array(wbOut));
      await writable.close();
      toast('Saved ✓');
    } else {
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kengs-landing-finance-tracker.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Downloaded ✓');
    }
    markClean();
  } catch (e) {
    console.error('Save failed:', e);
    toast('Save failed — see console');
  }
}

window.openFile = openFile;
window.saveFile = saveFile;
