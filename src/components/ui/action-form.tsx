"use client";

import { useState } from "react";

/** Keeps mutations pending and recoverable without discarding the current page. */
export function ActionForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form className={className} aria-busy={pending} action={async (data) => {
      setPending(true);
      setError(false);
      try { await action(data); }
      catch { setError(true); }
      finally { setPending(false); }
    }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {pending && <span role="status" className="sr-only">Saving changes…</span>}
      {error && <p role="alert" className="text-xs text-critical basis-full">Unable to save. Check the amount and try again.</p>}
    </form>
  );
}
