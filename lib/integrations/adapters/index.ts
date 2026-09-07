import { registerIntegrationAdapter } from "../registry";
import { s10Adapter } from "./s10";
import { xlsxCsvAdapter } from "./xlsx-csv";
registerIntegrationAdapter(xlsxCsvAdapter);
registerIntegrationAdapter(s10Adapter);
export { s10Adapter, xlsxCsvAdapter };
