export const COLORS = {
  fullyAppropriate: '#22c55e',
  adequate: '#f59e0b',
  inappropriate: '#ef4444',
  unreasonable: '#d1d5db',
};

export const LABELS = {
  fullyAppropriate: 'Completamente apropiado',
  adequate: 'Adecuado',
  inappropriate: 'Inapropiado',
  unreasonable: 'No evaluable',
};

export function evaluateApp(app) {
  let weightedScore = 0;
  let evaluatedWeight = 0;
  const scores = {};

  const phase = app.lifecycle?.currentPhase;
  const lifecycleMap = { active: 4, phaseIn: 3, phaseOut: 2, endOfLife: 1 };
  if (phase && lifecycleMap[phase]) {
    weightedScore += lifecycleMap[phase] * 30; evaluatedWeight += 30; scores.lifecycle = lifecycleMap[phase];
  }

  const archMap = { CloudNative: 4, BasadaEnServicios: 3, Distribuida: 2, StandAlone: 2 };
  if (archMap[app.TipoDeArquitectura]) {
    weightedScore += archMap[app.TipoDeArquitectura] * 20; evaluatedWeight += 20; scores.architecture = archMap[app.TipoDeArquitectura];
  }

  if (app.TipoDeAutenticacion) {
    const auth = String(app.TipoDeAutenticacion);
    let s = null;
    if (auth.includes('SSO')) s = 4;
    else if (auth.includes('OAuth2') || auth.includes('ActiveDirectory') || auth.includes('JWT')) s = 3;
    else if (auth.includes('APIKey')) s = 2;
    else if (auth.includes('BasicAuth') || auth.includes('SinAutenticacion')) s = 1;
    if (s) { weightedScore += s * 15; evaluatedWeight += 15; scores.authentication = s; }
  }

  const hostMap = { saas: 4, paas: 4, iaas: 3, onPremise: 3 };
  if (hostMap[app.lxHostingType]) {
    weightedScore += hostMap[app.lxHostingType] * 10; evaluatedWeight += 10; scores.hosting = hostMap[app.lxHostingType];
  }

  const dispMap = { MuyAlto: 1, Alto: 4, Medio: 8, Bajo: 24 };
  const targetRto = dispMap[app.Disponibilidad];
  if (targetRto != null && app.RecoveryTimeObjective != null) {
    const actualRto = Number(app.RecoveryTimeObjective);
    if (!isNaN(actualRto)) {
      let s;
      if (actualRto <= targetRto) s = 4;
      else if (actualRto <= targetRto * 2) s = 3;
      else if (actualRto <= targetRto * 4) s = 2;
      else s = 1;
      weightedScore += s * 15; evaluatedWeight += 15; scores.availability = s;
    }
  }

  if (app.ComplianceStandard) {
    const c = String(app.ComplianceStandard).trim();
    if (c && c !== 'Pendiente') {
      const s = (c === 'No Aplica' || c === 'No aplica') ? 3 : 4;
      weightedScore += s * 10; evaluatedWeight += 10; scores.compliance = s;
    }
  }

  if (evaluatedWeight < 50) return { rating: null, score: null, scores, evaluatedWeight };

  const finalScore = weightedScore / evaluatedWeight;
  let rating;
  if (finalScore < 1.75) rating = 'unreasonable';
  else if (finalScore < 2.50) rating = 'inappropriate';
  else if (finalScore < 3.25) rating = 'adequate';
  else rating = 'fullyAppropriate';

  return { rating, score: Math.round(finalScore * 100) / 100, scores, evaluatedWeight };
}

export function groupByDomain(apps) {
  const domains = {};
  apps.forEach(a => {
    if (!domains[a.domain]) {
      domains[a.domain] = { apps: [], counts: { fullyAppropriate: 0, adequate: 0, inappropriate: 0, notEvaluable: 0 } };
    }
    domains[a.domain].apps.push(a);
    if (!a.rating || a.rating === 'unreasonable') domains[a.domain].counts.notEvaluable++;
    else domains[a.domain].counts[a.rating]++;
  });
  return Object.entries(domains).sort((a, b) => b[1].apps.length - a[1].apps.length).slice(0, 8);
}

export function getFindings(apps) {
  return {
    endOfLife:   apps.filter(a => a.lifecycle?.currentPhase === 'endOfLife').length,
    basicAuth:   apps.filter(a => a.TipoDeAutenticacion && String(a.TipoDeAutenticacion).includes('BasicAuth')).length,
    compPending: apps.filter(a => !a.ComplianceStandard || ['', 'Pendiente'].includes(String(a.ComplianceStandard).trim())).length,
    noRto:       apps.filter(a => a.RecoveryTimeObjective == null || a.RecoveryTimeObjective === '').length,
  };
}

export function getSummary(apps) {
  const evaluated = apps.filter(a => a.rating !== null);
  const counts = { fullyAppropriate: 0, adequate: 0, inappropriate: 0, unreasonable: 0 };
  evaluated.forEach(a => counts[a.rating]++);
  return {
    total: apps.length,
    evaluated: evaluated.length,
    notEvaluable: apps.length - evaluated.length,
    coverage: apps.length > 0 ? Math.round((evaluated.length / apps.length) * 100) : 0,
    counts,
  };
}
