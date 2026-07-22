import { BaseReport, escapeHtml, getShortName, graphQL } from '@shared/index.js';
import { exportGapsExcel, exportPDF } from './export.js';

const LAYERS = [
  { key: 'estrategicos', label: 'Objetivos EstratÃ©gicos', shortLabel: 'Objetivo estratÃ©gico', color: '#8a38d1', bg: '#faf5ff', icon: 'â—Ž', relation: 'Realiza / Contribuye' },
  { key: 'tacticos', label: 'Objetivos TÃ¡cticos', shortLabel: 'Objetivos tÃ¡cticos', color: '#f97316', bg: '#fff7ed', icon: 'â—‡', relation: 'Relaciona / InteractÃºa' },
  { key: 'iniciativas', label: 'Iniciativas', shortLabel: 'Iniciativa', color: '#0f9aaa', bg: '#ecfeff', icon: 'â–·', relation: 'Soporta / Habilita' },
  { key: 'capability', label: 'Capacidades', shortLabel: 'Capacidades', color: '#3b82f6', bg: '#eff6ff', icon: 'âŠž', relation: 'Realiza / Contribuye' },
  { key: 'process', label: 'Procesos', shortLabel: 'Procesos', color: '#b45309', bg: '#fffbeb', icon: 'â—‰', relation: 'Relaciona / InteractÃºa' },
  { key: 'application', label: 'Aplicaciones', shortLabel: 'Aplicaciones', color: '#2563eb', bg: '#eff6ff', icon: 'â–£', relation: 'Soporta / Habilita' },
  { key: 'interface', label: 'Interfaces', shortLabel: 'Interfaces', color: '#8b5cf6', bg: '#f5f3ff', icon: 'â‡„', relation: 'Depende de / Usa' },
  { key: 'itcomponent', label: 'Componentes TI', shortLabel: 'Componentes TI', color: '#16a34a', bg: '#f0fdf4', icon: 'â–¤', relation: 'Alojado en / Implementado en' },
  { key: 'dataobject', label: 'Objetos de Datos', shortLabel: 'Objetos de Datos', color: '#64748b', bg: '#f8fafc', icon: 'â—Œ', relation: 'Suministra / Provee' },
];

const EMPTY_DATA = { estrategicos: [], tacticos: [], iniciativas: [], capability: [], process: [], application: [], interface: [], dataobject: [], itcomponent: [] };
const TAG_FILTERS = ['GTM'];

