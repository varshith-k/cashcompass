import { describe, expect, it } from "vitest";
import { moneyQuestExperienceUrl } from "./launcher";
import { isPublicPath } from "@/lib/auth/routes";

describe("MoneyQuest experience launcher", () => {
  it("keeps the companion route inside the existing authentication boundary", () => {
    expect(isPublicPath("/moneyquest")).toBe(false);
    expect(isPublicPath("/moneyquest/")).toBe(false);
  });
  it("requires a configured direct Roblox experience", () => {
    for (const value of [undefined, "", "  ", "not a url", "https://www.roblox.com/"]) {
      expect(moneyQuestExperienceUrl(value)).toBeNull();
    }
  });

  it("normalizes genuine links and drops query parameters", () => {
    // Fixture only; never used as the configured game or rendered launcher.
    expect(moneyQuestExperienceUrl(" https://www.roblox.com/games/123456789/Example?ref=demo#about "))
      .toBe("https://www.roblox.com/games/123456789");
    expect(moneyQuestExperienceUrl("https://roblox.com/games/123456789/"))
      .toBe("https://www.roblox.com/games/123456789");
  });

  it("rejects unsafe schemes, misleading hosts, credentials, and non-game paths", () => {
    for (const value of [
      "javascript:alert(1)", "roblox://experiences/start?placeId=123",
      "http://www.roblox.com/games/123", "https://www.roblox.com.evil.test/games/123",
      "https://evil.test/roblox.com/games/123", "https://evil.test@www.roblox.com/games/123",
      "https://www.roblox.com:444/games/123", "https://www.roblox.com/games/0",
      "https://www.roblox.com/games/not-an-id", "https://www.roblox.com/games/123/slug/extra",
      "https://www.roblox.com/redirect?url=https://evil.test",
    ]) expect(moneyQuestExperienceUrl(value)).toBeNull();
  });
});
