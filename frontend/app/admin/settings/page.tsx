"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import { useAdminSettingsQuery, useAdminSettingsUpdateMutation } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import type { Setting } from "@/types/api";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function groupLabel(group: string) {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

export default function AdminSettingsPage() {
  const settings = useAdminSettingsQuery();
  const updateSettings = useAdminSettingsUpdateMutation();

  // Local editable draft, keyed by setting key. Initialized from — and
  // re-synced whenever — the server data changes (e.g. after a successful save).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const setting of settings.data as Setting[]) {
        if (!(setting.key in next)) {
          next[setting.key] = setting.value ?? "";
        }
      }
      return next;
    });
  }, [settings.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const setting of settings.data ?? []) {
      const list = map.get(setting.group) ?? [];
      list.push(setting);
      map.set(setting.group, list);
    }
    return Array.from(map.entries());
  }, [settings.data]);

  const onFieldChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings.data?.length) return;
    setMessage(null);
    try {
      await updateSettings.mutateAsync(
        settings.data.map((setting) => ({ key: setting.key, value: draft[setting.key] ?? setting.value ?? "" })),
      );
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to save settings."));
    }
  };

  if (settings.isPending) {
    return <LoadingBlock label="Loading settings..." />;
  }

  if (settings.error) {
    return <ErrorBlock message={extractErrorMessage(settings.error, "Failed to load settings.")} />;
  }

  if (!settings.data?.length) {
    return <EmptyBlock title="No settings" description="Settings will appear here once seeded." />;
  }

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Settings</h1>
      <p className="text-sm text-muted-foreground">
        Site-wide configuration. Changes apply immediately across the platform once saved.
      </p>

      <form onSubmit={onSave} className="space-y-4">
        {grouped.map(([group, items]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{groupLabel(group)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((setting) => (
                <div key={setting.key} className="grid gap-1.5 sm:grid-cols-[1fr_2fr] sm:items-center sm:gap-4">
                  <label className="text-sm font-medium" htmlFor={`setting-${setting.key}`}>
                    {setting.label ?? setting.key}
                    <span className="ml-1 font-mono text-xs text-muted-foreground">({setting.key})</span>
                  </label>
                  {setting.type === "boolean" ? (
                    <select
                      id={`setting-${setting.key}`}
                      value={draft[setting.key] ?? setting.value ?? "0"}
                      onChange={(e) => onFieldChange(setting.key, e.target.value)}
                      className={selectClassName}
                    >
                      <option value="1">Enabled</option>
                      <option value="0">Disabled</option>
                    </select>
                  ) : (
                    <Input
                      id={`setting-${setting.key}`}
                      type={setting.type === "integer" || setting.type === "float" ? "number" : "text"}
                      step={setting.type === "float" ? "0.01" : undefined}
                      value={draft[setting.key] ?? setting.value ?? ""}
                      onChange={(e) => onFieldChange(setting.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving..." : "Save changes"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
