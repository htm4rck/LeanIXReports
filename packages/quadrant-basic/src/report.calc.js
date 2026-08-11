/**
 * 2. report.calc.js — CAPA DE LÓGICA DE NEGOCIO
 *
 * Responsabilidad: calcular scores y derivar datos.
 * Sin HTML, sin DOM, sin llamadas a LeanIX.
 */

// 2.1 Tablas de puntuación
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

const ARCH_BONUS    = { CloudNative: 15, BasadaEnServicios: 8, StandAlone: -10 };
const HOSTING_BONUS = { saas: 10, paas: 8, onPremise: -5 };

const SIZE_MAP = { MuySignificativo: 18, Significativo: 13, Moderado: 9, Bajo: 6 };

// 2.2 Obtiene la fase activa del ciclo de vida
export function getCurrentPhase(phases) {
  if (!phases?.length) return null;
  const now    = new Date().toISOString().slice(0, 10);
  const sorted = [...phases].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  let current  = null;
  for (const p of sorted) {
    if (!p.startDate || p.startDate <= now) current = p.phase;
  }
  return current;
}

// 2.3 Calcula agility, resilience y size para una app
export function scoreApp(app) {
  const suitBase     = SUITABILITY_SCORE[app.technicalSuitability];
  const agility      = suitBase != null
    ? Math.min(100, Math.max(0, suitBase + (ARCH_BONUS[app.TipoDeArquitectura] ?? 0)))
    : null;

  const lifecycleBase = LIFECYCLE_SCORE[app.lifecycle?.currentPhase];
  const resilience    = lifecycleBase != null
    ? Math.min(100, Math.max(0, lifecycleBase + (HOSTING_BONUS[app.lxHostingType] ?? 0)))
    : null;

  const size = SIZE_MAP[app.criticidadDeDatos] ?? 6;

  return { agility, resilience, size };
}

// 2.4 Devuelve el color del cuadrante según posición 50/50
export function getColor(agility, resilience) {
  if (agility >= 50 && resilience >= 50) return '#22c55e'; // saludable
  if (agility >= 50 && resilience <  50) return '#f97316'; // ágil pero frágil
  if (agility <  50 && resilience >= 50) return '#eab308'; // resiliente pero lento
  return '#ef4444';                                         // crítico
}
