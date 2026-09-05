/**
 * 2. report.calc.js — CAPA DE LÓGICA DE NEGOCIO
 *
 * Responsabilidad única: clasificar el landscape, calcular KPIs y preparar
 * estructuras listas para el render.
 */

export const TAB_LABELS = {
  landscape: 'Landscape',
  summary: 'Resumen',
};

export const CATEGORY_META = {
  application: { label: 'Aplicación', color: '#69a8da' },
  component: { label: 'Componente TI', color: '#f28a34' },
  tool: { label: 'Herramienta', color: '#f6b52f' },
  platform: { label: 'Plataforma', color: '#6fbe55' },
};

export const ZONE_META = {
  commercial: { label: 'Comercial', bucket: 'core' },
  supply: { label: 'Supply', bucket: 'core' },
  finance: { label: 'Finanzas', bucket: 'core' },
  hr: { label: 'RRHH', bucket: 'core' },
  cross: { label: 'Cross', bucket: 'core' },
  tools: { label: 'Herramientas', bucket: 'core' },
  bolivia: { label: 'Bolivia', bucket: 'regional' },
  chile: { label: 'Chile', bucket: 'regional' },
  uruguay: { label: 'Uruguay', bucket: 'regional' },
  colombia: { label: 'Colombia', bucket: 'regional' },
  ecuador: { label: 'Ecuador', bucket: 'regional' },
  vitapro: { label: 'Vitapro', bucket: 'regional' },
  shadow: { label: 'Shadow', bucket: 'regional' },
  pending: { label: 'Pendiente clasificar', bucket: 'regional' },
};

export const FUNCTIONAL_AREA_META = {
  commercial: 'Comercial',
  supply: 'Supply',
  finance: 'Finanzas',
  hr: 'RRHH',
  cross: 'Cross',
  tools: 'Herramientas',
};

const PLATFORM_NAMES = new Set([
  'sap scpi',
  'cia',
]);

const TOOL_CROSS_NAMES = new Set([
  'sap bw (oracle)',
  'sap signavio',
  'sap leanix',
  'sap master data governance',
  'sap solution manager',
]);

const SAP_ECOSYSTEM_NAME = 'sap ecosystem';

const ZONE_BY_EXACT_NAME = new Map([
  ['nitro', 'commercial'],
  ['producto unico', 'commercial'],
  ['web de clientes (quijote)', 'commercial'],
  ['alinetwork core', 'commercial'],
  ['alinetwork', 'commercial'],
  ['grow (canal moderno)', 'commercial'],
  ['step (stibo)', 'commercial'],
  ['sap c/4hana sales cloud', 'commercial'],
  ['sap tpm (trade promotion management)', 'commercial'],
  ['soft balanza', 'supply'],
  ['tracking de entregas', 'supply'],
  ['simpliroute', 'supply'],
  ['cape pack', 'supply'],
  ['smart cloud tms - unigis', 'supply'],
  ['portal de proveedores (proveedor ebiz)', 'supply'],
  ['sap s/4hana (core)', 'supply'],
  ['sap ariba sourcing', 'supply'],
  ['sap vim', 'supply'],
  ['sap s4 hana ewm', 'supply'],
  ['atenea', 'finance'],
  ['oracle hyperion planning', 'finance'],
  ['blackline (licenciada con sap)', 'finance'],
  ['oracle epm', 'finance'],
  ['sap bpc (hec s4hana - planning & consolidation)', 'finance'],
  ['sap bpc - consolidación (ibm onhana)', 'finance'],
  ['sap bw/4hana', 'finance'],
  ['sap papm', 'finance'],
  ['gv - hr (payroll)', 'finance'],
  ['teseo', 'hr'],
  ['sap - ssff core (employee center)', 'hr'],
  ['datalake', 'cross'],
  ['activedirectory', 'cross'],
  ['active directory', 'cross'],
  ['aecorsoft', 'cross'],
  ['agente control-m cmp production system', 'cross'],
  ['cloud integration gateway', 'cross'],
  ['conigma connect', 'cross'],
  ['data provisioning agent', 'cross'],
  ['data services agent', 'cross'],
  ['gestion tenores', 'cross'],
  ['sap cloud connector', 'cross'],
  ['sap web dispatcher (on premise)', 'cross'],
]);

const ZONE_BY_PREFIX = [
  { test: /^alinetwork - /, zone: 'commercial' },
  { test: /^odoo\b/, zone: 'commercial' },
  { test: /^sap - ssff /, zone: 'hr' },
  { test: /^sap ibp /, zone: 'supply' },
  { test: /^sap s4 - /, zone: 'supply' },
  { test: /^sap r3 - /, zone: 'supply' },
];

