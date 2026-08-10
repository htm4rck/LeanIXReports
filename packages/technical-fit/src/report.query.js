import { graphQL, getShortName } from '@shared/index.js';

const QUERY = `{
  allFactSheets(factSheetType: Application) {
    edges {
      node {
        id displayName
        ... on Application {
          lifecycle { phases { phase startDate } }
          TipoDeArquitectura TipoDeAutenticacion lxHostingType
          Disponibilidad RecoveryTimeObjective ComplianceStandard
          relApplicationToOrganization {
            edges { node { factSheet { displayName } } }
          }
        }
      }
    }
  }
}`;

function getCurrentPhase(phases) {
  if (!phases?.length) return null;
  const now = new Date().toISOString().slice(0, 10);
  const sorted = [...phases].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  let current = null;
  for (const p of sorted) {
    if (!p.startDate || p.startDate <= now) current = p.phase;
  }
  return current;
}

export async function fetchApplications() {
  const result = await graphQL(QUERY);
  return result.allFactSheets.edges.map(({ node: n }) => ({
    id: n.id,
    name: getShortName(n.displayName),
    fullName: n.displayName,
    lifecycle: { currentPhase: getCurrentPhase(n.lifecycle?.phases) },
    TipoDeArquitectura: n.TipoDeArquitectura,
    TipoDeAutenticacion: n.TipoDeAutenticacion,
    lxHostingType: n.lxHostingType,
    Disponibilidad: n.Disponibilidad,
    RecoveryTimeObjective: n.RecoveryTimeObjective,
    ComplianceStandard: n.ComplianceStandard,
    domain: getShortName(
      n.relApplicationToOrganization?.edges?.[0]?.node?.factSheet?.displayName || 'Sin dominio'
    ),
  }));
}
