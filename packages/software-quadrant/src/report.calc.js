/**
 * 2. report.calc.js — CAPA DE LÓGICA DE NEGOCIO
 */

// 2.1 Constantes de referencia y configuración visual
export const BENCHMARK = { agility: 63, resilience: 67 };

// Colores por cuartil (estado de salud): índice 0=crítico → 3=saludable
export const QUARTILE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

export const QUADRANT_META = {
  topRight:    { label: 'Saludables / Estratégicas',    icon: '🏆', desc: 'Aplicaciones ágiles y resilientes. Mantener y potenciar.' },
  topLeft:     { label: 'Resilientes pero poco ágiles', icon: '🛡️', desc: 'Sistemas estables pero con baja capacidad de adaptación.' },
  bottomRight: { label: 'Ágiles pero vulnerables',      icon: '⚡', desc: 'Responden rápido pero son frágiles. Enfocar en resiliencia.' },
  bottomLeft:  { label: 'Evaluar / Modernización',     icon: '⚠️', desc: 'Baja agilidad y baja resiliencia. Alto riesgo para el negocio.' },
};

// 2.2 Traducciones a lenguaje de negocio — fuente única de verdad
export const LIFECYCLE_LABEL = {
  active:    'Activo',
  phaseIn:   'En adopción',
  phaseOut:  'En retiro',
  endOfLife: 'Fin de vida',
  plan:      'Planificado',
};

export const SUITABILITY_LABEL = {
  fullyAppropriate: 'Totalmente adecuado',
  appropriate:      'Adecuado',
  adequate:         'Aceptable',
  inappropriate:    'Inadecuado',
  unreasonable:     'Obsoleto',
};

export const ARCH_LABEL = {
  CloudNative:       'Cloud Native',
  BasadaEnServicios: 'Basada en servicios',
  Distribuida:       'Distribuida',
  StandAlone:        'Monolítica (StandAlone)',
};

export const HOSTING_LABEL = {
  saas:      'SaaS (nube gestionada)',
  paas:      'PaaS (plataforma nube)',
  iaas:      'IaaS (infraestructura nube)',
  onPremise: 'On-Premise (local)',
  hybrid:    'Híbrido',
};

// 2.3 Helper de traducción
export function label(map, value) {
  return map[value] ?? value ?? '—';
}


// 2.4 Tablas de puntuación para el cálculo de ejes
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

// 2.5 Obtiene la fase activa del ciclo de vida
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

// 2.6 Mapas de criticidad y tamaño de burbuja
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

// 2.7 Calcula agilidad, resiliencia, tamaño y criticidad de una app
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

// 2.8 Determina el cuadrante según posición en el eje 50/50
export function getQuartile(agility, resilience) {
  const highA = agility    >= 50;
  const highR = resilience >= 50;
  if (highA && highR)  return 'topRight';
  if (!highA && highR) return 'topLeft';
  if (highA && !highR) return 'bottomRight';
  return 'bottomLeft';
}

// 2.9 Color del cuadrante
export function getQuartileColor(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return { topRight: QUARTILE_COLORS[3], topLeft: QUARTILE_COLORS[2], bottomRight: QUARTILE_COLORS[1], bottomLeft: QUARTILE_COLORS[0] }[q];
}

// 2.10 Etiqueta del cuadrante
export function getQuartileLabel(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return { topRight: 'Cuartil superior', topLeft: '3er cuartil', bottomRight: '2do cuartil', bottomLeft: 'Cuartil inferior' }[q];
}

// 2.11 Nivel de riesgo basado en score promedio
export function getRiskLevel(agility, resilience) {
  const score = (agility + resilience) / 2;
  if (score < 30) return { label: 'Muy alto', color: '#ef4444' };
  if (score < 50) return { label: 'Alto',     color: '#f97316' };
  if (score < 70) return { label: 'Medio',    color: '#eab308' };
  return              { label: 'Bajo',     color: '#22c55e' };
}

// 2.12 Brechas detectadas con texto de negocio y fuente LeanIX
export function getBreaches(app) {
  const b = [];
  if (app.agility    != null && app.agility    < 50) b.push({
    text:   'Baja agilidad técnica',
    source: `Evaluación técnica: ${label(SUITABILITY_LABEL, app.technicalSuitability)}`,
  });
  if (app.resilience != null && app.resilience < 50) b.push({
    text:   'Baja resiliencia operativa',
    source: `Ciclo de vida: ${label(LIFECYCLE_LABEL, app.lifecycle?.currentPhase)}`,
  });
  if (app.TipoDeArquitectura === 'StandAlone') b.push({
    text:   'Arquitectura monolítica',
    source: `Arquitectura: ${label(ARCH_LABEL, app.TipoDeArquitectura)} — dificulta cambios y escalabilidad`,
  });
  if (app.lxHostingType === 'onPremise') b.push({
    text:   'Infraestructura on-premise',
    source: `Hosting: ${label(HOSTING_LABEL, app.lxHostingType)} — mayor costo operativo y menor elasticidad`,
  });
  if (app.RecoveryTimeObjective > 8) b.push({
    text:   'Tiempo de recuperación elevado',
    source: `RTO: ${app.RecoveryTimeObjective}h — el negocio tolera máximo 8h de interrupción`,
  });
  if (app.lifecycle?.currentPhase === 'endOfLife') b.push({
    text:   'Aplicación en fin de vida',
    source: `Ciclo de vida: ${label(LIFECYCLE_LABEL, 'endOfLife')} — sin soporte del proveedor`,
  });
  if (app.lifecycle?.currentPhase === 'phaseOut') b.push({
    text:   'Aplicación en proceso de retiro',
    source: `Ciclo de vida: ${label(LIFECYCLE_LABEL, 'phaseOut')} — planificar migración`,
  });
  return b;
}

// 2.13 Recomendación de acción según cuadrante
export function getRecommendation(agility, resilience) {
  const q = getQuartile(agility, resilience);
  return {
    topRight:    'Mantener y potenciar. Evaluar expansión de capacidades.',
    topLeft:     'Priorizar modernización de arquitectura para mejorar agilidad.',
    bottomRight: 'Implementar plan de resiliencia y continuidad de negocio.',
    bottomLeft:  'Priorizar plan de modernización o reemplazo durante próximo ciclo.',
  }[q];
}

// 2.14 Conteo de apps por cuadrante
export function getQuadrantCounts(apps) {
  return {
    topRight:    apps.filter(a => a.agility >= 50 && a.resilience >= 50).length,
    topLeft:     apps.filter(a => a.agility <  50 && a.resilience >= 50).length,
    bottomRight: apps.filter(a => a.agility >= 50 && a.resilience <  50).length,
    bottomLeft:  apps.filter(a => a.agility <  50 && a.resilience <  50).length,
  };
}

// 2.15 KPIs del portafolio completo
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

// 2.16 Top N apps a intervenir: críticas con peor score primero
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
