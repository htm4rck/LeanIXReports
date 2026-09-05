/**
 * 1. report.query.js — CAPA DE DATOS
 *
 * Responsabilidad única: comunicarse con LeanIX y devolver objetos simples.
 * - La selección de campos vive aquí.
 * - Los filtros de negocio derivados del extracto Excel también se aplican aquí.
 *
 * Flujo:
 *   index.js → report.js → [fetchLandscapeData()] → report.calc.js
 */

import { graphQL, getShortName } from '@shared/index.js';

const APPLICATION_QUERY = `{
  allFactSheets(factSheetType: Application) {
    edges {
      node {
        id
        displayName
        description
        tags { name }
        ... on Application {
          CanalDeAcceso
          itGovernanceModel
          relToParent {
            edges { node { factSheet { id displayName } } }
          }
          relToChild {
            edges { node { factSheet { id displayName type } } }
          }
          relApplicationToITComponent {
            edges { node { factSheet { id displayName type } } }
          }
          relApplicationToOrganization {
            edges { node { factSheet { displayName } } }
          }
        }
      }
    }
  }
}`;

const IT_COMPONENT_QUERY = `query($filter: FilterInput) {
  allFactSheets(factSheetType: ITComponent, filter: $filter) {
    edges {
      node {
        id
        displayName
        description
        tags { name }
        ... on ITComponent {
          technologyAssetType
          ItGovernanceModel
          CanalDeAcceso
          TipoDeArquitectura
          relToParent {
            edges { node { factSheet { id displayName type } } }
          }
          relITComponentToProvider {
            edges { node { factSheet { id displayName type } } }
          }
          relITComponentToOrganization {
            edges { node { factSheet { displayName } } }
          }
        }
      }
    }
  }
}`;

const TOOL_QUERY = `query($filter: FilterInput) {
  allFactSheets(factSheetType: Tool, filter: $filter) {
    edges {
      node {
        id
        displayName
        description
        tags { name }
        ... on Tool {
          accessChannel
          itGovernanceModel
          relToolToOrganization {
            edges { node { factSheet { displayName } } }
          }
        }
      }
    }
  }
}`;

function extractOrganizations(relation) {
  return relation?.edges?.map(edge => edge.node?.factSheet?.displayName).filter(Boolean) || [];
}

function extractTagNames(tags) {
  return tags?.map(tag => tag.name).filter(Boolean) || [];
}

function isLandscapeTechnologyAsset(type) {
  return type === 'technologyService';
}

async function safeGraphQL(query, variables, fallbackLabel) {
  try {
    return await graphQL(query, variables);
  } catch (error) {
    console.warn(`[software-landscape] Fallback sin FilterInput para ${fallbackLabel}:`, error);
    return graphQL(query, {});
  }
}

export async function fetchLandscapeData() {
  const [applicationsResult, itComponentsResult, toolsResult] = await Promise.all([
    graphQL(APPLICATION_QUERY),
    safeGraphQL(
      IT_COMPONENT_QUERY,
      {
        filter: {
          facetFilters: [
            { facetKey: 'FactSheetTypes', operator: 'OR', keys: ['ITComponent'] },
            { facetKey: 'technologyAssetType', operator: 'OR', keys: ['technologyService'] },
          ],
        },
      },
      'itComponents'
    ),
    safeGraphQL(
      TOOL_QUERY,
      {
        filter: {
          facetFilters: [
            { facetKey: 'FactSheetTypes', operator: 'OR', keys: ['Tool'] },
          ],
        },
      },
      'tools'
    ),
  ]);

  const applications = applicationsResult.allFactSheets.edges
    .map(({ node: n }) => {
      const tags = extractTagNames(n.tags);
      return {
        id: n.id,
        kind: 'application',
        name: getShortName(n.displayName),
        fullName: n.displayName,
        description: n.description || '',
        channel: n.CanalDeAcceso || '',
        governance: n.itGovernanceModel || '',
        tags,
        parentId: n.relToParent?.edges?.[0]?.node?.factSheet?.id || null,
        parentName: getShortName(n.relToParent?.edges?.[0]?.node?.factSheet?.displayName || ''),
        childApps: n.relToChild?.edges
          ?.map(edge => ({
            id: edge.node?.factSheet?.id || '',
            name: getShortName(edge.node?.factSheet?.displayName || ''),
            type: edge.node?.factSheet?.type || '',
          }))
          .filter(child => child.id && child.type === 'Application') || [],
        relatedItComponents: n.relApplicationToITComponent?.edges
          ?.map(edge => ({
            id: edge.node?.factSheet?.id || '',
            name: getShortName(edge.node?.factSheet?.displayName || ''),
            type: edge.node?.factSheet?.type || '',
          }))
          .filter(item => item.id && item.name) || [],
        organizations: extractOrganizations(n.relApplicationToOrganization),
      };
    });

  const itComponents = itComponentsResult.allFactSheets.edges
    .map(({ node: n }) => ({
      id: n.id,
      kind: 'itComponent',
      name: getShortName(n.displayName),
      fullName: n.displayName,
      description: n.description || '',
      channel: n.CanalDeAcceso || '',
      governance: n.ItGovernanceModel || '',
      technologyAssetType: n.technologyAssetType || '',
      architecture: n.TipoDeArquitectura || '',
      parentComponentId: n.relToParent?.edges?.[0]?.node?.factSheet?.id || null,
      parentComponentName: getShortName(n.relToParent?.edges?.[0]?.node?.factSheet?.displayName || ''),
      providers: n.relITComponentToProvider?.edges
        ?.map(edge => ({
          id: edge.node?.factSheet?.id || '',
          name: getShortName(edge.node?.factSheet?.displayName || ''),
          type: edge.node?.factSheet?.type || '',
        }))
        .filter(provider => provider.id && provider.name) || [],
      tags: extractTagNames(n.tags),
      organizations: extractOrganizations(n.relITComponentToOrganization),
    }))
    .filter(item => isLandscapeTechnologyAsset(item.technologyAssetType));

  const tools = toolsResult.allFactSheets.edges.map(({ node: n }) => ({
    id: n.id,
    kind: 'tool',
    name: getShortName(n.displayName),
    fullName: n.displayName,
    description: n.description || '',
    channel: n.accessChannel || '',
    governance: n.itGovernanceModel || '',
    technologyAssetType: 'tool',
    architecture: '',
    parentComponentId: null,
    parentComponentName: '',
    providers: [],
    tags: extractTagNames(n.tags),
    organizations: extractOrganizations(n.relToolToOrganization),
  }));

  return { applications, itComponents: [...itComponents, ...tools] };
}
