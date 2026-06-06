export type S10LikelyDomain = "projects" | "budgets" | "partidas" | "apu" | "resources" | "metrados" | "unknown";

export type S10SchemaColumn = {
  name: string;
  dataType: string;
  maxLength: number;
  precision: number;
  scale: number;
  nullable: boolean;
  ordinal: number;
};

export type S10SchemaTable = {
  schema: string;
  name: string;
  rowCount: number;
  likelyDomain: S10LikelyDomain;
  columns: S10SchemaColumn[];
};

export type S10SchemaManifest = {
  tables: S10SchemaTable[];
  domainCandidates: Record<Exclude<S10LikelyDomain, "unknown">, string[]>;
};

export type S10DatabaseCandidate = {
  databaseName: string;
  isS10Candidate: boolean;
  matchedTables: string[];
  presupuestoCount: number;
};

export type S10BudgetSummary = {
  code: string;
  description: string;
  totalCost: number | null;
  subBudgetCount: number;
  itemCount: number;
};

export type SqlcmdOptions = {
  server: string;
  query: string;
  user?: string;
  password?: string;
  trustServerCertificate?: boolean;
};

const domainKeywords = {
  projects: ["obra", "proyecto", "cliente"],
  budgets: ["presupuesto", "subpresupuesto", "titulo"],
  partidas: ["partida"],
  apu: ["analisis", "apu", "precio_unitario", "rendimiento"],
  resources: ["insumo", "recurso", "material", "manoobra", "equipo"],
  metrados: ["metrado", "cantidad"],
} as const satisfies Record<Exclude<S10LikelyDomain, "unknown">, readonly string[]>;

export function buildSqlcmdArgs(options: SqlcmdOptions) {
  const authArgs = options.user && options.password ? ["-U", options.user, "-P", options.password] : ["-E"];
  const certificateArgs = options.trustServerCertificate ? ["-C"] : [];

  return [
    "-S",
    options.server,
    ...authArgs,
    ...certificateArgs,
    "-b",
    "-W",
    "-h",
    "-1",
    "-s",
    "\t",
    "-Q",
    options.query,
  ];
}

export function buildSqlServerDatabaseListSql() {
  return [
    "SET NOCOUNT ON;",
    "SELECT name",
    "FROM sys.databases",
    "WHERE state_desc = 'ONLINE'",
    "  AND HAS_DBACCESS(name) = 1",
    "  AND database_id > 4",
    "ORDER BY name;",
  ].join("\n");
}

export function buildS10DatabaseProbeSql(databaseName: string) {
  return [
    `USE ${quoteSqlIdentifier(databaseName)};`,
    "SET NOCOUNT ON;",
    "DECLARE @matchedTables table (name sysname NOT NULL);",
    "INSERT INTO @matchedTables (name)",
    "SELECT required.name",
    "FROM (VALUES",
    "  (N'Presupuesto'),",
    "  (N'Subpresupuesto'),",
    "  (N'SubpresupuestoDetalle'),",
    "  (N'Partida'),",
    "  (N'PartidaDetalle'),",
    "  (N'Insumo')",
    ") AS required(name)",
    "WHERE OBJECT_ID(N'dbo.' + required.name, N'U') IS NOT NULL;",
    "DECLARE @presupuestoCount int = 0;",
    "IF OBJECT_ID(N'dbo.Presupuesto', N'U') IS NOT NULL",
    "BEGIN",
    "  SELECT @presupuestoCount = COUNT(*) FROM dbo.Presupuesto;",
    "END;",
    "SELECT DB_NAME() AS database_name, name AS matched_table, CONVERT(varchar(20), @presupuestoCount) AS presupuesto_count",
    "FROM @matchedTables",
    "ORDER BY name;",
  ].join("\n");
}

