export type TenantQueryAudit = { name: string; hasCompanyFilter: boolean; sensitive: boolean };
export function auditTenantQueries(queries: readonly TenantQueryAudit[]): { passed: boolean; violations: TenantQueryAudit[] } {
  const violations = queries.filter((query) => query.sensitive && !query.hasCompanyFilter);
  return { passed: violations.length === 0, violations };
}
