// Garanční prohlídky – výpočty termínů (čisté funkce, používá server i testy).
// Pravidla jsou v src/terms.mjs (TERMS.inspection) a v záručních podmínkách verze 1.1.
import { TERMS } from '../terms.mjs';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

/** Přičte měsíce; z 31. 1. + 1 měsíc je poslední den února (ne 3. 3.). */
export function addMonths(dateStr, months) {
  const d = parse(dateStr);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return ymd(t);
}
export function addDays(dateStr, days) { const d = parse(dateStr); d.setUTCDate(d.getUTCDate() + days); return ymd(d); }
export const today = () => ymd(new Date());

/** Platí podmínka prohlídky pro tuto verzi podmínek? (jen od verze 1.1, ne zpětně) */
export function inspectionApplies(termsVersion) {
  if (!TERMS.inspection.enabled) return false;
  const m = /^(\d+)\.(\d+)$/.exec(String(termsVersion || '').trim()); // verze „1.1“; staré návrhy (2026-12-navrh-3) ne
  if (!m) return false;
  const v = parseFloat(`${m[1]}.${m[2]}`);
  return v >= parseFloat(TERMS.inspection.fromVersion);
}

/** Termíny pro hodinky převzaté v den `handover` (YYYY-MM-DD). */
export function schedule(handover) {
  const i = TERMS.inspection;
  const due = addMonths(handover, i.afterMonths);
  return {
    handover_date: String(handover).slice(0, 10),
    due_date: due,
    window_from: addDays(due, -i.toleranceDays),
    window_to: addDays(due, i.toleranceDays),
    remind_on: addDays(addDays(due, -i.toleranceDays), -14), // připomínka 2 týdny před otevřením okna
    warranty_basic_until: due,                                 // bez prohlídky končí záruka po 12 měsících
    warranty_full_until: addMonths(handover, TERMS.warrantyMonths),
    liability_until: addMonths(handover, TERMS.liabilityMonths),     // zákonná práva – nezávisle na záruce
    presumption_until: addMonths(handover, TERMS.presumptionMonths), // domněnka vady při převzetí
  };
}

/** Stav pro přehled: co je potřeba udělat dnes. */
export function phase(row, on = today()) {
  if (row.status === 'hotova') return 'hotova';
  if (row.status === 'zrusena') return 'zrusena';
  if (on > row.window_to) return 'zmeskana';
  if (on >= row.window_from) return 'v_okne';
  if (on >= row.remind_on && !row.reminder_sent_at) return 'pripomenout';
  return 'planovana';
}

/** Do kdy trvá záruka po zapsání prohlídky v den `doneOn`. */
export function warrantyUntilAfter(row, doneOn) {
  return doneOn >= row.window_from && doneOn <= row.window_to ? addMonths(row.handover_date, TERMS.warrantyMonths) : row.due_date;
}
