export async function graphQL(query, variables = {}) {
  return lx.executeGraphQL(query, variables);
}
