import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportPDF(data, mv, orgName, sourceElement) {
  if (!sourceElement) {
    exportFallbackPDF(data, mv, orgName);
    return;
  }

  const capture = buildCaptureElement(sourceElement);
  document.body.appendChild(capture);

  try {
    await waitForPaint();
    const canvas = await html2canvas(capture, {
      backgroundColor: '#f8fbff',
      scale: 2,
      useCORS: true,
      logging: false,
      width: capture.scrollWidth,
      height: capture.scrollHeight,
      windowWidth: capture.scrollWidth,
      windowHeight: capture.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;

    pdf.setFillColor(248, 251, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imgW, imgH, undefined, 'FAST');
    downloadBlob(pdf.output('blob'), `mapa-estrategico-${slugify(mv?.name || orgName)}.pdf`);
  } finally {
    capture.remove();
  }
}

export function exportGapsExcel(gapReport, mv, orgName) {
  const summaryRowsV2 = [
    ['Metrica', 'Valor'],
    ['Vista', mv?.name || orgName || 'Mapa Estrategico'],
    ['Total entidades evaluadas', gapReport.summary.total],
    ['Completas', gapReport.summary.complete],
    ['Con gaps', gapReport.summary.withGaps],
    ['Criticas', gapReport.summary.critical],
    ['Completitud promedio', `${gapReport.summary.avgScore}%`],
    ['Filas de detalle', gapReport.rows.length],
  ];

  const byTypeRowsV2 = [
    ['Tipo', 'Total', 'Completas', 'Con gaps', 'Criticas', 'Score promedio'],
    ...gapReport.byLayer.map(row => [row.label, row.total, row.complete, row.withGaps, row.critical, `${row.avgScore}%`]),
  ];

  const detailRowsV2 = [
    ['Tipo', 'Entidad', 'ID interno LeanIX', 'ID externo / Codigo', 'Estado', 'Score', 'Severidad', 'Total gaps', 'Gaps criticos', 'Gaps medios', 'Columnas / relaciones faltantes', 'Detalle', 'Accion recomendada'],
    ...gapReport.rows.map(row => [
      row.layerLabel,
      row.name,
      row.leanixId || row.id,
      row.code,
      row.statusLabel,
      row.score,
      row.severityLabel,
      row.gapCount,
      row.criticalGapCount,
      row.mediumGapCount,
      row.missingFieldsText || row.field,
      row.message,
      row.action,
    ]),
  ];

  const htmlV2 = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; }
          h1 { color: #122033; }
          h2 { margin-top: 24px; color: #1f3a5f; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
          th { background: #122033; color: #fff; font-weight: 700; }
          th, td { border: 1px solid #d9e4f0; padding: 6px 8px; font-size: 12px; vertical-align: top; }
          .critical { background: #fee2e2; }
          .warning { background: #fef3c7; }
          .complete { background: #dcfce7; }
        </style>
      </head>
      <body>
        <h1>Resumen de Gaps - Mapa Estrategico</h1>
        <h2>Resumen</h2>
        ${tableToHtml(summaryRowsV2)}
        <h2>Resumen por tipo</h2>
        ${tableToHtml(byTypeRowsV2)}
        <h2>Detalle por objeto</h2>
        ${tableToHtml(detailRowsV2, row => row[6])}
      </body>
    </html>`;

  const blobV2 = new Blob([htmlV2], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blobV2, `gaps-mapa-estrategico-${slugify(mv?.name || orgName)}.xls`);
  return;

  const summaryRows = [
    ['Métrica', 'Valor'],
    ['Vista', mv?.name || orgName || 'Mapa Estratégico'],
    ['Total entidades evaluadas', gapReport.summary.total],
    ['Completas', gapReport.summary.complete],
    ['Con gaps', gapReport.summary.withGaps],
    ['Críticas', gapReport.summary.critical],
    ['Completitud promedio', `${gapReport.summary.avgScore}%`],
  ];

  const detailRows = [
    ['Tipo', 'Entidad', 'Código', 'Estado', 'Score', 'Severidad', 'Campo / relación faltante', 'Detalle', 'Acción recomendada'],
    ...gapReport.rows.map(row => [
      row.layerLabel,
      row.name,
      row.code,
      row.statusLabel,
      row.score,
      row.severityLabel,
      row.field,
      row.message,
      row.action,
    ]),
  ];

  const byTypeRows = [
    ['Tipo', 'Total', 'Completas', 'Con gaps', 'Críticas', 'Score promedio'],
    ...gapReport.byLayer.map(row => [row.label, row.total, row.complete, row.withGaps, row.critical, `${row.avgScore}%`]),
  ];

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; }
          h1 { color: #122033; }
          h2 { margin-top: 24px; color: #1f3a5f; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
          th { background: #122033; color: #fff; font-weight: 700; }
          th, td { border: 1px solid #d9e4f0; padding: 6px 8px; font-size: 12px; vertical-align: top; }
          .critical { background: #fee2e2; }
          .warning { background: #fef3c7; }
          .complete { background: #dcfce7; }
        </style>
      </head>
      <body>
        <h1>Resumen de Gaps - Mapa Estratégico</h1>
        <h2>Resumen</h2>
        ${tableToHtml(summaryRows)}
        <h2>Resumen por tipo</h2>
        ${tableToHtml(byTypeRows)}
        <h2>Detalle de gaps</h2>
        ${tableToHtml(detailRows, row => row[5])}
      </body>
    </html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, `gaps-mapa-estrategico-${slugify(mv?.name || orgName)}.xls`);
}

function buildCaptureElement(sourceElement) {
  const clone = sourceElement.cloneNode(true);
  const originalCanvas = sourceElement.querySelector('#smapCanvas');
  const captureWidth = Math.max(1500, originalCanvas?.scrollWidth || sourceElement.scrollWidth || 1500);
  const captureHeight = Math.min(1850, Math.max(980, originalCanvas?.scrollHeight ? originalCanvas.scrollHeight + 210 : sourceElement.scrollHeight));

  clone.classList.add('smap-export-capture');
  clone.style.width = `${captureWidth}px`;
  clone.style.minHeight = 'auto';
  clone.style.padding = '18px';
  clone.style.position = 'absolute';
  clone.style.left = '-20000px';
  clone.style.top = '0';
  clone.style.background = '#f8fbff';

  const title = document.createElement('div');
  title.className = 'smap-export-title';
  title.innerHTML = `
    <div>
      <h1>Mapa Estratégico Relacional</h1>
      <p>${escapeHtml(sourceElement.querySelector('.smap-entity-count')?.textContent || '')}</p>
    </div>
    <div>
      <strong>One page ejecutivo</strong>
      <span>${new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  `;
  clone.insertBefore(title, clone.firstChild);

  clone.querySelector('.smap-toolbar')?.remove();
  clone.querySelector('.smap-side')?.remove();
  clone.querySelector('.smap-empty')?.remove();

  const workspace = clone.querySelector('.smap-workspace');
  if (workspace) {
    workspace.style.display = 'block';
  }

  const mapPanel = clone.querySelector('.smap-map-panel');
  if (mapPanel) {
    mapPanel.style.width = '100%';
  }

  const canvas = clone.querySelector('#smapCanvas');
  if (canvas) {
    canvas.style.overflow = 'visible';
    canvas.style.height = `${Math.min(captureHeight - 230, canvas.scrollHeight || captureHeight)}px`;
    canvas.style.minHeight = canvas.style.height;
  }

  const layers = clone.querySelector('#smapLayers');
  if (layers) {
    layers.style.transform = 'none';
    layers.style.width = '100%';
    layers.style.minWidth = '0';
  }

  clone.querySelectorAll('[id]').forEach((el, index) => {
    el.id = `${el.id}-pdf-${index}`;
  });

  return clone;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tableToHtml(rows, severityGetter = null) {
  return `<table>${rows.map((row, rowIndex) => {
    const severity = rowIndex > 0 && severityGetter ? String(severityGetter(row)).toLowerCase() : '';
    const cls = severity.includes('crítica') || severity.includes('critica') ? 'critical' : severity.includes('media') ? 'warning' : severity.includes('completa') ? 'complete' : '';
    const cells = row.map(cell => `<${rowIndex === 0 ? 'th' : 'td'}>${escapeHtml(cell)}</${rowIndex === 0 ? 'th' : 'td'}>`).join('');
    return `<tr class="${cls}">${cells}</tr>`;
  }).join('')}</table>`;
}

function exportFallbackPDF(data, mv, orgName) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const total = ['estrategicos', 'tacticos', 'iniciativas', 'capability', 'process', 'application', 'interface', 'itcomponent', 'dataobject']
    .reduce((sum, key) => sum + (data[key] || []).length, 0);

  pdf.setFillColor(248, 251, 255);
  pdf.rect(0, 0, pageW, pageH, 'F');
  pdf.setFillColor(18, 32, 51);
  pdf.roundedRect(10, 10, pageW - 20, 26, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Mapa Estrategico Relacional', 18, 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${mv?.name || 'Vista estrategica'} - ${orgName || 'Alicorp'}`, 18, 30);
  pdf.setTextColor(18, 32, 51);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.text(String(total), pageW / 2, pageH / 2, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text('entidades relacionadas', pageW / 2, pageH / 2 + 10, { align: 'center' });
  downloadBlob(pdf.output('blob'), `mapa-estrategico-${slugify(mv?.name || orgName)}.pdf`);
}

function waitForPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function slugify(str) {
  return (str || 'reporte').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
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
