"use client";

import { useState, useTransition } from "react";
import { BellRing, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeBillReminder, setBillReminder } from "@/lib/finance/reminder-actions";
import { describeReminder, REMINDER_DAY_OPTIONS } from "@/lib/finance/reminder-schedule";

export interface ReminderSetting {
  daysBefore: number;
  hour: number;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const selectClass = "h-8 rounded-lg border border-input bg-background px-2 text-sm";

function hourLabel(hour: number) {
  return new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
}

/** "Remind me" for one bill: pick days before + time; emails go to the user's login email. */
export function BillReminderControl({ billId, current }: { billId: string; current?: ReminderSetting }) {
  const [editing, setEditing] = useState(false);
  const [daysBefore, setDaysBefore] = useState(current?.daysBefore ?? 3);
  const [hour, setHour] = useState(current?.hour ?? 9);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      try {
        const result = await setBillReminder({ billId, daysBefore, hour, timeZone });
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) setEditing(false);
      } catch {
        setMessage({ ok: false, text: "Couldn't save the reminder. Try again." });
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const result = await removeBillReminder(billId);
        setMessage({ ok: result.ok, text: result.message });
        setEditing(false);
      } catch {
        setMessage({ ok: false, text: "Couldn't turn the reminder off. Try again." });
      }
    });
  }

  return (
    <div className="basis-full flex flex-col gap-1.5 pl-11">
      {!editing ? (
        <div className="flex flex-wrap items-center gap-2">
          {current ? (
            <span className="inline-flex items-center gap-1 text-xs text-positive">
              <BellRing className="size-3.5" aria-hidden="true" />
              Emails you {describeReminder(current.daysBefore, current.hour)}
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setMessage(null); setEditing(true); }}>
            <Mail className="size-3.5" />
            {current ? "Change reminder" : "Remind me by email"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent/40 p-2">
          <label className="flex items-center gap-1.5 text-xs">
            Email me
            <select className={selectClass} value={daysBefore} onChange={(e) => setDaysBefore(Number(e.target.value))} aria-label="Days before due date">
              {REMINDER_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "on the due date" : d === 1 ? "1 day before" : `${d} days before`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            at
            <select className={selectClass} value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="Time of day">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" size="sm" className="h-8" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {current && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-critical" disabled={pending} onClick={remove}>
              Turn off
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-8" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className={message.ok ? "text-xs text-muted-foreground" : "text-xs text-critical"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