const ORGANIZATION_ZONE_RULES = [
  { test: /marketing|comercial/i, zone: 'commercial' },
  { test: /supply chain/i, zone: 'supply' },
  { test: /finanzas|estrategia/i, zone: 'finance' },
  { test: /recursos humanos|gestion humana|rrhh|human capital/i, zone: 'hr' },
  { test: /tecnologia|transformacion/i, zone: 'cross' },
];

const GROUP_RULES = [
  { test: /^alinetwork - /, key: 'alinetwork', label: 'Alinetwork' },
  { test: /^odoo - /, key: 'odoo', label: 'ODOO' },
  { test: /^sap - ssff /, key: 'sap-ssff', label: 'SAP - SSFF CORE (Employee Center)' },
  { test: /^sap ibp /, key: 'sap-ibp', label: 'SAP IBP (CORE)' },
  { test: /^sap s4 - /, key: 'sap-s4', label: 'SAP S/4HANA (CORE)' },
  { test: /^sap r3 - /, key: 'sap-r3', label: 'SAP ECC (R/3 CORE)' },
  { test: /^sap bpc /, key: 'sap-bpc', label: 'SAP BPC - planning & consolidation' },
];

const MODULE_PATTERNS = [
  /\bm[oó]dulo\b/i,
  /^sap r3 - /i,
  /^sap s4 - /i,
  /^sap - ssff destaca /i,
  /^sap ibp (for demand|supply)$/i,
  /^sap bpc - /i,
  /^sap bpc \(/i,
];

function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

export function processLandscapeData({ applications, itComponents }) {
  const processedComponents = itComponents.map(item => enrichItem(item));
  const componentIndex = new Map(processedComponents.map(item => [item.id, item]));
  const processedApplications = applications
    .map(app => hydrateApplicationRelations(app, componentIndex))
    .map(app => enrichItem(app));
  const level1Applications = processedApplications.filter(item => item.isLevel1Application);
  const items = [...level1Applications, ...processedComponents];

  logMissingData(items);

  return {
    items,
    applications: processedApplications,
    level1Applications,
    itComponents: processedComponents,
    summary: buildSummary(items, processedApplications, level1Applications),
    landscape: buildLandscape(items),
  };
}

function hydrateApplicationRelations(application, componentIndex) {
  const relatedItComponents = (application.relatedItComponents || []).map(component => {
    const enriched = componentIndex.get(component.id);
    if (!enriched) return component;

    return {
      ...component,
      parentComponentName: enriched.parentComponentName || '',
      alignmentParent: enriched.alignmentParent || '',
      providers: enriched.providers || [],
      technologyAssetType: enriched.technologyAssetType || '',
    };
  });

  return {
    ...application,
    relatedItComponents,
  };
}

function enrichItem(item) {
  const assetCategory = resolveAssetCategory(item);
  const society = resolveSociety(item);
  const functionalArea = resolveFunctionalArea({ ...item, assetCategory, society });
  const zone = resolveZone({ ...item, assetCategory, society, functionalArea });
  const group = resolveGroup(item);
  const isPrimaryApplication = item.kind !== 'application' ? false : !MODULE_PATTERNS.some(rx => rx.test(item.name));
  const childrenCount = item.kind === 'application' ? item.childApps.length : 0;
  const isLevel1Application = item.kind === 'application' ? !item.parentId : false;
  const alignmentParent = resolveAlignmentParent(item);

  return {
    ...item,
    assetCategory,
    society,
    functionalArea,
    zone,
    groupKey: group.key,
    groupLabel: group.label,
    isPrimaryApplication,
    isLevel1Application,
    childrenCount,
    alignmentParent,
  };
}

function resolveAssetCategory(item) {
  if (PLATFORM_NAMES.has(normalize(item.name))) return 'platform';
  if (item.kind === 'application') return 'application';
  if (item.kind === 'tool') return 'tool';
  if (item.technologyAssetType === 'tool') return 'tool';
  return 'component';
}

function resolveSociety(item) {
  const governance = normalize(item.governance);
  if (governance === 'vitapro') return 'Vitapro';
  if (governance === 'bolivia') return 'Bolivia';
  if (governance === 'chile') return 'Chile';
  if (governance === 'colombia') return 'Colombia';
  if (governance === 'ecuador') return 'Ecuador';
  if (governance === 'uruguay') return 'Uruguay';
  if (governance === 'businessmanaged') return 'Shadow Alicorp Peru';
  return 'Alicorp Peru';
}

function resolveZone(item) {
  if (item.society === 'Bolivia') return 'bolivia';
  if (item.society === 'Chile') return 'chile';
  if (item.society === 'Uruguay') return 'uruguay';
  if (item.society === 'Colombia') return 'colombia';
  if (item.society === 'Ecuador') return 'ecuador';
  if (item.society === 'Vitapro') return 'vitapro';
  if (item.society === 'Shadow Alicorp Peru') return 'shadow';

  if (item.assetCategory === 'tool' && item.society !== 'Shadow Alicorp Peru') {
    return 'tools';
  }

  if (item.functionalArea) return item.functionalArea;

  if (item.assetCategory === 'component' && normalize(item.parentComponentName) === SAP_ECOSYSTEM_NAME) return 'cross';
  if (item.assetCategory === 'platform') return 'cross';
  return 'pending';
}

function resolveFunctionalArea(item) {
  const candidates = getZoneCandidates(item);
  for (const candidate of candidates) {
    const byExact = ZONE_BY_EXACT_NAME.get(candidate);
    if (byExact) return byExact;
  }

  for (const candidate of candidates) {
    const byPrefix = ZONE_BY_PREFIX.find(rule => rule.test.test(candidate));
    if (byPrefix) return byPrefix.zone;
  }

  const organizationZone = resolveZoneFromOrganizations(item.organizations);
  if (organizationZone) return organizationZone;

  if (item.assetCategory === 'tool') {
    if (candidates.some(candidate => TOOL_CROSS_NAMES.has(candidate))) return 'cross';
    if (normalize(item.parentComponentName) === SAP_ECOSYSTEM_NAME) return 'cross';
    return 'tools';
  }

  if (item.assetCategory === 'component' && normalize(item.parentComponentName) === SAP_ECOSYSTEM_NAME) return 'cross';
  if (item.assetCategory === 'platform') return 'cross';
  return '';
}

function resolveGroup(item) {
  for (const rule of GROUP_RULES) {
    if (rule.test.test(item.name)) return { key: rule.key, label: rule.label };
    if (item.parentName && rule.test.test(item.parentName)) {
      return { key: rule.key, label: rule.label };
    }
    if ((item.relatedItComponents || []).some(component => rule.test.test(component.name))) {
      return { key: rule.key, label: rule.label };
    }
    if (item.parentComponentName && rule.test.test(item.parentComponentName)) {
      return { key: rule.key, label: rule.label };
    }
  }
  return { key: item.id, label: item.name };
}

function resolveAlignmentParent(item) {
  if (item.kind === 'application') {
    const sapParent = (item.relatedItComponents || []).find(component => normalize(component.name) === SAP_ECOSYSTEM_NAME);
    if (sapParent) return sapParent.name;

    const sapRelatedParent = (item.relatedItComponents || []).find(component =>
      normalize(component.parentComponentName || '') === SAP_ECOSYSTEM_NAME
      || normalize(component.alignmentParent || '') === SAP_ECOSYSTEM_NAME
      || (component.providers || []).some(provider => normalize(provider.name).includes('sap'))
    );
    if (sapRelatedParent) return 'SAP Ecosystem';

    return item.relatedItComponents?.[0]?.name || '';
  }

  if (item.kind === 'tool' && normalize(item.name).includes('sap')) {
    return 'SAP Ecosystem';
  }

  const sapProvider = (item.providers || []).find(provider => normalize(provider.name).includes('sap'));
  if (sapProvider) return 'SAP Ecosystem';

  return item.parentComponentName || '';
}

function getZoneCandidates(item) {
  const names = [item.name];

  (item.relatedItComponents || []).forEach(component => names.push(component.name));
  (item.providers || []).forEach(provider => names.push(provider.name));
  if (item.parentName) names.push(item.parentName);
  if (item.parentComponentName) names.push(item.parentComponentName);
  if (item.alignmentParent) names.push(item.alignmentParent);

  return uniq(names.map(normalize));
}

function resolveZoneFromOrganizations(organizations) {
  const secondLevels = extractSecondLevelOrganizations(organizations);
  if (!secondLevels.length) return '';

  const matchedRule = ORGANIZATION_ZONE_RULES.find(rule =>
    secondLevels.some(level => rule.test.test(level))
  );
  return matchedRule?.zone || '';
}

function extractSecondLevelOrganizations(organizations) {
  return uniq((organizations || [])
    .map(org => String(org || '')
      .split(' / ')
      .map(part => part.trim())
      .filter(Boolean)[1] || '')
    .filter(Boolean)
    .map(normalize));
}

function buildSummary(items, applications, level1Applications) {
  const counts = {
    applications: level1Applications.length,
    appModules: applications.length,
    tools: items.filter(item => item.assetCategory === 'tool').length,
    components: items.filter(item => item.assetCategory === 'component').length,
    platforms: items.filter(item => item.assetCategory === 'platform').length,
    total: items.length,
  };

  const societies = [
    'Alicorp Peru',
    'Bolivia',
    'Chile',
    'Uruguay',
    'Colombia',
    'Ecuador',
    'Vitapro',
    'Shadow Alicorp Peru',
  ];

  const distribution = societies.map(society => {
    const rowItems = items.filter(item => item.society === society);
    return {
      society,
      total: rowItems.length,
      application: rowItems.filter(item => item.assetCategory === 'application').length,
      component: rowItems.filter(item => item.assetCategory === 'component').length,
      tool: rowItems.filter(item => item.assetCategory === 'tool').length,
      platform: rowItems.filter(item => item.assetCategory === 'platform').length,
    };
  }).filter(row => row.total > 0);

  const governance = societies.map(society => ({
    label: society === 'Alicorp Peru' ? 'Admin TI Alicorp Peru' : society,
    total: level1Applications.filter(item => item.society === society).length,
  })).filter(row => row.total > 0);

  return { counts, distribution, governance };
}

function buildLandscape(items) {
  const sapEcosystemItems = items.filter(item => normalize(item.alignmentParent) === SAP_ECOSYSTEM_NAME);
  const regularItems = items.filter(item => normalize(item.alignmentParent) !== SAP_ECOSYSTEM_NAME);
  const grouped = Object.keys(ZONE_META).reduce((acc, key) => ({ ...acc, [key]: [] }), {});
  const rankedRegionalZones = ['bolivia', 'chile', 'uruguay', 'colombia', 'ecuador', 'vitapro'];

  regularItems.forEach(item => {
    grouped[item.zone] = grouped[item.zone] || [];
    grouped[item.zone].push(item);
  });

  const zones = Object.entries(grouped).reduce((acc, [zone, zoneItems]) => {
    acc[zone] = collapseZone(zoneItems);
    return acc;
  }, {});

  const regionalZones = rankedRegionalZones
    .slice()
    .sort((left, right) => {
      const leftItems = grouped[left] || [];
      const rightItems = grouped[right] || [];
      const leftApplications = leftItems.filter(item => item.assetCategory === 'application').length;
      const rightApplications = rightItems.filter(item => item.assetCategory === 'application').length;
      if (rightApplications !== leftApplications) return rightApplications - leftApplications;

      if (rightItems.length !== leftItems.length) return rightItems.length - leftItems.length;

      return ZONE_META[left].label.localeCompare(ZONE_META[right].label, 'es');
    });

  return {
    coreZones: ['commercial', 'supply', 'finance', 'hr', 'cross', 'tools'],
    regionalZones: [...regionalZones, 'shadow', 'pending'],
    sapEcosystem: groupSapEcosystem(sapEcosystemItems),
    zones,
  };
}

function groupSapEcosystem(items) {
  const areas = ['commercial', 'supply', 'finance', 'hr', 'cross', 'tools'];
  return areas.map(area => ({
    key: area,
    label: FUNCTIONAL_AREA_META[area],
    groups: collapseZone(items.filter(item => item.functionalArea === area)),
  }));
}

function collapseZone(items) {
  const groups = new Map();

  items.forEach(item => {
    const key = `${item.groupKey}:${item.assetCategory}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: item.groupLabel,
        assetCategory: item.assetCategory,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      count: group.items.length,
      badgeCount: group.assetCategory === 'application'
        ? group.items.reduce((sum, item) => sum + (item.childrenCount || 0), 0)
        : group.items.length,
      alignmentParents: uniq(group.items.map(item => item.alignmentParent)),
      functionalAreas: uniq(group.items.map(item => item.functionalArea)),
      channels: uniq(group.items.map(item => item.channel)),
      descriptions: uniq(group.items.map(item => item.description)),
    }))
    .sort((a, b) => {
      const categoryOrder = ['application', 'platform', 'tool', 'component'];
      const byCategory = categoryOrder.indexOf(a.assetCategory) - categoryOrder.indexOf(b.assetCategory);
      return byCategory !== 0 ? byCategory : a.label.localeCompare(b.label, 'es');
    });
}

function logMissingData(items) {
  const pending = items.filter(item => item.zone === 'pending');
  if (pending.length) {
    console.warn('[software-landscape] Items sin clasificar en el landscape:', pending.map(item => ({
      id: item.id,
      name: item.name,
      kind: item.kind,
      alignmentParent: item.alignmentParent,
      governance: item.governance,
      organizations: item.organizations,
    })));
  }

  const missingGovernance = items.filter(item => !item.governance);
  if (missingGovernance.length) {
    console.warn('[software-landscape] Items sin governance:', missingGovernance.map(item => item.name));
  }
}
