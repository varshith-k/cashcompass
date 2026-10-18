import { describe, expect, it } from "vitest";
import { getMoneyQuestExperienceUrl, moneyQuestExperienceUrl } from "./launcher";
import { isPublicPath } from "@/lib/auth/routes";

describe("MoneyQuest experience launcher", () => {
  it("keeps the companion route inside the existing authentication boundary", () => {
    expect(isPublicPath("/moneyquest")).toBe(false);
    expect(isPublicPath("/moneyquest/")).toBe(false);
  });
  it("rejects missing or non-game raw URLs", () => {
    for (const value of [undefined, "", "  ", "not a url", "https://www.roblox.com/"]) {
      expect(moneyQuestExperienceUrl(value)).toBeNull();
    }
  });

  it("opens the owner's game when deployment configuration is absent or invalid", () => {
    for (const override of [undefined, "", "  ", "javascript:alert(1)", "https://evil.test/games/123"]) {
      expect(getMoneyQuestExperienceUrl(override)).toBe("https://www.roblox.com/games/73262786586748");
    }
  });

  it("allows a validated direct Roblox game override", () => {
    expect(getMoneyQuestExperienceUrl("https://www.roblox.com/games/123456789/Example?ref=test"))
      .toBe("https://www.roblox.com/games/123456789");
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
