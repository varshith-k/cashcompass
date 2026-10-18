// Reports presence only. Values are never printed or serialized.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info() {}, error() {} });
const groups = {
  core: ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL", "DATABASE_URL"],
  integrations: ["GEMINI_API_KEY", "NESSIE_API_KEY"],
  optional: ["GEMINI_MODEL", "NESSIE_CUSTOMER_ID", "NESSIE_ACCOUNT_ID", "SOLANA_RPC_ENDPOINT", "SOLANA_DEMO_RECIPIENT_ADDRESS"],
};
let missing = false;
const coreOnly = process.argv.includes("--core-only");
for (const [group, names] of Object.entries(groups)) {
  for (const name of names) {
    const present = Boolean(process.env[name]?.trim());
    console.log(`${group}: ${name}: ${present ? "present" : "missing"}`);
    if ((group === "core" || (!coreOnly && group === "integrations")) && !present) missing = true;
  }
}
const account = Boolean(process.env.NESSIE_CUSTOMER_ID || process.env.NESSIE_ACCOUNT_ID);
console.log(`integrations: Nessie account/customer selection: ${account ? "present" : "missing"}`);
if (!account && !coreOnly) missing = true;
process.exitCode = missing ? 1 : 0;