export function buildS10BudgetListSql(databaseName: string) {
  return [
    `USE ${quoteSqlIdentifier(databaseName)};`,
    "SET NOCOUNT ON;",
    "SELECT",
    "  p.CodPresupuesto,",
    "  p.Descripcion,",
    "  CONVERT(varchar(40), p.CostoOferta1) AS CostoOferta1,",
    "  CONVERT(varchar(20), COUNT(DISTINCT sp.CodSubpresupuesto)) AS subbudget_count,",
    "  CONVERT(varchar(20), COUNT(spd.CodPartida)) AS item_count",
    "FROM dbo.Presupuesto p",
    "INNER JOIN dbo.Subpresupuesto sp",
    "  ON sp.CodPresupuesto = p.CodPresupuesto",
    "INNER JOIN dbo.SubpresupuestoDetalle spd",
    "  ON spd.CodPresupuesto = p.CodPresupuesto",
    " AND spd.CodSubpresupuesto = sp.CodSubpresupuesto",
    " AND spd.CodPartida IS NOT NULL",
    " AND spd.CodPartida <> '999999999999'",
    " AND ISNULL(spd.Tipo, 1) <> 0",
    "GROUP BY p.CodPresupuesto, p.Descripcion, p.CostoOferta1",
    "ORDER BY p.CodPresupuesto;",
  ].join("\n");
}

export function buildSqlServerBackupFileListSql(backupPath: string) {
  return `RESTORE FILELISTONLY FROM DISK = N'${escapeSqlString(backupPath)}';`;
}

export function buildSqlServerBackupHeaderSql(backupPath: string) {
  return `RESTORE HEADERONLY FROM DISK = N'${escapeSqlString(backupPath)}';`;
}

export function buildS10SchemaInspectionSql(databaseName: string) {
  return [
    `USE ${quoteSqlIdentifier(databaseName)};`,
    "SET NOCOUNT ON;",
    "SELECT 'TABLES' AS result_set, SCHEMA_NAME(t.schema_id) AS schema_name, t.name AS table_name, CONVERT(varchar(40), SUM(p.rows)) AS row_count",
    "FROM sys.tables t",
    "INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)",
    "GROUP BY t.schema_id, t.name",
    "ORDER BY SCHEMA_NAME(t.schema_id), t.name;",
    "SELECT 'COLUMNS' AS result_set, SCHEMA_NAME(t.schema_id) AS schema_name, t.name AS table_name, c.name AS column_name, ty.name AS data_type,",
    "CONVERT(varchar(20), c.max_length) AS max_length, CONVERT(varchar(20), c.precision) AS numeric_precision,",
    "CONVERT(varchar(20), c.scale) AS numeric_scale, CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS is_nullable,",
    "CONVERT(varchar(20), c.column_id) AS ordinal_position",
    "FROM sys.tables t",
    "INNER JOIN sys.columns c ON c.object_id = t.object_id",
    "INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id",
    "ORDER BY SCHEMA_NAME(t.schema_id), t.name, c.column_id;",
  ].join("\n");
}

export function parseSqlcmdTsv(output: string) {
  return output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^\(\d+ rows? affected\)$/i.test(line))
    .filter((line) => !/^Changed database context to /i.test(line))
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

export function parseSqlServerDatabaseNames(rows: string[][]) {
  return rows.map((row) => row[0]).filter((name): name is string => Boolean(name));
}

export function createS10DatabaseCandidate(databaseName: string, rows: string[][]): S10DatabaseCandidate {
  const matchedTables = rows.map((row) => row[1]).filter((name): name is string => Boolean(name));
  const presupuestoCount = parseInteger(rows[0]?.[2] ?? "0");
  const requiredCoreTables = ["Presupuesto", "Subpresupuesto", "SubpresupuestoDetalle", "Partida"];

  return {
    databaseName,
    isS10Candidate: requiredCoreTables.every((table) => matchedTables.includes(table)),
    matchedTables,
    presupuestoCount,
  };
}

