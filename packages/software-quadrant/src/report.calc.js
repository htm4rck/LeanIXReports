/**
 * report.calc.js — CAPA DE LÓGICA DE NEGOCIO
 */

export const BENCHMARK = { agility: 63, resilience: 67 };

// Colores por cuartil (estado de salud): índice 0=crítico → 3=saludable
export const QUARTILE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

export const QUADRANT_META = {
  topRight:    { label: 'Saludables / Estratégicas',    icon: '🏆', desc: 'Aplicaciones ágiles y resilientes. Mantener y potenciar.' },
  topLeft:     { label: 'Resilientes pero poco ágiles', icon: '🛡️', desc: 'Sistemas estables pero con baja capacidad de adaptación.' },
  bottomRight: { label: 'Ágiles pero vulnerables',      icon: '⚡', desc: 'Responden rápido pero son frágiles. Enfocar en resiliencia.' },
  bottomLeft:  { label: 'Evaluar / Modernización',     icon: '⚠️', desc: 'Baja agilidad y baja resiliencia. Alto riesgo para el negocio.' },
};

const SUITABILITY_SCORE = {
  fullyAppropriate: 90,
  appropriate:      75,
  adequate:         60,
  inappropriate:    35,
  unreasonable:     15,
};

const LIFECYCLE_SCORE = {
  active:    80,
  phaseIn:   70,
  phaseOut:  40,
  endOfLife: 20,
};

const ARCH_BONUS = { CloudNative: 15, BasadaEnServicios: 8, Distribuida: 0, StandAlone: -10 };
const HOST_BONUS = { saas: 10, paas: 8, iaas: 0, onPremise: -5 };

export function getCurrentPhase(phases) {
  if (!phases?.length) return null;
  const now = new Date().toISOString().slice(0, 10);
  const sorted = [...phases].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  let current = null;
  for (const p of sorted) {
    if (!p.startDate || p.startDate <= now) current = p.phase;
  }
  return current;
}

// Criticidad: prioridad 1 = criticidadDeDatos (custom Alicorp, bien poblado)
//              prioridad 2 = businessCriticality (nativo LeanIX, casi sin datos)
//              prioridad 3 = TipoAplicacion (siempre disponible, derivado)
const DATOS_MAP = {
  MuySignificativo: 'veryHigh',
  Significativo:    'high',
  Moderado:         'medium',
  Bajo:             'low',
};
const BC_MAP = {
  missionCritical:       'veryHigh',
  businessCritical:      'high',
  businessOperational:   'medium',
  administrativeService: 'low',
};
const TIPO_CRITICALITY = {
  CoreBusiness:  'high',
  SharedService: 'medium',
  Analytical:    'medium',
};
const CRITICALITY_SIZE  = { veryHigh: 18, high: 13, medium: 9, low: 6 };
const CRITICALITY_LABEL = { veryHigh: 'Muy alta', high: 'Alta', medium: 'Media', low: 'Baja' };

export function scoreApp(app) {
  const suitBase = SUITABILITY_SCORE[app.technicalSuitability];
  const agility = suitBase != null
    ? Math.min(100, Math.max(0, suitBase + (ARCH_BONUS[app.TipoDeArquitectura] ?? 0)))
    : null;

  const lifecycleBase = LIFECYCLE_SCORE[app.lifecycle?.currentPhase];
  const rtoBonus = app.RecoveryTimeObjective != null && Number(app.RecoveryTimeObjective) <= 4 ? 8 : 0;
  const resilience = lifecycleBase != null
    ? Math.min(100, Math.max(0, lifecycleBase + (HOST_BONUS[app.lxHostingType] ?? 0) + rtoBonus))
    : null;

  const critKey = DATOS_MAP[app.criticidadDeDatos]
    ?? BC_MAP[app.businessCriticality]
    ?? TIPO_CRITICALITY[app.TipoAplicacion]
    ?? 'low';
  const criticality = CRITICALITY_LABEL[critKey];
  const size        = CRITICALITY_SIZE[critKey];

  return { agility, resilience, size, criticality };
}

// Cuartil basado en 50/50 (cuadrantes visuales iguales)
export function getQuartile(agility, resilience) {
  const highA = agility    >= 50;
  const highR = resilience >= 50;
  if (highA && highR)  return 'topRight';
  if (!highA && highR) return 'topLeft';
  if (highA && !highR) return 'bottomRight';
  return 'bottomLeft';
}

