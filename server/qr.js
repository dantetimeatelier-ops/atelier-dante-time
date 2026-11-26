// QR kódy jako SVG (QR platba, nastavení dvoufázového ověření)
import qrcode from 'qrcode-generator';

export function qrSvg(text, { cell = 5, margin = 3, label = 'QR kód' } = {}) {
  const q = qrcode(0, 'M');
  q.addData(text, 'Byte');
  q.make();
  return q.createSvgTag({ cellSize: cell, margin, scalable: true, alt: label, title: label })
    .replace('<svg ', '<svg style="background:#fff;max-width:240px;width:100%;height:auto;border-radius:8px" ');
}