export function parseS10BudgetSummaries(rows: string[][]): S10BudgetSummary[] {
  return rows.map((row) => ({
    code: row[0] ?? "",
    description: row[1] ?? "",
    totalCost: parseNullableNumber(row[2] ?? ""),
    subBudgetCount: parseInteger(row[3] ?? "0"),
    itemCount: parseInteger(row[4] ?? "0"),
  }));
}

export function prepareS10SnapshotExportSql(templateSql: string, budgetCode: string) {
  return templateSql
    .replace(/^\s*USE\s+[\s\S]*?;\s*GO\s*/i, "")
    .replace(
      /DECLARE\s+@CodPresupuesto\s+varchar\(\d+\)\s*=\s*'[^']*';/i,
      `DECLARE @CodPresupuesto varchar(20) = '${escapeSqlString(budgetCode)}';`,
    );
}

export function extractJsonObjectFromSqlcmdOutput(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("sqlcmd no devolvio un objeto JSON S10.");
  }

  return output.slice(start, end + 1).replace(/\r?\n/g, "");
}

export function createS10SchemaManifest(rows: string[][]): S10SchemaManifest {
  const tablesByKey = new Map<string, S10SchemaTable>();

  for (const row of rows) {
    const resultSet = row[0];
    if (resultSet === "TABLES") {
      const schema = row[1] ?? "";
      const name = row[2] ?? "";
      const rowCount = parseInteger(row[3] ?? "0");
      const key = createTableKey(schema, name);
      tablesByKey.set(key, {
        schema,
        name,
        rowCount,
        likelyDomain: detectLikelyDomain([schema, name]),
        columns: [],
      });
    }
  }

  for (const row of rows) {
    const resultSet = row[0];
    if (resultSet !== "COLUMNS") {
      continue;
    }

    const schema = row[1] ?? "";
    const tableName = row[2] ?? "";
    const key = createTableKey(schema, tableName);
    const table = tablesByKey.get(key);
    if (!table) {
      continue;
    }

    table.columns.push({
      name: row[3] ?? "",
      dataType: row[4] ?? "",
      maxLength: parseInteger(row[5] ?? "0"),
      precision: parseInteger(row[6] ?? "0"),
      scale: parseInteger(row[7] ?? "0"),
      nullable: (row[8] ?? "").toUpperCase() === "YES",
      ordinal: parseInteger(row[9] ?? "0"),
    });
    table.likelyDomain = detectLikelyDomain([table.schema, table.name, ...table.columns.map((column) => column.name)]);
  }

  const tables = Array.from(tablesByKey.values()).sort((left, right) =>
    `${left.schema}.${left.name}`.localeCompare(`${right.schema}.${right.name}`),
  );

  return {
    tables,
    domainCandidates: createDomainCandidates(tables),
  };
}

function createDomainCandidates(tables: S10SchemaTable[]) {
  return {
    projects: collectDomainTables(tables, "projects"),
    budgets: collectDomainTables(tables, "budgets"),
    partidas: collectDomainTables(tables, "partidas"),
    apu: collectDomainTables(tables, "apu"),
    resources: collectDomainTables(tables, "resources"),
    metrados: collectDomainTables(tables, "metrados"),
  };
}

function collectDomainTables(tables: S10SchemaTable[], domain: Exclude<S10LikelyDomain, "unknown">) {
  return tables
    .filter((table) => table.likelyDomain === domain)
    .map((table) => createTableKey(table.schema, table.name));
}

function detectLikelyDomain(values: readonly string[]): S10LikelyDomain {
  const normalized = normalizeInspectionText(values.join(" "));

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return domain as S10LikelyDomain;
    }
  }

  return "unknown";
}

function quoteSqlIdentifier(value: string) {
  return `[${value.replaceAll("]", "]]")}]`;
}

function escapeSqlString(value: string) {
  return value.replaceAll("'", "''");
}

function createTableKey(schema: string, table: string) {
  return `${schema}.${table}`;
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInspectionText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}
