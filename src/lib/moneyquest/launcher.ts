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
