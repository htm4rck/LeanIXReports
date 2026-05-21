// Layout configuration: maps root capability tags to poster zones
// zone: 'left' | 'center-front' | 'center-middle' | 'right'
// mode: 'rows' (vertical list) | 'cols' (sub-columns) | 'transposed' (horizontal rows with cells)

export const LAYOUT_CONFIG = {
  'DTO': { zone: 'left', mode: 'rows', order: 1 },
  'FTP': { zone: 'left', mode: 'rows', order: 2 },
  'PTP': { zone: 'left', mode: 'rows', order: 3 },
  'PTM': { zone: 'left', mode: 'rows', order: 4 },
  'OTC': { zone: 'center-front', mode: 'cols', order: 1 },
  'PTD': { zone: 'center-middle', mode: 'rows', order: 1 },
  'MAI': { zone: 'center-middle', mode: 'rows', order: 2 },
  'Transversal-Soporte': { zone: 'center-middle', mode: 'cols', order: 3 },
  'TT': { zone: 'right', mode: 'transposed', order: 1 },
};

// Domain chip colors
export const DOMAIN_COLORS = {
  'Marketing': { bg: '#fbe9e7', color: '#bf360c', border: '#d84315' },
  'Supply': { bg: '#f9fbe7', color: '#33691e', border: '#558b2f' },
  'AS - Alicorp Soluciones': { bg: '#e3f2fd', color: '#0d47a1', border: '#1565c0' },
  'CMP - Consumo Masivo de Productos': { bg: '#e8f5e9', color: '#1b5e20', border: '#2e7d32' },
  'Finanzas': { bg: '#fff8e1', color: '#e65100', border: '#f57c00' },
  'RRHH': { bg: '#e8eaf6', color: '#1a237e', border: '#283593' },
  'TI': { bg: '#ede7f6', color: '#4527a0', border: '#512da8' },
  'General': { bg: '#f3e5f5', color: '#4a148c', border: '#7b1fa2' },
  'Legal': { bg: '#e0f7fa', color: '#006064', border: '#00838f' },
  'Transversal-Soporte': { bg: '#fafafa', color: '#424242', border: '#757575' },
  'No Tradicional': { bg: '#e3f2fd', color: '#0d47a1', border: '#1565c0' },
  'Tradicional Vertical': { bg: '#e8f5e9', color: '#1b5e20', border: '#2e7d32' },
};
