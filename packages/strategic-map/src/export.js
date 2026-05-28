import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';

const LAYERS = ['metas', 'objetivos', 'capability', 'application', 'itcomponent', 'dataobject'];
const LAYER_COLORS = {
  metas: { hex: '16A34A', rgb: [22, 163, 66], bg: [220, 252, 231] },
  objetivos: { hex: '22C55E', rgb: [34, 197, 94], bg: [209, 250, 229] },
  capability: { hex: 'F59E0B', rgb: [245, 158, 11], bg: [254, 243, 199] },
  application: { hex: 'A855F7', rgb: [168, 85, 247], bg: [243, 232, 255] },
  itcomponent: { hex: '06B6D4', rgb: [6, 182, 212], bg: [207, 250, 254] },
  dataobject: { hex: '4F46E5', rgb: [79, 70, 229], bg: [224, 231, 255] },
};
const LAYER_LABELS = {
  metas: 'Metas', objetivos: 'Objetivos', capability: 'Capacidades',
  application: 'Aplicaciones', itcomponent: 'Componentes TI', dataobject: 'Objetos de Datos',
};

// ─── PDF Export ───
export function exportPDF(data, mv, orgName) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // Page 1: Header + Map
  drawHeader(pdf, W, mv, orgName);
  drawKPIs(pdf, W, data);
  drawMapLayers(pdf, W, H, data);

  // Page 2: Description & Principles (if available)
  if (mv?.description || mv?.principio) {
    pdf.addPage();
    drawDetailPage(pdf, W, H, mv);
  }

  const filename = `mapa-estrategico-${slugify(mv?.name)}.pdf`;
  const blob = pdf.output('blob');
  downloadBlob(blob, filename);
}

