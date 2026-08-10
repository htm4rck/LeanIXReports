/**
 * report.query.js — CAPA DE DATOS
 *
 * Responsabilidad única: comunicarse con LeanIX.
 * - Define la query GraphQL con los campos que necesita este reporte.
 * - Transforma la respuesta cruda de la API en objetos simples del dominio.
 *
 * Regla: ninguna lógica de negocio aquí. Si un campo cambia en LeanIX,
 * solo se toca este archivo.
 *
 * Flujo:
 *   index.js → report.js → [fetchApplications()] → report.calc.js
 */

import { graphQL, getShortName } from '@shared/index.js';
import { getCurrentPhase } from './report.calc.js';

// 1. Query GraphQL: declara exactamente qué campos necesita el reporte.
//    Agregar o quitar campos aquí no afecta ningún otro archivo.
//    Nota: linesOfCode no es un campo estándar de LeanIX — el tamaño de
//    burbuja se deriva de otros campos disponibles (ver report.calc.js).
const QUERY = `{
  allFactSheets(factSheetType: Application) {
    edges {
      node {
        id displayName
        ... on Application {
          technicalSuitability
          businessCriticality
          criticidadDeDatos
          TipoDeArquitectura
          TipoAplicacion
          lxHostingType
          RecoveryTimeObjective
          lifecycle { phases { phase startDate } }
          relApplicationToOrganization {
            edges { node { factSheet { displayName } } }
          }
        }
      }
    }
  }
}`;

// 2. Ejecuta la query y transforma cada nodo crudo en un objeto de dominio
//    limpio. El resto del reporte solo trabaja con estos objetos, nunca
//    con la respuesta raw de GraphQL.
export async function fetchApplications() {
  const result = await graphQL(QUERY);

  // 3. Mapeo: nodo GraphQL → objeto de dominio Application
  //    Solo se exponen los campos que el reporte realmente usa.
  const apps = result.allFactSheets.edges.map(({ node: n }) => ({
    id: n.id,
    name: getShortName(n.displayName),                          // nombre corto sin jerarquía
    technicalSuitability: n.technicalSuitability,               // evaluación técnica LeanIX
    businessCriticality: n.businessCriticality,                 // criticidad de negocio (low/medium/high)
    criticidadDeDatos: n.criticidadDeDatos,                     // campo custom Alicorp (Alta/Media/Baja)
    TipoDeArquitectura: n.TipoDeArquitectura,                   // campo custom Alicorp
    TipoAplicacion: n.TipoAplicacion,                           // tipo de aplicación → color de burbuja
    lxHostingType: n.lxHostingType,                             // tipo de hosting
    RecoveryTimeObjective: n.RecoveryTimeObjective,             // RTO en horas
    lifecycle: { currentPhase: getCurrentPhase(n.lifecycle?.phases) }, // fase activa calculada
    domain: getShortName(
      n.relApplicationToOrganization?.edges?.[0]?.node?.factSheet?.displayName || 'Sin dominio'
    ),
  }));

  return apps;
}
