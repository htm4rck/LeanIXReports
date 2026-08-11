/**
 * 1. report.query.js — CAPA DE DATOS
 *
 * Responsabilidad: hablar con LeanIX y devolver objetos limpios.
 * Nada de lógica de negocio aquí.
 */

import { graphQL, getShortName } from '@shared/index.js';
import { getCurrentPhase } from './report.calc.js';

// 1.1 Query: solo los campos que el reporte necesita
const QUERY = `{
  allFactSheets(factSheetType: Application) {
    edges {
      node {
        id displayName
        ... on Application {
          technicalSuitability
          criticidadDeDatos
          TipoDeArquitectura
          lxHostingType
          lifecycle { phases { phase startDate } }
        }
      }
    }
  }
}`;

// 1.2 Ejecuta la query y mapea cada nodo a un objeto de dominio
export async function fetchApplications() {
  const result = await graphQL(QUERY);

  return result.allFactSheets.edges.map(({ node: n }) => ({
    id:                  n.id,
    name:                getShortName(n.displayName),
    technicalSuitability: n.technicalSuitability,
    criticidadDeDatos:   n.criticidadDeDatos,
    TipoDeArquitectura:  n.TipoDeArquitectura,
    lxHostingType:       n.lxHostingType,
    lifecycle:           { currentPhase: getCurrentPhase(n.lifecycle?.phases) },
  }));
}
