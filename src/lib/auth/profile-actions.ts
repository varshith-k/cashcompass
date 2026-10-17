"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { isProfileEditingEnabled, updateAuth0UserName } from "./management";
import { requireSession } from "./session";

export type ProfileFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const MAX_NAME_LENGTH = 80;

/** Updates the signed-in user's display name in Auth0 and in the current session. */
export async function updateDisplayName(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await requireSession();

  if (session.source !== "auth0" || !isProfileEditingEnabled()) {
    return { status: "error", message: "Profile editing isn't available on this deployment." };
  }

  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) {
    return { status: "error", message: "Enter a name." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { status: "error", message: `Keep it under ${MAX_NAME_LENGTH} characters.` };
  }

  try {
    // The id comes from the verified session — never from the form.
    await updateAuth0UserName(session.user.id, name);
  } catch (error) {
    console.error("[auth] profile update failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "We couldn't save your name. Please try again." };
  }

  const raw = await auth0.getSession();
  if (raw) {
    await auth0.updateSession({ ...raw, user: { ...raw.user, name } });
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Name updated." };
}
