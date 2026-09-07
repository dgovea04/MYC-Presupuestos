import { registerIntegrationAdapter } from "../registry";
import { s10Adapter } from "./s10";
import { xlsxCsvAdapter } from "./xlsx-csv";
import { mcpAdapter } from "./mcp";
registerIntegrationAdapter(xlsxCsvAdapter);
registerIntegrationAdapter(s10Adapter);
registerIntegrationAdapter(mcpAdapter);
export { mcpAdapter, s10Adapter, xlsxCsvAdapter };
