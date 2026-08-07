"use client";

import Link from "next/link";
import { KeyRoundIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PushNotificationsCard from "@/components/common/PushNotificationsCard";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore, type ThemePreference } from "@/store/themeStore";

const themeOptions: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/**
 * Drawer/sidebar "Settings" destination requested alongside the mobile-nav
 * UI polish pass. Deliberately a thin hub page, not a duplicate settings
 * form: appearance lives here directly (mirrors the topbar ThemeToggle,
 * just with visible labels instead of a dropdown), while account-detail
 * editing and password changes stay on their existing, more complete
 * /profile page (linked below) rather than being re-implemented twice.
 */
export default function SettingsPage() {
  const { logout, isLoggingOut } = useAuth();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose how CharpsDev looks on this device.</p>
          <div className="flex flex-wrap gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                >
                  <Icon data-icon="inline-start" aria-hidden="true" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <PushNotificationsCard />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Update your name, email, or password from your profile page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="/profile" prefetch={false} />}>
              <UserIcon data-icon="inline-start" aria-hidden="true" />
              Go to profile
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/profile#change-password" prefetch={false} />}>
              <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Sign out of CharpsDev on this device.</p>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isLoggingOut}
            onClick={() => void logout()}
          >
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
