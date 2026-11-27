// Faktura / zálohová faktura / dobropis – tisk a uložení do PDF z prohlížeče. Odkaz je tajný, stránka se neindexuje.
import { handle, html } from '../../server/http.js';
import { renderInvoicePage, INVOICE_CSP } from '../../server/invoice-page.js';

export const onRequestGet = handle(async ({ env, params }) => {
  const token = String(params.token || '');
  const inv = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await env.DB.prepare('SELECT * FROM invoices WHERE public_token = ?').bind(token).first() : null;
  if (!inv) return html('<p>Faktura nenalezena.</p>', 404, { 'Cache-Control': 'no-store' });
  // Přijaté platby (i částečné) – zbývá uhradit jen rozdíl
  const paid = (await env.DB.prepare('SELECT COALESCE(SUM(amount_czk),0) AS s FROM invoice_payments WHERE invoice_id = ? AND cancelled_at IS NULL').bind(inv.id).first().catch(() => ({ s: 0 }))).s || 0;
  const related = inv.related_invoice_id ? await env.DB.prepare('SELECT number FROM invoices WHERE id = ?').bind(inv.related_invoice_id).first() : null;
  return html(renderInvoicePage(inv, { paid, related }), 200, { 'Cache-Control': 'no-store', 'Content-Security-Policy': INVOICE_CSP });
});