export class StrategicMapReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.objectives = [];
    this.empresas = [];
    this.vps = [];
    this.selectedEmpresa = null;
    this.selectedVP = null;
    this.data = { ...EMPTY_DATA };
    this.relations = [];
    this.gapReport = this.buildGapReport(this.data);
    this.searchText = '';
    this.selectedTag = '';
    this.showOnlyOrphans = false;
    this.zoom = 100;
    this.boundResize = null;
  }

  async loadData() {
    this.showLoading('Cargando Mapa EstratÃ©gico...');

    try {
      const objQ = `{ allFactSheets(factSheetType: Objective) { edges { node { id displayName description type tags { name } completion { completion }
        ... on Objective {
          Tipo
          Principio
          IDExterno
          KPI
          NivelDePrioridad
          OKR
          lxState
          relToParent { edges { node { factSheet { id displayName } } } }
          relToChild { edges { node { factSheet { id displayName type } } } }
          relObjectiveToOrganization { edges { node { factSheet { id displayName } } } }
          relObjectiveToBusinessCapability { edges { node { factSheet { id displayName } } } }
          relObjectiveToInitiative { edges { node { factSheet { id displayName } } } }
        }
      } } } }`;

      const objResult = await graphQL(objQ);
      this.objectives = objResult.allFactSheets.edges.map(e => ({
        id: e.node.id,
        name: getShortName(e.node.displayName),
        fullName: e.node.displayName,
        description: e.node.description || '',
        principio: e.node.Principio || '',
        externalId: e.node.IDExterno || '',
        kpi: e.node.KPI || '',
        priorityLevel: e.node.NivelDePrioridad || '',
        okr: e.node.OKR || '',
        tipo: e.node.Tipo,
        tags: e.node.tags?.map(t => t.name) || [],
        parentId: e.node.relToParent?.edges?.[0]?.node?.factSheet?.id || null,
        childIds: (e.node.relToChild?.edges || []).map(re => re.node.factSheet.id),
        orgName: e.node.relObjectiveToOrganization?.edges?.[0]?.node?.factSheet?.displayName || '',
        capIds: (e.node.relObjectiveToBusinessCapability?.edges || []).map(re => re.node.factSheet.id),
        completion: e.node.completion?.completion || null,
        lxState: e.node.lxState || '',
        childItems: (e.node.relToChild?.edges || []).map(re => ({ id: re.node.factSheet.id, name: re.node.factSheet.displayName, type: re.node.factSheet.type })),
        parentName: e.node.relToParent?.edges?.[0]?.node?.factSheet?.displayName || '',
        capNames: (e.node.relObjectiveToBusinessCapability?.edges || []).map(re => re.node.factSheet.displayName),
        iniciativaNames: (e.node.relObjectiveToInitiative?.edges || []).map(re => re.node.factSheet.displayName),
      }));

      this.empresas = this.objectives.filter(o => o.tipo === 'Objetivo_Empresarial');
      this.selectedEmpresa = this.empresas[0] || null;
      this.vps = this.selectedEmpresa ? this.objectives.filter(o => o.tipo === 'Objetivo_VP' && o.parentId === this.selectedEmpresa.id) : [];
      this.selectedVP = this.vps[0] || null;

      const [caps, apps, ifaces, dos, iniciativas, processes, its] = await Promise.all([
        this.fetchCaps(),
        this.fetchApps(),
        this.fetchInterfaces().catch(() => []),
        this.fetchDOs(),
        this.fetchIniciativas(),
        this.fetchProcesses(),
        this.fetchITs(),
      ]);
      this.allCaps = caps;
      this.allApps = apps;
      this.allInterfaces = ifaces;
      this.allDOs = dos;
      this.allIniciativas = iniciativas;
      this.allProcesses = processes;
      this.allITs = its;

      this.filterAndRender();
    } catch (error) {
      this.showError(error);
    }
  }

  async fetchCaps() {
    const enriched = `{ allFactSheets(factSheetType: BusinessCapability) { edges { node { id displayName description tags { name } completion { completion } ... on BusinessCapability { lxState externalId { externalId } lxEnterpriseDomain currentMaturity targetMaturity strategicImportance relBusinessCapabilityToApplication { edges { node { factSheet { id } } } } } } } } }`;
    const fallback = `{ allFactSheets(factSheetType: BusinessCapability) { edges { node { id displayName tags { name } ... on BusinessCapability { externalId { externalId } relBusinessCapabilityToApplication { edges { node { factSheet { id } } } } } } } } }`;
    let r;
    try {
      r = await graphQL(enriched);
    } catch (error) {
      r = await graphQL(fallback);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      lxEnterpriseDomain: e.node.lxEnterpriseDomain || '',
      currentMaturity: e.node.currentMaturity || '',
      targetMaturity: e.node.targetMaturity || '',
      strategicImportance: e.node.strategicImportance || '',
      appIds: (e.node.relBusinessCapabilityToApplication?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchApps() {
    const baseFields = `id displayName description tags { name } completion { completion } ... on Application { lxState externalId { externalId } lifecycle { phases { phase startDate } } technicalSuitability TipoDeArquitectura TipoDeAutenticacion lxHostingType Disponibilidad RecoveryTimeObjective ComplianceStandard TipoAplicacion criticidadDeDatos Confidencialidad Integridad Proposito CanalDeAcceso TipoDeDesarrollo categoriaFuncional release activoDeSoftware relApplicationToDataObject { edges { node { factSheet { id } } } } relApplicationToITComponent { edges { node { factSheet { id } } } }`;
    const withOrganization = `{ allFactSheets(factSheetType: Application) { edges { node { ${baseFields} relApplicationToOrganization { edges { node { factSheet { id displayName } } } } } } } } }`;
    const fallbackFields = `id displayName tags { name } ... on Application { externalId { externalId } relApplicationToDataObject { edges { node { factSheet { id } } } } relApplicationToITComponent { edges { node { factSheet { id } } } }`;
    const minimalWithOrganization = `{ allFactSheets(factSheetType: Application) { edges { node { ${fallbackFields} relApplicationToOrganization { edges { node { factSheet { id displayName } } } } } } } } }`;
    const withoutOrganization = `{ allFactSheets(factSheetType: Application) { edges { node { ${fallbackFields} } } } } }`;
    let r;
    try {
      r = await graphQL(withOrganization);
    } catch (error) {
      try {
        r = await graphQL(minimalWithOrganization);
      } catch (fallbackError) {
        r = await graphQL(withoutOrganization);
      }
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      lifecycle: { currentPhase: this.getCurrentPhase(e.node.lifecycle?.phases) },
      technicalSuitability: e.node.technicalSuitability || '',
      TipoDeArquitectura: e.node.TipoDeArquitectura || '',
      TipoDeAutenticacion: e.node.TipoDeAutenticacion || '',
      lxHostingType: e.node.lxHostingType || '',
      Disponibilidad: e.node.Disponibilidad || '',
      RecoveryTimeObjective: e.node.RecoveryTimeObjective ?? '',
      ComplianceStandard: e.node.ComplianceStandard || '',
      TipoAplicacion: e.node.TipoAplicacion || '',
      criticidadDeDatos: e.node.criticidadDeDatos || '',
      Confidencialidad: e.node.Confidencialidad || '',
      Integridad: e.node.Integridad || '',
      Proposito: e.node.Proposito || '',
      CanalDeAcceso: e.node.CanalDeAcceso || '',
      TipoDeDesarrollo: e.node.TipoDeDesarrollo || '',
      categoriaFuncional: e.node.categoriaFuncional || '',
      release: e.node.release || '',
      activoDeSoftware: e.node.activoDeSoftware || '',
      orgNames: (e.node.relApplicationToOrganization?.edges || []).map(re => getShortName(re.node.factSheet.displayName)),
      doIds: (e.node.relApplicationToDataObject?.edges || []).map(re => re.node.factSheet.id),
      itIds: (e.node.relApplicationToITComponent?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchITs() {
    const enriched = `{ allFactSheets(factSheetType: ITComponent) { edges { node { id displayName description tags { name } completion { completion } ... on ITComponent { lxState externalId { externalId } category enviroment Dominio Funcion Criticidad } } } } }`;
    const fallback = `{ allFactSheets(factSheetType: ITComponent) { edges { node { id displayName tags { name } ... on ITComponent { externalId { externalId } } } } } }`;
    let r;
    try {
      r = await graphQL(enriched);
    } catch (error) {
      r = await graphQL(fallback);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      category: e.node.category || '',
      enviroment: e.node.enviroment || '',
      Dominio: e.node.Dominio || '',
      Funcion: e.node.Funcion || '',
      Criticidad: e.node.Criticidad || '',
    }));
  }

  async fetchInterfaces() {
    const enriched = `{ allFactSheets(factSheetType: Interface) { edges { node { id displayName description tags { name } completion { completion } ... on Interface { lxState externalId { externalId } category Criticidad interfaceIdSequence relInterfaceToProviderApplication { edges { node { factSheet { id } } } } relInterfaceToConsumerApplication { edges { node { factSheet { id } } } } relInterfaceToDataObject { edges { node { factSheet { id } } } } } } } } }`;
    const fallback = `{ allFactSheets(factSheetType: Interface) { edges { node { id displayName tags { name } ... on Interface { externalId { externalId } relInterfaceToProviderApplication { edges { node { factSheet { id } } } } relInterfaceToConsumerApplication { edges { node { factSheet { id } } } } relInterfaceToDataObject { edges { node { factSheet { id } } } } } } } } }`;
    let r;
    try {
      r = await graphQL(enriched);
    } catch (error) {
      r = await graphQL(fallback);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      category: e.node.category || '',
      Criticidad: e.node.Criticidad || '',
      interfaceIdSequence: e.node.interfaceIdSequence || '',
      appIds: [
        ...(e.node.relInterfaceToProviderApplication?.edges || []).map(re => re.node.factSheet.id),
        ...(e.node.relInterfaceToConsumerApplication?.edges || []).map(re => re.node.factSheet.id),
      ],
      doIds: (e.node.relInterfaceToDataObject?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchDOs() {
    const withRelations = `{ allFactSheets(factSheetType: DataObject) { edges { node { id displayName description tags { name } completion { completion } ... on DataObject { lxState externalId { externalId } Confidencialidad Criticidad relDataObjectToApplication { edges { node { factSheet { id } } } } relDataObjectToInterface { edges { node { factSheet { id } } } } relDataObjectToInitiative { edges { node { factSheet { id } } } } } } } } }`;
    const withoutRelations = `{ allFactSheets(factSheetType: DataObject) { edges { node { id displayName tags { name } ... on DataObject { externalId { externalId } } } } } }`;
    let r;
    try {
      r = await graphQL(withRelations);
    } catch (error) {
      r = await graphQL(withoutRelations);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      Confidencialidad: e.node.Confidencialidad || '',
      Criticidad: e.node.Criticidad || '',
      appIds: (e.node.relDataObjectToApplication?.edges || []).map(re => re.node.factSheet.id),
      ifaceIds: (e.node.relDataObjectToInterface?.edges || []).map(re => re.node.factSheet.id),
      iniciativaIds: (e.node.relDataObjectToInitiative?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchIniciativas() {
    const enriched = `{ allFactSheets(factSheetType: Initiative) { edges { node { id displayName description tags { name } completion { completion } ... on Initiative { lxState externalId { externalId } category Prioridad projectStatus businessValue businessValueDescription lifecycle { phases { phase startDate } } relInitiativeToObjective { edges { node { factSheet { id } } } } relInitiativeToBusinessCapability { edges { node { factSheet { id } } } } } } } } }`;
    const fallback = `{ allFactSheets(factSheetType: Initiative) { edges { node { id displayName tags { name } ... on Initiative { externalId { externalId } relInitiativeToObjective { edges { node { factSheet { id } } } } relInitiativeToBusinessCapability { edges { node { factSheet { id } } } } } } } } }`;
    let r;
    try {
      r = await graphQL(enriched);
    } catch (error) {
      r = await graphQL(fallback);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      category: e.node.category || '',
      Prioridad: e.node.Prioridad || '',
      projectStatus: e.node.projectStatus || '',
      businessValue: e.node.businessValue || '',
      businessValueDescription: e.node.businessValueDescription || '',
      lifecycle: { currentPhase: this.getCurrentPhase(e.node.lifecycle?.phases) },
      parentObjId: e.node.relInitiativeToObjective?.edges?.[0]?.node?.factSheet?.id || null,
      capIds: (e.node.relInitiativeToBusinessCapability?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchProcesses() {
    const enriched = `{ allFactSheets(factSheetType: BusinessContext) { edges { node { id displayName description tags { name } completion { completion } ... on BusinessContext { lxState externalId { externalId } category signavioProcessId Entrada Salida Objetivo frecuencia relBusinessContextToApplication { edges { node { factSheet { id } } } } relBusinessContextToBusinessCapability { edges { node { factSheet { id } } } } } } } } }`;
    const fallback = `{ allFactSheets(factSheetType: BusinessContext) { edges { node { id displayName tags { name } ... on BusinessContext { externalId { externalId } relBusinessContextToApplication { edges { node { factSheet { id } } } } relBusinessContextToBusinessCapability { edges { node { factSheet { id } } } } } } } } }`;
    let r;
    try {
      r = await graphQL(enriched);
    } catch (error) {
      r = await graphQL(fallback);
    }
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id,
      name: getShortName(e.node.displayName),
      description: e.node.description || '',
      code: e.node.externalId?.externalId || '',
      tags: e.node.tags?.map(t => t.name) || [],
      completion: e.node.completion?.completion || null,
      lxState: e.node.lxState || '',
      category: e.node.category || '',
      signavioProcessId: e.node.signavioProcessId || '',
      Entrada: e.node.Entrada || '',
      Salida: e.node.Salida || '',
      Objetivo: e.node.Objetivo || '',
      frecuencia: e.node.frecuencia || '',
      capIds: (e.node.relBusinessContextToBusinessCapability?.edges || []).map(re => re.node.factSheet.id),
      appIds: (e.node.relBusinessContextToApplication?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  getCurrentPhase(phases) {
    if (!phases || !phases.length) return null;
    const now = new Date().toISOString().slice(0, 10);
    const sorted = [...phases].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    let current = null;
    for (const phase of sorted) {
      if (!phase.startDate || phase.startDate <= now) current = phase.phase;
    }
    return current;
  }

  filterAndRender() {
    if (!this.selectedVP) {
      this.data = { ...EMPTY_DATA };
      this.relations = [];
      this.render();
      return;
    }

    const estrategicos = this.objectives.filter(o => o.tipo === 'Objetivos' && o.parentId === this.selectedVP.id);
    const estIds = new Set(estrategicos.map(e => e.id));
    const tacticos = this.objectives.filter(o => o.tipo === 'ObjetivoTactico' && estIds.has(o.parentId));
    const tacIds = new Set(tacticos.map(t => t.id));
    const iniciativas = this.allIniciativas.filter(i => tacIds.has(i.parentObjId));
    const allObjs = [...estrategicos, ...tacticos, ...iniciativas];
    const capIds = new Set(allObjs.flatMap(o => o.capIds || []));
    const caps = this.allCaps.filter(c => capIds.has(c.id));
    const capIdSet = new Set(caps.map(c => c.id));
    const appIdsFromCaps = new Set(caps.flatMap(c => c.appIds));
    const processes = this.allProcesses.filter(p => p.capIds.some(cid => capIdSet.has(cid)) || p.appIds.some(aid => appIdsFromCaps.has(aid)));
    const processAppIds = processes.flatMap(p => p.appIds);
    const appIds = new Set(processAppIds.length ? processAppIds : caps.flatMap(c => c.appIds));
    const apps = this.allApps.filter(a => appIds.has(a.id));
    const appIdSet = new Set(apps.map(a => a.id));
    const ifaces = this.allInterfaces.filter(i => i.appIds.some(aid => appIdSet.has(aid)));
    const ifaceIdSet = new Set(ifaces.map(i => i.id));
    const doIds = new Set([
      ...apps.flatMap(a => a.doIds),
      ...ifaces.flatMap(i => i.doIds),
      ...this.allDOs.filter(d =>
        (d.appIds || []).some(aid => appIdSet.has(aid)) ||
        (d.ifaceIds || []).some(iid => ifaceIdSet.has(iid))
      ).map(d => d.id),
    ]);
    const dos = this.allDOs.filter(d => doIds.has(d.id));
    const itIds = new Set(apps.flatMap(a => a.itIds));
    const its = this.allITs.filter(i => itIds.has(i.id));
    const dependencySummaries = this.buildDependencySummaries(apps, ifaces, its, dos);

    this.data = { estrategicos, tacticos, iniciativas, capability: caps, process: processes, application: apps, interface: ifaces, dataobject: dos, itcomponent: its, dependencySummaries };
    this.gapReport = this.buildGapReport(this.data);
    this.relations = [];

    for (const t of tacticos) this.relations.push({ from: t.parentId, to: t.id, fromLayer: 'estrategicos', toLayer: 'tacticos' });
    for (const i of iniciativas) this.relations.push({ from: i.parentObjId, to: i.id, fromLayer: 'tacticos', toLayer: 'iniciativas' });
    for (const obj of allObjs) {
      for (const capId of (obj.capIds || [])) {
        if (capIds.has(capId)) {
          let fromLayer = 'iniciativas';
          if (estIds.has(obj.id)) fromLayer = 'estrategicos';
          else if (tacIds.has(obj.id)) fromLayer = 'tacticos';
          this.relations.push({ from: obj.id, to: capId, fromLayer, toLayer: 'capability' });
        }
      }
    }
    for (const cap of caps) {
      if (processes.length > 0) continue;
      for (const appId of cap.appIds) {
        if (appIds.has(appId)) this.relations.push({ from: cap.id, to: appId, fromLayer: 'capability', toLayer: 'application' });
      }
    }
    for (const proc of processes) {
      for (const cid of proc.capIds) {
        if (capIdSet.has(cid)) this.relations.push({ from: cid, to: proc.id, fromLayer: 'capability', toLayer: 'process' });
      }
      for (const appId of proc.appIds) {
        if (appIds.has(appId)) this.relations.push({ from: proc.id, to: appId, fromLayer: 'process', toLayer: 'application' });
      }
    }
    for (const summary of dependencySummaries) {
      this.relations.push({ from: summary.appId, to: summary.id, fromLayer: 'application', toLayer: summary.kind });
    }

    this.render();
    this.bindEvents();
  }

  buildDependencySummaries(apps, interfaces, components, dataObjects) {
    const summaries = [];
    for (const app of apps) {
      const appInterfaces = interfaces.filter(item => item.appIds.includes(app.id));
      const appComponents = components.filter(item => app.itIds.includes(item.id));
      const appInterfaceIds = new Set(appInterfaces.map(item => item.id));
      const appDataObjects = [...new Map(dataObjects
        .filter(item =>
          (item.appIds || []).includes(app.id) ||
          (app.doIds || []).includes(item.id) ||
          (item.ifaceIds || []).some(ifaceId => appInterfaceIds.has(ifaceId)) ||
          appInterfaces.some(iface => (iface.doIds || []).includes(item.id))
        )
        .map(item => [item.id, item])).values()];

      summaries.push({
        id: `summary:interface:${app.id}`,
        kind: 'interface',
        appId: app.id,
        appName: app.name,
        name: `${appInterfaces.length} interfaces`,
        code: app.name,
        count: appInterfaces.length,
        items: appInterfaces,
      });

      summaries.push({
        id: `summary:itcomponent:${app.id}`,
        kind: 'itcomponent',
        appId: app.id,
        appName: app.name,
        name: `${appComponents.length} componentes TI`,
        code: app.name,
        count: appComponents.length,
        items: appComponents,
      });

      summaries.push({
        id: `summary:dataobject:${app.id}`,
        kind: 'dataobject',
        appId: app.id,
        appName: app.name,
        name: `${appDataObjects.length} objetos de datos`,
        code: app.name,
        count: appDataObjects.length,
        items: appDataObjects,
      });
    }

    return summaries.filter(summary => summary.count > 0);
  }

  buildGapReport(data) {
    const rows = [];
    const evaluations = new Map();
    const layerDefs = new Map(LAYERS.map(layer => [layer.key, layer]));
    const layersToEvaluate = ['estrategicos', 'tacticos', 'iniciativas', 'capability', 'process', 'application', 'interface', 'itcomponent', 'dataobject'];
    const hasValue = value => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim() !== '';
    };
    const completionOk = item => item.completion === null || item.completion === undefined || Number(item.completion) >= 0.75;
    const qualityOk = item => !String(item.lxState || '').toUpperCase().includes('BROKEN');
    const baseRules = item => [
      { ok: completionOk(item), field: 'Completion LeanIX', message: 'Completion menor al 75%', action: 'Completar campos recomendados por LeanIX', severity: 'medium', weight: 1 },
      { ok: qualityOk(item), field: 'Quality Seal', message: 'Quality seal roto o estado de calidad invalido', action: 'Resolver el quality seal en LeanIX', severity: 'critical', weight: 2 },
    ];
    const fieldRule = (item, key, field, action, severity = 'medium', weight = 1) => ({
      ok: hasValue(item[key]),
      field,
      message: `Falta ${field}`,
      action,
      severity,
      weight,
    });
    const relationRule = (ok, field, message, action, severity = 'critical', weight = 2) => ({ ok, field, message, action, severity, weight });
    const phaseRule = (item, field, action, severity = 'medium', weight = 1) => ({
      ok: hasValue(item.lifecycle?.currentPhase),
      field,
      message: `Falta ${field}`,
      action,
      severity,
      weight,
    });
    const summarize = () => {
      const byLayer = layersToEvaluate.map(layerKey => {
        const label = layerDefs.get(layerKey)?.label || layerKey;
        const evals = [...evaluations.values()].filter(item => item.layerKey === layerKey);
        const total = evals.length;
        const complete = evals.filter(item => item.status === 'complete').length;
        const critical = evals.filter(item => item.status === 'critical').length;
        return { layerKey, label, total, complete, critical, withGaps: total - complete, avgScore: total ? Math.round(evals.reduce((sum, item) => sum + item.score, 0) / total) : 100 };
      });
      const evalList = [...evaluations.values()];
      const total = evalList.length;
      const complete = evalList.filter(item => item.status === 'complete').length;
      const critical = evalList.filter(item => item.status === 'critical').length;
      return {
        rows,
        byLayer,
        evaluations,
        summary: {
          total,
          complete,
          critical,
          withGaps: total - complete,
          avgScore: total ? Math.round(evalList.reduce((sum, item) => sum + item.score, 0) / total) : 100,
        },
      };
    };

    const addEvaluation = (layerKey, item, rules) => {
      const missing = rules.filter(rule => !rule.ok);
      const criticalCount = missing.filter(rule => rule.severity === 'critical').length;
      const mediumCount = missing.filter(rule => rule.severity !== 'critical').length;
      const totalWeight = rules.reduce((sum, rule) => sum + (rule.weight || 1), 0) || 1;
      const missingWeight = missing.reduce((sum, rule) => sum + (rule.weight || 1), 0);
      const score = Math.max(0, Math.round(((totalWeight - missingWeight) / totalWeight) * 100));
      const status = criticalCount > 0 ? 'critical' : mediumCount > 0 ? 'warning' : 'complete';
      const evaluation = { layerKey, itemId: item.id, score, status, missing, criticalCount, mediumCount };
      evaluations.set(`${layerKey}:${item.id}`, evaluation);

      if (missing.length === 0) {
        rows.push(this.makeGapRow(layerKey, item, evaluation, { field: 'Completo', message: 'Sin gaps minimosdetectados', action: 'Mantener actualizado', severity: 'complete' }));
      } else {
        for (const gap of missing) rows.push(this.makeGapRow(layerKey, item, evaluation, gap));
      }
    };

    const appById = new Map((data.application || []).map(item => [item.id, item]));
    const ifaceById = new Map((data.interface || []).map(item => [item.id, item]));

    for (const item of data.estrategicos || []) addEvaluation('estrategicos', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion ejecutiva'),
      fieldRule(item, 'externalId', 'ID externo', 'Completar IDExterno/codigo'),
      fieldRule(item, 'priorityLevel', 'Nivel de prioridad', 'Definir prioridad del objetivo'),
      fieldRule(item, 'kpi', 'KPI', 'Registrar KPI/medida de exito'),
      relationRule((data.tacticos || []).some(child => child.parentId === item.id), 'Objetivos tacticos', 'No tiene objetivos tacticos hijos', 'Relacionar al menos un objetivo tactico'),
      relationRule((item.capIds || []).length > 0 || (data.iniciativas || []).length > 0, 'Bajada estrategica', 'No tiene capacidades o iniciativas asociadas', 'Relacionar iniciativa/capacidad que materialice el objetivo'),
    ]);

    for (const item of data.tacticos || []) addEvaluation('tacticos', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion del objetivo tactico'),
      fieldRule(item, 'externalId', 'ID externo', 'Completar IDExterno/codigo'),
      fieldRule(item, 'kpi', 'KPI', 'Registrar KPI/medida de exito'),
      relationRule(hasValue(item.parentId), 'Objetivo padre', 'Falta objetivo estrategico padre', 'Relacionar con objetivo estrategico'),
      relationRule((data.iniciativas || []).some(child => child.parentObjId === item.id), 'Iniciativas', 'No tiene iniciativas relacionadas', 'Relacionar iniciativa de ejecucion'),
      relationRule((item.capIds || []).length > 0, 'Capacidades', 'No tiene capacidades relacionadas', 'Relacionar capacidades impactadas', 'medium', 1),
    ]);

    for (const item of data.iniciativas || []) addEvaluation('iniciativas', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion de la iniciativa'),
      fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
      fieldRule(item, 'category', 'Categoria', 'Clasificar la iniciativa'),
      fieldRule(item, 'Prioridad', 'Prioridad', 'Definir prioridad'),
      phaseRule(item, 'Lifecycle', 'Completar lifecycle/plan'),
      relationRule(hasValue(item.parentObjId), 'Objetivo tactico', 'Falta objetivo tactico relacionado', 'Relacionar con objetivo tactico'),
      relationRule((item.capIds || []).length > 0, 'Capacidades', 'No tiene capacidades relacionadas', 'Relacionar capacidades habilitadas'),
    ]);

    for (const item of data.capability || []) addEvaluation('capability', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion de la capacidad'),
      fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
      fieldRule(item, 'lxEnterpriseDomain', 'Dominio enterprise', 'Asignar dominio enterprise'),
      fieldRule(item, 'currentMaturity', 'Madurez actual', 'Registrar madurez actual'),
      fieldRule(item, 'strategicImportance', 'Importancia estrategica', 'Definir importancia estrategica'),
      relationRule((item.appIds || []).some(id => appById.has(id)), 'Aplicaciones', 'No tiene aplicaciones relacionadas en el alcance', 'Relacionar aplicaciones que soportan la capacidad'),
      relationRule((data.process || []).some(proc => (proc.capIds || []).includes(item.id)), 'Procesos', 'No tiene procesos relacionados', 'Relacionar procesos de negocio'),
    ]);

    for (const item of data.process || []) addEvaluation('process', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion del proceso'),
      fieldRule(item, 'category', 'Categoria', 'Clasificar proceso'),
      { ok: hasValue(item.signavioProcessId) || hasValue(item.code), field: 'ID proceso', message: 'Falta ID Signavio o codigo externo', action: 'Completar signavioProcessId o externalId', severity: 'critical', weight: 2 },
      fieldRule(item, 'Entrada', 'Entrada', 'Documentar entradas del proceso'),
      fieldRule(item, 'Salida', 'Salida', 'Documentar salidas del proceso'),
      fieldRule(item, 'Objetivo', 'Objetivo', 'Documentar objetivo del proceso'),
      relationRule((item.capIds || []).length > 0, 'Capacidades', 'No tiene capacidades relacionadas', 'Relacionar capacidades que ejecuta/habilita'),
      relationRule((item.appIds || []).some(id => appById.has(id)), 'Aplicaciones', 'No tiene aplicaciones relacionadas en el alcance', 'Relacionar aplicaciones que soportan el proceso'),
    ]);

    for (const item of data.application || []) {
      const summaries = data.dependencySummaries || [];
      const countFor = kind => summaries.find(summary => summary.kind === kind && summary.appId === item.id)?.count || 0;
      addEvaluation('application', item, [
        ...baseRules(item),
        fieldRule(item, 'description', 'Descripcion', 'Completar descripcion de la aplicacion'),
        fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
        phaseRule(item, 'Lifecycle activo', 'Completar lifecycle de la aplicacion', 'critical', 2),
        fieldRule(item, 'technicalSuitability', 'Technical suitability', 'Evaluar technical suitability'),
        fieldRule(item, 'TipoDeArquitectura', 'Tipo de arquitectura', 'Completar tipo de arquitectura'),
        fieldRule(item, 'TipoDeAutenticacion', 'Tipo de autenticacion', 'Completar tipo de autenticacion'),
        fieldRule(item, 'lxHostingType', 'Hosting', 'Completar tipo de hosting'),
        fieldRule(item, 'TipoAplicacion', 'Tipo de aplicacion', 'Completar tipo de aplicacion'),
        fieldRule(item, 'criticidadDeDatos', 'Criticidad de datos', 'Completar criticidad de datos', 'critical', 2),
        fieldRule(item, 'Confidencialidad', 'Confidencialidad', 'Completar clasificacion de confidencialidad'),
        fieldRule(item, 'Integridad', 'Integridad', 'Completar clasificacion de integridad'),
        fieldRule(item, 'Disponibilidad', 'Disponibilidad', 'Completar clasificacion de disponibilidad'),
        fieldRule(item, 'RecoveryTimeObjective', 'RTO', 'Completar Recovery Time Objective'),
        fieldRule(item, 'ComplianceStandard', 'Compliance', 'Completar compliance standard'),
        relationRule((item.orgNames || []).length > 0, 'Organizacion', 'Falta organizacion responsable', 'Relacionar aplicacion con organizacion/dominio responsable'),
        relationRule(countFor('interface') > 0, 'Interfaces', 'No tiene interfaces relacionadas', 'Relacionar interfaces proveedoras/consumidoras', 'medium', 1),
        relationRule(countFor('itcomponent') > 0, 'Componentes TI', 'No tiene componentes TI relacionados', 'Relacionar componentes/plataformas tecnicas'),
        relationRule(countFor('dataobject') > 0, 'Objetos de datos', 'No tiene objetos de datos relacionados', 'Relacionar objetos de datos usados/producidos'),
      ]);
    }

    for (const item of data.interface || []) addEvaluation('interface', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion de la interface'),
      fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
      fieldRule(item, 'category', 'Categoria', 'Clasificar interface'),
      fieldRule(item, 'Criticidad', 'Criticidad', 'Completar criticidad de la interface', 'critical', 2),
      relationRule((item.appIds || []).filter(id => appById.has(id)).length >= 2, 'Aplicaciones', 'Falta app proveedora o consumidora en el alcance', 'Relacionar aplicacion proveedora y consumidora'),
      relationRule((item.doIds || []).length > 0 || (data.dataobject || []).some(obj => (obj.ifaceIds || []).includes(item.id)), 'Objetos de datos', 'No tiene objetos de datos relacionados', 'Relacionar payload/objeto de datos'),
    ]);

    for (const item of data.itcomponent || []) addEvaluation('itcomponent', item, [
      ...baseRules(item),
      fieldRule(item, 'category', 'Categoria', 'Clasificar componente TI'),
      fieldRule(item, 'enviroment', 'Ambiente', 'Completar ambiente'),
      fieldRule(item, 'Dominio', 'Dominio', 'Completar dominio tecnico'),
      fieldRule(item, 'Funcion', 'Funcion', 'Completar funcion del componente'),
      fieldRule(item, 'Criticidad', 'Criticidad', 'Completar criticidad del componente', 'critical', 2),
      relationRule((data.application || []).some(app => (app.itIds || []).includes(item.id)), 'Aplicaciones', 'No esta relacionado a una aplicacion del alcance', 'Relacionar componente con aplicacion'),
      fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
    ]);

    for (const item of data.dataobject || []) addEvaluation('dataobject', item, [
      ...baseRules(item),
      fieldRule(item, 'description', 'Descripcion', 'Completar descripcion del objeto de datos'),
      fieldRule(item, 'code', 'Codigo externo', 'Completar externalId/codigo'),
      fieldRule(item, 'Confidencialidad', 'Confidencialidad', 'Completar clasificacion de confidencialidad', 'critical', 2),
      fieldRule(item, 'Criticidad', 'Criticidad', 'Completar criticidad del objeto de datos', 'critical', 2),
      relationRule((item.appIds || []).some(id => appById.has(id)) || (data.application || []).some(app => (app.doIds || []).includes(item.id)), 'Aplicaciones', 'No tiene aplicacion relacionada en el alcance', 'Relacionar objeto de datos con aplicaciones'),
      relationRule((item.ifaceIds || []).some(id => ifaceById.has(id)) || (data.interface || []).some(iface => (iface.doIds || []).includes(item.id)), 'Interfaces', 'No tiene interface relacionada', 'Relacionar objeto de datos con interfaces/payload', 'medium', 1),
      relationRule((item.iniciativaIds || []).length > 0, 'Iniciativas', 'No tiene iniciativa relacionada', 'Relacionar objeto de datos con iniciativa', 'medium', 1),
    ]);

    return summarize();

  }

  makeGapRow(layerKey, item, evaluation, gap) {
    const layer = LAYERS.find(l => l.key === layerKey);
    const severityLabel = gap.severity === 'critical' ? 'Critica' : gap.severity === 'complete' ? 'Completa' : 'Media';
    const statusLabel = evaluation.status === 'critical' ? 'Critico' : evaluation.status === 'warning' ? 'Con gaps' : 'Completo';
    return {
      layerKey,
      layerLabel: layer?.label || layerKey,
      id: item.id,
      name: item.name || item.fullName || '',
      code: item.code || '',
      score: evaluation.score,
      status: evaluation.status,
      statusLabel,
      severity: gap.severity,
      severityLabel,
      field: gap.field,
      message: gap.message,
      action: gap.action,
    };
  }

  getDisplayData() {
    const text = this.searchText.trim().toLowerCase();
    const tag = this.selectedTag;
    const relatedIds = this.showOnlyOrphans
      ? new Set(this.relations.flatMap(rel => [rel.from, rel.to]))
      : null;
    const orphanOk = item => !relatedIds || !relatedIds.has(item.id);
    const matches = item => {
      const haystack = `${item.name || ''} ${item.fullName || ''} ${item.code || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      const textOk = !text || haystack.includes(text);
      const tagOk = !tag || (item.tags || []).some(t => t.toLowerCase() === tag.toLowerCase());
      return textOk && tagOk && orphanOk(item);
    };

    if (!text && !tag && !this.showOnlyOrphans) return this.data;
    const filtered = Object.fromEntries(Object.entries(this.data).map(([key, items]) => {
      if (!Array.isArray(items)) return [key, items];
      if (key === 'dependencySummaries') {
        return [key, items
          .map(summary => ({ ...summary, items: summary.items.filter(matches), count: summary.items.filter(matches).length }))
          .filter(summary => summary.count > 0 || (!text && !tag))];
      }
      return [key, items.filter(matches)];
    }));
    return filtered;
  }

  render() {
    const emp = this.selectedEmpresa;
    const vp = this.selectedVP;
    const displayData = this.getDisplayData();
    const kpis = LAYERS.map(l => ({ ...l, count: displayData[l.key]?.length || 0 }));
    const total = kpis.reduce((sum, k) => sum + k.count, 0);

    this.container.innerHTML = `
      <div class="smap">
        <header class="smap-topbar">
          <span class="smap-entity-count">VisiÃ³n completa de las ${total} entidades de LeanIX</span>
          <div class="smap-actions">
            <button class="smap-action" id="smapExportGaps" title="Exportar gaps a Excel">Gaps Excel</button>
            <button class="smap-action" id="smapExportPDF" title="Exportar PDF">PDF</button>
            <button class="smap-icon-action" title="MÃ¡s opciones">â‹¯</button>
          </div>
        </header>

        <section class="smap-toolbar" aria-label="Controles del mapa">
          <div class="smap-chip-row">
            <button class="smap-filter-pill">â–½ Filtros activos</button>
            ${this.selectedTag ? `<button class="smap-tag-pill">Tag: ${escapeHtml(this.selectedTag)} <span>Ã—</span></button>` : ''}
            <button class="smap-reset" id="smapResetFilters">Ã— Resetear</button>
          </div>
          <div class="smap-view-controls">
            <label>Vista:
              <select class="smap-mini-select" disabled><option>Relacional</option></select>
            </label>
            <label>Nivel:
              <select class="smap-mini-select" disabled><option>Todo</option></select>
            </label>
            <div class="smap-zoom">
              <button class="smap-icon-action" id="smapZoomOut">âˆ’</button>
              <span>${this.zoom}%</span>
              <button class="smap-icon-action" id="smapZoomIn">+</button>
            </div>
          </div>
        </section>

        <section class="smap-kpi-strip">
          ${this.renderKpis(kpis)}
        </section>

        <main class="smap-workspace">
          <section class="smap-map-panel">
            <div class="smap-canvas" id="smapCanvas">
              <svg class="smap-svg" id="smapSvg"></svg>
              <div class="smap-layers" id="smapLayers" style="transform:scale(${this.zoom / 100});">
                ${this.renderRootCard(emp, vp)}
                ${LAYERS.map(layer => this.renderLayer(layer, displayData)).join('')}
              </div>
            </div>
            ${this.renderLegend()}
          </section>
          <aside class="smap-side">
            ${this.renderFilters()}
            ${this.renderOverview(kpis, total)}
            ${this.renderQuickNav()}
          </aside>
        </main>

        ${this.data.estrategicos?.length === 0 && this.data.tacticos?.length === 0 ? `
        <div class="smap-empty">
          <p>No hay datos vinculados a esta VP.</p>
          <p>Vincula objetivos estratÃ©gicos y tÃ¡cticos con Business Capabilities en LeanIX para ver el mapa.</p>
        </div>` : ''}
      </div>`;

    requestAnimationFrame(() => this.drawLines());
  }

  renderKpis(kpis) {
    return [
      { label: 'Entidades LeanIX', count: kpis.reduce((sum, k) => sum + k.count, 0), color: '#be123c' },
      ...kpis,
    ].map(k => `<article class="smap-kpi-card">
      <strong style="color:${k.color}">${k.count}</strong>
      <span>${escapeHtml(k.shortLabel || k.label)}</span>
    </article>`).join('');
  }

  renderRootCard(emp, vp) {
    if (!emp) return '';
    const layer = LAYERS[0];
    return `<div class="smap-root-row">
      <div class="smap-row-label smap-row-label--root" style="--layer-color:${layer.color}">
        <span class="smap-row-icon">${layer.icon}</span>
        <span>1 Objetivo EstratÃ©gico</span>
      </div>
      <div class="smap-root-card smap-card" data-id="${emp.id}" data-layer="estrategicos" style="--card-color:${layer.color};--card-bg:${layer.bg}">
        <div class="smap-card-icon">${layer.icon}</div>
        <div class="smap-card-body">
          <div class="smap-card-name">${escapeHtml(vp?.name || emp.name)}</div>
          <div class="smap-card-code">${escapeHtml(vp?.code || 'OBJ-VP-COM-001')}</div>
        </div>
      </div>
    </div>`;
  }

  renderLayer(layer, sourceData = this.data) {
    const items = sourceData[layer.key] || [];
    if (layer.key === 'interface') return this.renderDependencyLayer(sourceData);
    if (layer.key === 'itcomponent') return '';
    if (layer.key === 'dataobject') return '';
    if (items.length === 0) return '';

    return `<div class="smap-layer" data-layer="${layer.key}">
      <div class="smap-row-label" style="--layer-color:${layer.color}">
        <span class="smap-row-icon">${layer.icon}</span>
        <span>${items.length} ${escapeHtml(layer.shortLabel).toUpperCase()}</span>
      </div>
      <div class="smap-layer-cards">
        ${items.map(item => this.renderCard(item, layer)).join('')}
      </div>
    </div>`;
  }

  renderDependencyLayer(sourceData = this.data) {
    const interfaceLayer = LAYERS.find(l => l.key === 'interface');
    const componentLayer = LAYERS.find(l => l.key === 'itcomponent');
    const dataLayer = LAYERS.find(l => l.key === 'dataobject');
    const summaries = sourceData.dependencySummaries || [];
    const interfaceSummaries = summaries.filter(summary => summary.kind === 'interface');
    const componentSummaries = summaries.filter(summary => summary.kind === 'itcomponent');
    const dataSummaries = summaries.filter(summary => summary.kind === 'dataobject');
    if (interfaceSummaries.length === 0 && componentSummaries.length === 0 && dataSummaries.length === 0) return '';

    return `<div class="smap-layer smap-layer--dependencies" data-layer="dependencies">
      <div class="smap-row-label smap-row-label--stacked">
        <div style="--layer-color:${interfaceLayer.color}">
          <span class="smap-row-icon">${interfaceLayer.icon}</span>
          <span>${(sourceData.interface || []).length} ${escapeHtml(interfaceLayer.shortLabel).toUpperCase()}</span>
        </div>
        <div style="--layer-color:${componentLayer.color}">
          <span class="smap-row-icon">${componentLayer.icon}</span>
          <span>${(sourceData.itcomponent || []).length} ${escapeHtml(componentLayer.shortLabel).toUpperCase()}</span>
        </div>
        <div style="--layer-color:${dataLayer.color}">
          <span class="smap-row-icon">${dataLayer.icon}</span>
          <span>${(sourceData.dataobject || []).length} ${escapeHtml(dataLayer.shortLabel).toUpperCase()}</span>
        </div>
      </div>
      <div class="smap-dependency-grid">
        <section class="smap-dependency-column" style="--column-color:${interfaceLayer.color}">
          <div class="smap-dependency-heading">${interfaceLayer.label}</div>
          <div class="smap-dependency-cards">
            ${interfaceSummaries.map(summary => this.renderSummaryCard(summary, interfaceLayer)).join('')}
          </div>
        </section>
        <section class="smap-dependency-column" style="--column-color:${componentLayer.color}">
          <div class="smap-dependency-heading">${componentLayer.label}</div>
          <div class="smap-dependency-cards">
            ${componentSummaries.map(summary => this.renderSummaryCard(summary, componentLayer)).join('')}
          </div>
        </section>
        <section class="smap-dependency-column smap-dependency-column--data" style="--column-color:${dataLayer.color}">
          <div class="smap-dependency-heading">${dataLayer.label}</div>
          <div class="smap-dependency-cards smap-dependency-cards--data">
            ${dataSummaries.map(summary => this.renderSummaryCard(summary, dataLayer)).join('')}
          </div>
        </section>
      </div>
    </div>`;
  }

  renderAggregateCard(layer, items) {
    return `<div class="smap-aggregate-card smap-card" data-layer="${layer.key}" style="--card-color:${layer.color};--card-bg:${layer.bg}">
      <div class="smap-card-icon">${layer.icon}</div>
      <div class="smap-card-body">
        <div class="smap-card-name">${items.length} ${escapeHtml(layer.label)}</div>
        <div class="smap-card-code">Ver detalle</div>
      </div>
    </div>`;
  }

  renderSummaryCard(summary, layer) {
    const noun = {
      interface: ['interfaz', 'interfaces'],
      itcomponent: ['componente TI', 'componentes TI'],
      dataobject: ['objeto de datos', 'objetos de datos'],
    }[summary.kind] || ['elemento', 'elementos'];
    const label = `${summary.count} ${summary.count === 1 ? noun[0] : noun[1]}`;
    return `<div class="smap-card smap-summary-card" data-id="${summary.id}" data-layer="${summary.kind}" style="--card-color:${layer.color};--card-bg:${layer.bg}">
      <div class="smap-card-icon">${layer.icon}</div>
      <div class="smap-card-body">
        <div class="smap-card-name">${escapeHtml(label)}</div>
        <div class="smap-card-meta">
          <span>${escapeHtml(summary.appName)}</span>
          <b>Ver detalle</b>
        </div>
      </div>
    </div>`;
  }

  renderCard(item, layer) {
    const name = item.name || '';
    const code = item.code || '';
    const tag = (item.tags || []).find(t => TAG_FILTERS.includes(t)) || '';
    const orgLabel = layer.key === 'application'
      ? `Org: ${item.orgNames?.length ? item.orgNames[0] : 'Sin organizaciÃ³n'}`
      : '';
    const gap = this.gapReport?.evaluations?.get(`${layer.key}:${item.id}`);
    return `<div class="smap-card" data-id="${item.id}" data-layer="${layer.key}" style="--card-color:${layer.color};--card-bg:${layer.bg}">
      <div class="smap-card-icon">${layer.icon}</div>
      <div class="smap-card-body">
        <div class="smap-card-name">${escapeHtml(name)}</div>
        ${gap ? `<div class="smap-gap-badge smap-gap-badge--${gap.status}">${gap.score}% Â· ${gap.status === 'complete' ? 'Completo' : `${gap.missing.length} gaps`}</div>` : ''}
        ${orgLabel ? `<div class="smap-org-badge" title="OrganizaciÃ³n">${escapeHtml(orgLabel)}</div>` : ''}
        <div class="smap-card-meta">
          ${code ? `<span>${escapeHtml(code)}</span>` : '<span>Sin cÃ³digo</span>'}
          ${tag ? `<b>${escapeHtml(tag)}</b>` : ''}
        </div>
      </div>
    </div>`;
  }

  renderFilters() {
    const emp = this.selectedEmpresa;
    const vp = this.selectedVP;
    return `<section class="smap-side-card">
      <div class="smap-side-title"><span>â–½</span> Filtros <button id="smapClearAll">Limpiar todo</button></div>
      <label>Tag
        <select id="smapTagFilter" class="smap-field">
          <option value="">Todos</option>
          ${TAG_FILTERS.map(t => `<option value="${t}" ${this.selectedTag === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Empresa
        <select id="smapFilterEmpresa" class="smap-field">
          ${this.empresas.map(e => `<option value="${e.id}" ${e.id === emp?.id ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('')}
          ${this.empresas.length === 0 ? '<option value="">Sin empresa configurada</option>' : ''}
        </select>
      </label>
      <label>Vicepresidencia
        <select id="smapFilterVP" class="smap-field">
          ${this.vps.map(v => `<option value="${v.id}" ${v.id === vp?.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
          ${this.vps.length === 0 ? '<option value="">Sin VP</option>' : ''}
        </select>
      </label>
      ${['Estado', 'Departamento', 'Rol', 'Proveedor', 'Ambiente', 'Criticidad', 'Dominio'].map(label => `<label>${label}<select class="smap-field" disabled><option>Todos</option></select></label>`).join('')}
      <label>BÃºsqueda por texto
        <input id="smapSearch" class="smap-field" value="${escapeHtml(this.searchText)}" placeholder="Buscar en el mapa..." />
      </label>
    </section>`;
  }

  renderOverview(kpis, total) {
    const segments = kpis.map((k, index) => {
      const start = kpis.slice(0, index).reduce((sum, item) => sum + item.count, 0);
      const startDeg = total ? (start / total) * 360 : 0;
      const endDeg = total ? ((start + k.count) / total) * 360 : 0;
      return `${k.color} ${startDeg}deg ${endDeg}deg`;
    }).join(', ');

    return `<section class="smap-side-card">
      <div class="smap-side-title">Vista general</div>
      <div class="smap-overview">
        <div class="smap-donut" style="background:conic-gradient(${segments || '#e2e8f0 0deg 360deg'});"><span>${total}<small>Total</small></span></div>
        <div class="smap-overview-list">
          ${kpis.map(k => `<div><i style="background:${k.color}"></i><span>${escapeHtml(k.label)}</span><b>${k.count}</b></div>`).join('')}
        </div>
      </div>
    </section>`;
  }

  renderQuickNav() {
    return `<section class="smap-side-card">
      <div class="smap-side-title">NavegaciÃ³n rÃ¡pida</div>
      <button class="smap-side-button" id="smapHideOrphans">${this.showOnlyOrphans ? 'Ver todos los elementos' : 'Ver solo elementos sin relaciones'}</button>
      <button class="smap-side-button" id="smapScrollTop">Ver mapa en modo jerÃ¡rquico</button>
      <p class="smap-tip">Consejo: usa los filtros para explorar en detalle. Haz clic en cualquier tarjeta para ver su ficha informativa.</p>
    </section>`;
  }

  renderLegend() {
    const unique = [...new Map(LAYERS.map(layer => [layer.relation, layer])).values()];
    return `<footer class="smap-legend">
      ${unique.map(layer => `<span><i style="background:${layer.color}"></i>${escapeHtml(layer.relation)}</span>`).join('')}
      <button title="Leyenda">Legend â“˜</button>
    </footer>`;
  }

  formatDescription(desc) {
    const parts = desc.split(/\n+/).filter(p => p.trim());
    return parts.map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('MisiÃ³n:')) return `<span class="smap-desc-tag smap-desc-mision">MisiÃ³n</span><span class="smap-desc-text">${escapeHtml(trimmed.replace('MisiÃ³n:', '').trim())}</span>`;
      if (trimmed.startsWith('VisiÃ³n:')) return `<span class="smap-desc-tag smap-desc-vision">VisiÃ³n</span><span class="smap-desc-text">${escapeHtml(trimmed.replace('VisiÃ³n:', '').trim())}</span>`;
      return `<span class="smap-desc-text">${escapeHtml(trimmed)}</span>`;
    }).join('');
  }

  formatPrinciples(text) {
    const items = text.split(/[â€¢\n]+/).filter(p => p.trim());
    return items.map(item => {
      const parts = item.split('|');
      const name = parts[0]?.trim() || '';
      const category = parts[1]?.split(':')[0]?.trim() || '';
      if (!name) return '';
      return `<div class="smap-principle-chip">${category ? `<span class="smap-principle-cat">${escapeHtml(category)}</span>` : ''}${escapeHtml(name)}</div>`;
    }).join('');
  }

  drawLines() {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;

    svg.setAttribute('width', canvas.scrollWidth);
    svg.setAttribute('height', canvas.scrollHeight);
    svg.innerHTML = '';

    const canvasRect = canvas.getBoundingClientRect();
    for (const rel of this.relations) {
      const fromEl = canvas.querySelector(`[data-id="${rel.from}"]`);
      const toEl = canvas.querySelector(`[data-id="${rel.to}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left + canvas.scrollLeft;
      const y1 = fromRect.bottom - canvasRect.top + canvas.scrollTop;
      const x2 = toRect.left + toRect.width / 2 - canvasRect.left + canvas.scrollLeft;
      const isDependencySummary = String(rel.to).startsWith('summary:');
      const y2 = toRect.top - canvasRect.top + canvas.scrollTop + (isDependencySummary ? -5 : 0);
      const layerDef = LAYERS.find(l => l.key === (isDependencySummary ? rel.toLayer : rel.fromLayer));
      const color = layerDef?.color || '#94a3b8';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (y1 + y2) / 2;
      const pathD = isDependencySummary
        ? `M ${x1} ${y1} C ${x1} ${y1 + 14}, ${x2} ${y2 - 14}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      path.setAttribute('d', pathD);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', isDependencySummary ? '2.2' : '1.4');
      path.setAttribute('stroke-opacity', isDependencySummary ? '0.62' : '0.36');
      path.setAttribute('stroke-dasharray', isDependencySummary ? '5 4' : '');
      path.setAttribute('data-from', rel.from);
      path.setAttribute('data-to', rel.to);
      path.setAttribute('data-dependency', isDependencySummary ? 'true' : 'false');
      svg.appendChild(path);

      if (isDependencySummary) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x2);
        dot.setAttribute('cy', y2);
        dot.setAttribute('r', '3.3');
        dot.setAttribute('fill', '#ffffff');
        dot.setAttribute('stroke', color);
        dot.setAttribute('stroke-width', '2');
        dot.setAttribute('data-from', rel.from);
        dot.setAttribute('data-to', rel.to);
        svg.appendChild(dot);
      }
    }
  }

  bindEvents() {
    const empSelect = this.container.querySelector('#smapFilterEmpresa');
    if (empSelect) {
      empSelect.addEventListener('change', () => {
        this.selectedEmpresa = this.empresas.find(e => e.id === empSelect.value) || null;
        this.vps = this.selectedEmpresa ? this.objectives.filter(o => o.tipo === 'Objetivo_VP' && o.parentId === this.selectedEmpresa.id) : [];
        this.selectedVP = this.vps[0] || null;
        this.filterAndRender();
      });
    }

    const vpSelect = this.container.querySelector('#smapFilterVP');
    if (vpSelect) {
      vpSelect.addEventListener('change', () => {
        this.selectedVP = this.vps.find(v => v.id === vpSelect.value) || null;
        this.filterAndRender();
      });
    }

    const tagSelect = this.container.querySelector('#smapTagFilter');
    if (tagSelect) tagSelect.addEventListener('change', () => { this.selectedTag = tagSelect.value; this.render(); this.bindEvents(); });

    const search = this.container.querySelector('#smapSearch');
    if (search) search.addEventListener('input', () => { this.searchText = search.value; this.render(); this.bindEvents(); });

    this.container.querySelector('#smapResetFilters')?.addEventListener('click', () => { this.searchText = ''; this.selectedTag = ''; this.showOnlyOrphans = false; this.render(); this.bindEvents(); });
    this.container.querySelector('#smapClearAll')?.addEventListener('click', () => { this.searchText = ''; this.selectedTag = ''; this.showOnlyOrphans = false; this.render(); this.bindEvents(); });
    this.container.querySelector('#smapZoomOut')?.addEventListener('click', () => { this.zoom = Math.max(70, this.zoom - 10); this.render(); this.bindEvents(); });
    this.container.querySelector('#smapZoomIn')?.addEventListener('click', () => { this.zoom = Math.min(130, this.zoom + 10); this.render(); this.bindEvents(); });
    this.container.querySelector('#smapHideOrphans')?.addEventListener('click', () => { this.showOnlyOrphans = !this.showOnlyOrphans; this.render(); this.bindEvents(); });
    this.container.querySelector('#smapScrollTop')?.addEventListener('click', () => this.container.querySelector('#smapCanvas')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' }));

    const pdfBtn = this.container.querySelector('#smapExportPDF');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', async () => {
        const originalText = pdfBtn.textContent;
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'Generando...';
        try {
          await exportPDF(this.data, this.selectedVP, this.selectedVP?.orgName ? getShortName(this.selectedVP.orgName) : 'Alicorp', this.container.querySelector('.smap'));
        } finally {
          pdfBtn.disabled = false;
          pdfBtn.textContent = originalText;
        }
      });
    }
    const gapsBtn = this.container.querySelector('#smapExportGaps');
    if (gapsBtn) {
      gapsBtn.addEventListener('click', () => {
        exportGapsExcel(this.gapReport, this.selectedVP, this.selectedVP?.orgName ? getShortName(this.selectedVP.orgName) : 'Alicorp');
      });
    }

    const canvas = this.container.querySelector('#smapCanvas');
    if (!canvas) return;
    canvas.addEventListener('mouseenter', e => {
      const card = e.target.closest('.smap-card[data-id]');
      if (card) this.highlightRelations(card.dataset.id);
    }, true);
    canvas.addEventListener('mouseleave', e => {
      const card = e.target.closest('.smap-card[data-id]');
      if (card) this.clearHighlight();
    }, true);
    canvas.addEventListener('click', e => {
      const card = e.target.closest('.smap-card[data-id]');
      if (card) this.openDetailPanel(card.dataset.id, card.dataset.layer);
    });
    canvas.addEventListener('scroll', () => this.drawLines());
    if (this.boundResize) window.removeEventListener('resize', this.boundResize);
    this.boundResize = () => this.drawLines();
    window.addEventListener('resize', this.boundResize);
  }

  openDetailPanel(id, layer) {
    const typeMap = { estrategicos: 'Objective', tacticos: 'Objective', iniciativas: 'Initiative', capability: 'BusinessCapability', process: 'BusinessContext', application: 'Application', interface: 'Interface', dataobject: 'DataObject', itcomponent: 'ITComponent' };
    const type = typeMap[layer] || 'Objective';
    const layerDef = LAYERS.find(l => l.key === layer);
    let item = null;
    let isSummary = false;

    if (id?.startsWith('summary:')) {
      item = (this.data.dependencySummaries || []).find(summary => summary.id === id);
      isSummary = true;
    } else if (layer === 'estrategicos' || layer === 'tacticos') item = this.objectives.find(o => o.id === id);
    else if (layer === 'iniciativas') item = this.allIniciativas.find(i => i.id === id);
    else if (layer === 'process') item = this.allProcesses.find(p => p.id === id);
    else if (layer === 'interface') item = this.allInterfaces.find(i => i.id === id);
    else item = (this.data[layer] || []).find(i => i.id === id);
    if (!item) return;

    this.container.querySelector('.smap-aside')?.remove();
    const panel = document.createElement('div');
    panel.className = 'smap-aside';
    panel.innerHTML = `
      <div class="smap-aside-header" style="border-color:${layerDef?.color || '#e2e8f0'}">
        <div class="smap-aside-icon" style="background:${layerDef?.color || '#64748b'}">${layerDef?.icon || 'â—Ž'}</div>
        <div class="smap-aside-title">
          <div class="smap-aside-name">${escapeHtml(item.name || item.fullName || '')}</div>
          <div class="smap-aside-type">${escapeHtml(layerDef?.label || type)}</div>
        </div>
        <button class="smap-aside-close">Ã—</button>
      </div>
      <div class="smap-aside-body">${this.renderDetailBody(item, layer, layerDef)}</div>
      <div class="smap-aside-footer">
        <a class="smap-aside-link" href="https://br.leanix.net/AlicorpSAASandbox/factsheet/${type}/${id}" target="_top">Ver en LeanIX â†’</a>
      </div>
    `;
    if (isSummary) {
      panel.querySelector('.smap-aside-footer')?.remove();
    }

    this.container.querySelector('.smap').appendChild(panel);
    panel.querySelector('.smap-aside-close').addEventListener('click', () => panel.remove());
  }

  renderDetailBody(item, layer, layerDef) {
    const field = (label, value) => value ? `<div class="smap-aside-field"><span class="smap-aside-label">${label}</span><span class="smap-aside-value">${escapeHtml(String(value))}</span></div>` : '';
    const fieldHtml = (label, html) => `<div class="smap-aside-field"><span class="smap-aside-label">${label}</span><div class="smap-aside-value">${html}</div></div>`;
    const chips = (items, color) => items.length ? items.map(n => `<span class="smap-aside-chip" style="--chip-color:${color || '#64748b'}">${escapeHtml(n)}</span>`).join('') : null;
    const stateLabel = s => ({ ACTIVE: 'Activo', BROKEN_QUALITY_SEAL: 'Calidad incompleta', DRAFT: 'Borrador', ARCHIVED: 'Archivado' }[s] || s);
    const completionBar = pct => {
      const p = Math.round((pct || 0) * 100);
      const color = p >= 75 ? '#16a34a' : p >= 40 ? '#d97706' : '#dc2626';
      return `<div class="smap-aside-progress"><div class="smap-aside-progress-track"><div class="smap-aside-progress-fill" style="width:${p}%;background:${color}"></div></div><span>${p}%</span></div>`;
    };
    const breadcrumb = fullName => `<div class="smap-aside-breadcrumb">${fullName.split(' / ').map(p => escapeHtml(p)).join('<span class="smap-aside-sep"> / </span>')}</div>`;
    const gapBlock = () => {
      const gap = this.gapReport?.evaluations?.get(`${layer}:${item.id}`);
      if (!gap) return '';
      const title = gap.status === 'complete' ? 'Completitud mÃ­nima cerrada' : `${gap.missing.length} gaps minimos`;
      return `<div class="smap-gap-detail smap-gap-detail--${gap.status}">
        <div class="smap-gap-detail-head"><strong>${gap.score}%</strong><span>${title}</span></div>
        ${gap.missing.length ? `<ul>${gap.missing.map(missing => `<li><b>${escapeHtml(missing.field)}:</b> ${escapeHtml(missing.message)} <em>${escapeHtml(missing.action)}</em></li>`).join('')}</ul>` : '<p>No se detectaron faltantes minimos para este objeto.</p>'}
      </div>`;
    };

    if (item.items) {
      return [
        field('AplicaciÃ³n', item.appName),
        field('Total', item.count),
        `<div class="smap-aside-list">
          ${item.items.map(child => `<button class="smap-aside-list-item" data-id="${child.id}">
            <strong>${escapeHtml(child.name || '')}</strong>
            <span>${escapeHtml(child.code || 'Sin cÃ³digo')}</span>
          </button>`).join('')}
        </div>`,
      ].join('');
    }

    if (layer === 'estrategicos' || layer === 'tacticos') {
      return [
        gapBlock(),
        item.fullName ? fieldHtml('JerarquÃ­a', breadcrumb(item.fullName)) : '',
        item.lxState ? field('Estado', stateLabel(item.lxState)) : '',
        item.completion != null ? fieldHtml('Completitud', completionBar(item.completion)) : '',
        item.orgName ? field('OrganizaciÃ³n', item.orgName) : '',
        item.description ? field('DescripciÃ³n', item.description) : '',
        item.principio ? field('Principio', item.principio) : '',
        item.tags?.length ? fieldHtml('Tags', chips(item.tags, layerDef?.color)) : '',
        item.capNames?.length ? fieldHtml('Capacidades vinculadas', chips(item.capNames, '#003056')) : '',
        item.iniciativaNames?.length ? fieldHtml('Iniciativas vinculadas', chips(item.iniciativaNames, '#00867C')) : '',
      ].join('');
    }

    return [
      gapBlock(),
      item.code ? field('CÃ³digo', item.code) : '',
      item.orgNames?.length ? fieldHtml('Organizaciones', chips(item.orgNames, '#0f766e')) : '',
      item.orgNames && item.orgNames.length === 0 ? field('OrganizaciÃ³n', 'Sin organizaciÃ³n relacionada') : '',
      item.description ? field('DescripciÃ³n', item.description) : '',
      item.tags?.length ? fieldHtml('Tags', chips(item.tags, layerDef?.color)) : '',
    ].join('');
  }

  highlightRelations(nodeId) {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;

    const connected = new Set([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const rel of this.relations) {
        if (connected.has(rel.from) && !connected.has(rel.to)) { connected.add(rel.to); changed = true; }
        if (connected.has(rel.to) && !connected.has(rel.from)) { connected.add(rel.from); changed = true; }
      }
    }

    canvas.querySelectorAll('.smap-card[data-id]').forEach(card => {
      card.classList.toggle('smap-card--dim', !connected.has(card.dataset.id));
      card.classList.toggle('smap-card--highlight', connected.has(card.dataset.id));
    });
    svg.querySelectorAll('path').forEach(path => {
      const isConn = connected.has(path.dataset.from) && connected.has(path.dataset.to);
      path.setAttribute('stroke-opacity', isConn ? '0.9' : '0.05');
      path.setAttribute('stroke-width', isConn ? (path.dataset.dependency === 'true' ? '3' : '2.4') : '1');
    });
    svg.querySelectorAll('circle').forEach(dot => {
      const isConn = connected.has(dot.dataset.from) && connected.has(dot.dataset.to);
      dot.setAttribute('opacity', isConn ? '1' : '0.08');
    });
  }

  clearHighlight() {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;
    canvas.querySelectorAll('.smap-card[data-id]').forEach(card => card.classList.remove('smap-card--dim', 'smap-card--highlight'));
    svg.querySelectorAll('path').forEach(path => {
      const isDependency = path.dataset.dependency === 'true';
      path.setAttribute('stroke-opacity', isDependency ? '0.62' : '0.36');
      path.setAttribute('stroke-width', isDependency ? '2.2' : '1.4');
    });
    svg.querySelectorAll('circle').forEach(dot => dot.setAttribute('opacity', '1'));
  }
}
