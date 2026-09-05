import html2canvas from 'html2canvas';

export async function exportLandscapePNG(sourceElement) {
  if (!sourceElement) return;

  const capture = buildCaptureElement(sourceElement);
  document.body.appendChild(capture);

  try {
    await waitForPaint();
    const canvas = await html2canvas(capture, {
      backgroundColor: '#ffffff',
      scale: 3,
      useCORS: true,
      logging: false,
      width: capture.scrollWidth,
      height: capture.scrollHeight,
      windowWidth: capture.scrollWidth,
      windowHeight: capture.scrollHeight,
    });

    const filename = `software-landscape-${formatDate(new Date())}.png`;
    const blob = await canvasToBlob(canvas);
    if (blob) {
      downloadBlob(blob, filename);
      return;
    }

    downloadDataUrl(canvas.toDataURL('image/png'), filename);
  } finally {
    capture.remove();
  }
}

function buildCaptureElement(sourceElement) {
  const clone = sourceElement.cloneNode(true);
  clone.classList.add('slr-export-capture');
  clone.style.width = `${Math.max(1800, sourceElement.scrollWidth || 1800)}px`;
  clone.style.minHeight = 'auto';
  clone.style.padding = '16px';
  clone.style.position = 'absolute';
  clone.style.left = '-20000px';
  clone.style.top = '0';
  clone.style.background = '#ffffff';

  clone.querySelector('.slr-aside')?.remove();
  clone.querySelector('.slr-tabs')?.remove();
  clone.querySelectorAll('.slr-item.is-selected').forEach(node => node.classList.remove('is-selected'));
  clone.querySelectorAll('.slr-item').forEach(node => {
    node.style.cursor = 'default';
  });

  return clone;
}

function waitForPaint() {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function canvasToBlob(canvas) {
  return new Promise(resolve => {
    if (!canvas.toBlob) {
      resolve(null);
      return;
    }

    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 200);
}

function downloadDataUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
  }, 200);
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}