function drawHeader(pdf, W, mv, orgName) {
  // Dark header bar
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 20, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Mapa Estratégico Relacional', 8, 9);

  // Subtitle
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text(`${mv?.name || ''} — ${orgName || 'Alicorp'}`, 8, 15);

  // Date
  pdf.text(new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' }), W - 8, 15, { align: 'right' });

  // Accent line
  pdf.setFillColor(245, 158, 11);
  pdf.rect(0, 20, W, 0.8, 'F');
}

function drawKPIs(pdf, W, data) {
  const y = 25;
  let x = 8;
  for (const key of LAYERS) {
    const items = data[key] || [];
    const c = LAYER_COLORS[key];
    // Circle
    pdf.setFillColor(...c.bg);
    pdf.setDrawColor(...c.rgb);
    pdf.roundedRect(x, y, 18, 10, 2, 2, 'FD');
    // Count
    pdf.setTextColor(...c.rgb);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text(`${items.length}`, x + 9, y + 5, { align: 'center' });
    // Label
    pdf.setFontSize(5.5);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont(undefined, 'normal');
    pdf.text(LAYER_LABELS[key], x + 9, y + 9, { align: 'center' });
    x += 22;
  }
}

function drawMapLayers(pdf, W, H, data) {
  let layerY = 40;
  const cardW = 34;
  const cardH = 11;
  const labelW = 30;
  const startX = labelW + 6;
  const gap = 2;

  for (const key of LAYERS) {
    const items = data[key] || [];
    if (items.length === 0) continue;
    const c = LAYER_COLORS[key];

    // Layer label
    pdf.setFillColor(...c.rgb);
    pdf.roundedRect(4, layerY, labelW, 8, 1.5, 1.5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.setFont(undefined, 'bold');
    pdf.text(LAYER_LABELS[key], 4 + labelW / 2, layerY + 5, { align: 'center' });

    // Cards
    let cardX = startX;
    let rowOffset = 0;
    const maxPerRow = Math.floor((W - startX - 4) / (cardW + gap));

    for (let i = 0; i < items.length; i++) {
      if (i > 0 && i % maxPerRow === 0) {
        rowOffset += cardH + gap;
        cardX = startX;
      }

      const cy = layerY + rowOffset;

      // Card background
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...c.rgb);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(cardX, cy, cardW, cardH, 1.5, 1.5, 'FD');

      // Icon square
      pdf.setFillColor(...c.rgb);
      pdf.roundedRect(cardX + 1.5, cy + 2, 6, 6, 1, 1, 'F');

      // Name
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(6.5);
      pdf.setFont(undefined, 'bold');
      const name = (items[i].name || '').substring(0, 28);
      pdf.text(name, cardX + 9, cy + 5);

      // Code
      if (items[i].code) {
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(5);
        pdf.setFont(undefined, 'normal');
        pdf.text(items[i].code, cardX + 9, cy + 8.5);
      }

      cardX += cardW + gap;
    }

    layerY += rowOffset + cardH + 6;

    // New page if needed
    if (layerY > H - 20) {
      pdf.addPage();
      layerY = 12;
    }
  }
}

function drawDetailPage(pdf, W, H, mv) {
  // Header
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 16, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont(undefined, 'bold');
  pdf.text('Misión, Visión y Principios', 8, 10);

  let y = 24;

  if (mv.description) {
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    const lines = pdf.splitTextToSize(mv.description, W - 16);
    pdf.text(lines, 8, y);
    y += lines.length * 4.2 + 8;
  }

  if (mv.principio) {
    // Principles header
    pdf.setFillColor(224, 231, 255);
    pdf.roundedRect(8, y, W - 16, 7, 1.5, 1.5, 'F');
    pdf.setTextColor(79, 70, 229);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    pdf.text('Principios Rectores', 12, y + 4.5);
    y += 10;

    // Principles text
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    const lines = pdf.splitTextToSize(mv.principio, W - 16);
    pdf.text(lines, 8, y);
  }
}

// ─── PPTX Export ───
export function exportPPTX(data, mv, orgName) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  // Slide 1: Title
  const s1 = pptx.addSlide();
  s1.background = { color: '0F172A' };
  s1.addText([
    { text: 'Mapa Estratégico\n', options: { fontSize: 36, bold: true, color: 'FFFFFF' } },
    { text: 'Relacional', options: { fontSize: 36, bold: true, color: 'F59E0B' } },
  ], { x: 0.8, y: 1.8, w: 11, h: 2, fontFace: 'Segoe UI' });
  s1.addText(mv?.name || '', { x: 0.8, y: 4.0, w: 11, h: 0.5, fontSize: 18, fontFace: 'Segoe UI', color: 'E2E8F0', bold: true });
  s1.addText(orgName || 'Alicorp', { x: 0.8, y: 4.6, w: 11, h: 0.4, fontSize: 13, fontFace: 'Segoe UI', color: '94A3B8' });
  s1.addText(new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long' }), { x: 0.8, y: 6.8, w: 5, h: 0.3, fontSize: 10, fontFace: 'Segoe UI', color: '64748B' });

  // Slide 2: KPIs
  const s2 = pptx.addSlide();
  s2.background = { color: 'FFFFFF' };
  s2.addText('Resumen', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, fontFace: 'Segoe UI', color: '0F172A', bold: true });

  let kpiX = 0.5;
  for (const key of LAYERS) {
    const items = data[key] || [];
    const c = LAYER_COLORS[key];
    s2.addShape('roundRect', { x: kpiX, y: 1.2, w: 2, h: 1.2, fill: { color: rgbToHex(c.bg) }, line: { color: c.hex, width: 1.2 }, rectRadius: 0.1 });
    s2.addText(`${items.length}`, { x: kpiX, y: 1.2, w: 2, h: 0.75, fontSize: 28, fontFace: 'Segoe UI', color: c.hex, bold: true, align: 'center', valign: 'middle' });
    s2.addText(LAYER_LABELS[key], { x: kpiX, y: 1.9, w: 2, h: 0.4, fontSize: 8, fontFace: 'Segoe UI', color: '64748B', bold: true, align: 'center' });
    kpiX += 2.1;
  }

  // Slide 3: Visual map
  const s3 = pptx.addSlide();
  s3.background = { color: 'F8FAFC' };
  s3.addText('Vista de Capas', { x: 0.4, y: 0.15, w: 12, h: 0.4, fontSize: 14, fontFace: 'Segoe UI', color: '0F172A', bold: true });

  let rowY = 0.65;
  for (const key of LAYERS) {
    const items = data[key] || [];
    if (items.length === 0) continue;
    const c = LAYER_COLORS[key];

    s3.addShape('roundRect', { x: 0.3, y: rowY, w: 1.8, h: 0.45, fill: { color: c.hex }, rectRadius: 0.05 });
    s3.addText(LAYER_LABELS[key], { x: 0.35, y: rowY, w: 1.7, h: 0.45, fontSize: 8, fontFace: 'Segoe UI', color: 'FFFFFF', bold: true, valign: 'middle' });

    let cardX = 2.3;
    const shown = Math.min(items.length, 6);
    for (let i = 0; i < shown; i++) {
      s3.addShape('roundRect', { x: cardX, y: rowY - 0.02, w: 1.7, h: 0.5, fill: { color: 'FFFFFF' }, line: { color: c.hex, width: 0.6 }, rectRadius: 0.05 });
      s3.addShape('roundRect', { x: cardX + 0.07, y: rowY + 0.07, w: 0.28, h: 0.28, fill: { color: c.hex }, rectRadius: 0.04 });
      s3.addText(items[i].name?.substring(0, 20) || '', { x: cardX + 0.4, y: rowY - 0.02, w: 1.25, h: 0.5, fontSize: 6.5, fontFace: 'Segoe UI', color: '1E293B', bold: true, valign: 'middle' });
      cardX += 1.78;
    }
    if (items.length > 6) {
      s3.addText(`+${items.length - 6}`, { x: cardX, y: rowY, w: 0.5, h: 0.45, fontSize: 8, fontFace: 'Segoe UI', color: '94A3B8', bold: true, valign: 'middle' });
    }
    rowY += 0.72;
  }

  // Detail slides per layer
  for (const key of LAYERS) {
    const items = data[key] || [];
    if (items.length === 0) continue;
    const c = LAYER_COLORS[key];

    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.85, fill: { color: c.hex } });
    s.addText(`${LAYER_LABELS[key]} (${items.length})`, { x: 0.5, y: 0, w: 12, h: 0.85, fontSize: 18, fontFace: 'Segoe UI', color: 'FFFFFF', bold: true, valign: 'middle' });

    const cols = 4;
    const gW = 3.05;
    const gH = 0.72;
    for (let i = 0; i < Math.min(items.length, 28); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = 0.4 + col * (gW + 0.12);
      const cy = 1.1 + row * (gH + 0.1);

      s.addShape('roundRect', { x: cx, y: cy, w: gW, h: gH, fill: { color: rgbToHex(c.bg) }, line: { color: c.hex, width: 0.5 }, rectRadius: 0.06 });
      s.addShape('roundRect', { x: cx + 0.1, y: cy + 0.14, w: 0.38, h: 0.38, fill: { color: c.hex }, rectRadius: 0.05 });
      s.addText(items[i].name || '', { x: cx + 0.55, y: cy + 0.02, w: gW - 0.7, h: 0.42, fontSize: 8, fontFace: 'Segoe UI', color: '1E293B', bold: true, valign: 'middle' });
      s.addText(items[i].code || '', { x: cx + 0.55, y: cy + 0.42, w: gW - 0.7, h: 0.25, fontSize: 6.5, fontFace: 'Segoe UI', color: '94A3B8' });
    }
  }

  // Principles slide
  if (mv?.description || mv?.principio) {
    const sd = pptx.addSlide();
    sd.background = { color: 'FFFFFF' };
    sd.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.85, fill: { color: '0F172A' } });
    sd.addText('Misión, Visión y Principios', { x: 0.5, y: 0, w: 12, h: 0.85, fontSize: 18, fontFace: 'Segoe UI', color: 'FFFFFF', bold: true, valign: 'middle' });

    let ty = 1.2;
    if (mv.description) {
      sd.addText(mv.description, { x: 0.5, y: ty, w: 12.3, h: 2.5, fontSize: 10, fontFace: 'Segoe UI', color: '334155', valign: 'top', wrap: true });
      ty += 2.8;
    }
    if (mv.principio) {
      sd.addShape('roundRect', { x: 0.5, y: ty, w: 12.3, h: 0.4, fill: { color: 'E0E7FF' }, rectRadius: 0.05 });
      sd.addText('Principios', { x: 0.6, y: ty, w: 12, h: 0.4, fontSize: 9, fontFace: 'Segoe UI', color: '4F46E5', bold: true, valign: 'middle' });
      ty += 0.55;
      sd.addText(mv.principio, { x: 0.5, y: ty, w: 12.3, h: 3.5, fontSize: 9, fontFace: 'Segoe UI', color: '475569', valign: 'top', wrap: true });
    }
  }

  const filename = `mapa-estrategico-${slugify(mv?.name)}.pptx`;
  pptx.write('blob').then(blob => downloadBlob(blob, filename));
}

// ─── Helpers ───
function rgbToHex(rgb) {
  return rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function slugify(str) {
  return (str || 'reporte').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}
