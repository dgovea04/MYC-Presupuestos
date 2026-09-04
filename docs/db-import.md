# Importing SQLite `.db` budgets

The DB importer creates a new MC Presupuestos project from a compatible SQLite budget database. The source database is opened read-only and is never written beside or inside the source file.

## Supported format

The importer currently supports the MC budget SQLite schema identified by `mc.db.sqlite.v1`:

- Required tables: `proyectos`, `partidas`, `recursos`, `acu_items`
- Optional table: `sub_presupuestos`
- Optional library tables are detected but are not imported as budget items without a reliable relation to `partidas`
- Accepted extensions: `.db`, `.sqlite`, `.sqlite3`
- Maximum upload size: 80 MB

The database must have the SQLite header `SQLite format 3`. A generic SQLite database is not automatically compatible; unsupported schemas are rejected with the missing tables or columns.

## Import modes

### Upload

Use **Importaciones > Archivo .db > Subir archivo**. Select the database in the browser, choose the destination company, find the projects, select a project or subbudget, review the preview, and confirm **Importar a MC**.

Uploads use `multipart/form-data` and are copied to a temporary directory for the duration of each request. The temporary directory is removed after success or failure. The server reads the uploaded bytes, not a client filesystem path.

### Local path

Use **Buscar base local** only when the Node process running MC has access to the path. This is intended for a local or desktop installation and can read an absolute local path or an accessible UNC path. It does not allow a browser connected to a remote deployment to expose a path on the user's computer.

Local mode requires:

```text
NODE_ENV=development
```

or:

```text
MYC_ENABLE_LOCAL_SERVICES=true
```

The API is protected by `isLocalServerRuntimeEnabled()` and remains disabled in a normal remote deployment. The source database should be closed in the application that owns it before reading so SQLite is not locked by a concurrent write.

## Data mapping

The reader maps project metadata, subbudgets, title levels, budget items, resources, and APU rows into the shared `S10SnapshotContract` pipeline. Titles remain levels and are not persisted as budget items. Rows without a subbudget are retained in a synthetic `GENERAL` subbudget with a warning.

For APU prices, `acu_items.precio` takes precedence over `recursos.precio`; the resource price is used when the APU row price is null. APU partials are calculated from quantity and unit price using decimal-safe arithmetic. The resulting preview preserves the source quantity, unit price, partial, and warnings before persistence.

The final import reuses `importS10SnapshotToMyc`, checks `EDITOR` membership, persists transactionally, revalidates project and budget paths, and records the existing `budget_imported` event with `import_source: "db"`.

## Endpoints

- `POST /api/imports/db/draft`: upload discovery or selected-project preview
- `POST /api/imports/db/import`: upload validation and persistence
- `GET /api/imports/db/local/projects?path=...`: local project discovery
- `POST /api/imports/db/local/export`: local selected-project snapshot export
- `POST /api/imports/db/local/import`: local validation and persistence

The local endpoints require an authenticated session and the local server capability gate. They use fixed SQL queries and never accept SQL or table names from the client.

## Verification

Focused tests:

```bash
npm run test -- --run lib/db-import app/api/imports/db components/imports/db-importer-page-content.test.tsx
```

Repository fixture coverage uses:

```text
presupuesto-ejemplo/db/PAVIMENTADO RIGIDO DE LA CALLE _28 DE JULIO_.db
```

The fixture test checks that a real project can be listed, read, converted to a versioned snapshot, and passed through the mapper without changing its size or modification time.

Before shipping changes, run:

```bash
npm run typecheck
npm run lint
npm run test
```

## Troubleshooting

### “El archivo no tiene una firma SQLite valida”

The selected file is not a SQLite database, is truncated, or has a different container format. Export the budget again from the source application and select the resulting `.db` file.

### “La base .db no usa un schema compatible”

The file is SQLite but does not expose the supported MC tables or columns. Check the missing names in the response. A new source schema requires a versioned reader and mapper rather than bypassing validation.

### “El archivo no existe” or “No se pudo abrir la base SQLite”

For local mode, confirm that the path belongs to the machine running Node, that the file is readable, and that the source application has been closed. For a remote web deployment, upload the file instead of entering a path from the client computer.

### No projects or importable items are shown

Confirm that `proyectos` contains rows linked to `partidas`, and that the selected project has at least one non-title row. Titles with `es_titulo = 1` are hierarchy rows and do not count as importable items.

### APU warnings appear

Review the warning context in the preview. Missing resource relations are retained as warnings without inventing data. A source APU whose calculated total does not match the budget item unit price is marked as inconsistent by the shared S10 mapper; the source PU and partial remain visible for review.

### The source database is locked

Close the application that is writing the database and retry. The importer uses SQLite read-only mode but cannot override an active exclusive lock.