export function getQuartileColor(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return { topRight: QUARTILE_COLORS[3], topLeft: QUARTILE_COLORS[2], bottomRight: QUARTILE_COLORS[1], bottomLeft: QUARTILE_COLORS[0] }[q];
}

export function getQuartileLabel(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return { topRight: 'Cuartil superior', topLeft: '3er cuartil', bottomRight: '2do cuartil', bottomLeft: 'Cuartil inferior' }[q];
}

export function getRiskLevel(agility, resilience) {
  const score = (agility + resilience) / 2;
  if (score < 30) return { label: 'Muy alto', color: '#ef4444' };
  if (score < 50) return { label: 'Alto',     color: '#f97316' };
  if (score < 70) return { label: 'Medio',    color: '#eab308' };
  return              { label: 'Bajo',     color: '#22c55e' };
}

export function getBreaches(app) {
  const b = [];
  if (app.agility    != null && app.agility    < 50) b.push({ text: 'Baja agilidad',           source: `technicalSuitability: ${app.technicalSuitability ?? '—'}` });
  if (app.resilience != null && app.resilience < 50) b.push({ text: 'Baja resiliencia',         source: `lifecycle: ${app.lifecycle?.currentPhase ?? '—'}` });
  if (app.TipoDeArquitectura === 'StandAlone')        b.push({ text: 'Arquitectura monolítica',  source: 'TipoDeArquitectura: StandAlone' });
  if (app.lxHostingType === 'onPremise')              b.push({ text: 'Hosting on-premise',       source: 'lxHostingType: onPremise' });
  if (app.RecoveryTimeObjective > 8)                  b.push({ text: 'RTO elevado',              source: `RecoveryTimeObjective: ${app.RecoveryTimeObjective}h` });
  if (app.lifecycle?.currentPhase === 'endOfLife')    b.push({ text: 'Fin de vida útil',         source: 'lifecycle: endOfLife' });
  if (app.lifecycle?.currentPhase === 'phaseOut')     b.push({ text: 'En proceso de retiro',     source: 'lifecycle: phaseOut' });
  return b;
}

export function getRecommendation(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return {
    topRight:    'Mantener y potenciar. Evaluar expansión de capacidades.',
    topLeft:     'Priorizar modernización de arquitectura para mejorar agilidad.',
    bottomRight: 'Implementar plan de resiliencia y continuidad de negocio.',
    bottomLeft:  'Priorizar plan de modernización o reemplazo durante próximo ciclo.',
  }[q];
}

export function getQuadrantCounts(apps) {
  return {
    topRight:    apps.filter(a => a.agility >= 50 && a.resilience >= 50).length,
    topLeft:     apps.filter(a => a.agility <  50 && a.resilience >= 50).length,
    bottomRight: apps.filter(a => a.agility >= 50 && a.resilience <  50).length,
    bottomLeft:  apps.filter(a => a.agility <  50 && a.resilience <  50).length,
  };
}

export function getPortfolioKPIs(apps) {
  const total = apps.length;
  if (!total) return { avgAgility: 0, avgResilience: 0, healthy: 0, critical: 0, total: 0, overallScore: 0 };
  const avgAgility    = Math.round(apps.reduce((s, a) => s + a.agility,    0) / total);
  const avgResilience = Math.round(apps.reduce((s, a) => s + a.resilience, 0) / total);
  // Saludables = cuartil superior (score calculado: agilidad ≥50 Y resiliencia ≥50)
  const healthy  = apps.filter(a => a.agility >= 50 && a.resilience >= 50).length;
  // Críticas = criticidadDeDatos MuySignificativo o Significativo (campo LeanIX Alicorp)
  const critical = apps.filter(a =>
    a.criticidadDeDatos === 'MuySignificativo' || a.criticidadDeDatos === 'Significativo'
  ).length;
  const overallScore = Math.round((avgAgility + avgResilience) / 2);
  return { avgAgility, avgResilience, healthy, critical, total, overallScore };
}

// Top N apps a intervenir: críticas de datos con peor score de salud primero
export function getTopCritical(apps, n = 10) {
  const CRIT_ORDER = { MuySignificativo: 0, Significativo: 1, Moderado: 2, Bajo: 3 };
  return [...apps]
    .sort((a, b) => {
      const ca = CRIT_ORDER[a.criticidadDeDatos] ?? 4;
      const cb = CRIT_ORDER[b.criticidadDeDatos] ?? 4;
      if (ca !== cb) return ca - cb;  // primero las más críticas
      return (a.agility + a.resilience) - (b.agility + b.resilience); // luego peor score
    })
    .slice(0, n);
}
