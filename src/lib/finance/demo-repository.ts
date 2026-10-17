import "server-only";
import type { FinancialEventRepository } from "./repository";
import { getDemoEvents } from "./demo-data";

/** Used until DATABASE_URL points at a real Tiger Data instance. */
export class DemoFinancialEventRepository implements FinancialEventRepository {
  async listEvents() {
    return getDemoEvents();
  }
}
