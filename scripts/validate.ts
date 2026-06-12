/**
 * npm run validate — runs every data-quality check in lib/validate.ts
 * against the live database and exits non-zero on any failure.
 */
import { openDb } from "../lib/db";
import { printValidation, runValidation } from "../lib/validate";

const db = openDb();
const ok = printValidation(runValidation(db));
db.close();
process.exit(ok ? 0 : 1);
