// Owner-supplied MoneyQuest page. Public navigation does not guarantee join access.
export const MONEYQUEST_EXPERIENCE_URL = "https://www.roblox.com/games/73262786586748/CashCompass-MoneyQuest";

/** Accept only a direct Roblox experience link; never a redirect or custom URI. */
export function moneyQuestExperienceUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      !["roblox.com", "www.roblox.com"].includes(url.hostname) ||
      url.username || url.password || url.port
    ) return null;
    const match = /^\/games\/([1-9]\d*)(?:\/[^/]+)?\/?$/.exec(url.pathname);
    // Drop tracking parameters/fragments and use Roblox's canonical host.
    return match ? `https://www.roblox.com/games/${match[1]}` : null;
  } catch {
    return null;
  }
}

/** The deployed launcher works without editing private server environment files. */
export function getMoneyQuestExperienceUrl(override: string | undefined): string {
  return moneyQuestExperienceUrl(override) ?? moneyQuestExperienceUrl(MONEYQUEST_EXPERIENCE_URL)!;
}
