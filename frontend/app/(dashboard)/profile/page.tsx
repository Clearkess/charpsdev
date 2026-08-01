"use client";

import { useEffect, useState } from "react";
import { KeyRoundIcon, PencilIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import PushNotificationsCard from "@/components/common/PushNotificationsCard";
import {
  useProfileQuery,
  useUpdatePasswordMutation,
  useUpdateProfileMutation,
} from "@/hooks/queries/useProfileQuery";
import { extractErrorMessage } from "@/lib/api";

/**
 * Phase 9 (user-facing features): change password while logged in. Before
 * this, the only way to change a password was to log out and go through
 * the forgot/reset-password email flow — there was no in-app way to do it.
 * Self-contained card (own local state, own success/error messaging) so it
 * doesn't interfere with the profile name/email edit form above it.
 */
function ChangePasswordCard() {
  const updatePassword = useUpdatePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFields = () => {
    setCurrentPassword("");
    setPassword("");
    setPasswordConfirmation("");
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    if (password !== passwordConfirmation) {
      setFormError("New password and confirmation do not match.");
      return;
    }
    try {
      const response = await updatePassword.mutateAsync({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setSuccessMessage(response.message || "Password updated successfully.");
      resetFields();
    } catch (error) {
      setFormError(extractErrorMessage(error, "Failed to update password."));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-4" aria-hidden="true" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium text-muted-foreground">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password-confirmation" className="text-sm font-medium text-muted-foreground">
                Confirm new password
              </label>
              <Input
                id="new-password-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
              />
            </div>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          {successMessage ? <p className="text-sm text-success">{successMessage}</p> : null}
          <Button type="submit" disabled={updatePassword.isPending}>
            {updatePassword.isPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { data, isPending, error } = useProfileQuery();
  const updateProfile = useUpdateProfileMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setEmail(data.email);
    }
  }, [data]);

  if (isPending) return <TableSkeleton rows={2} cols={2} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load profile.")} />;
  if (!data) return <EmptyBlock title="Profile unavailable" description="We could not find profile information for your account." />;

  const startEditing = () => {
    setName(data.name);
    setEmail(data.email);
    setFormError(null);
    setSuccessMessage(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormError(null);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await updateProfile.mutateAsync({ name, email });
      setSuccessMessage("Profile updated successfully.");
      setEditing(false);
    } catch (submitError) {
      setFormError(extractErrorMessage(submitError, "Failed to update profile."));
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Profile</h1>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Edit profile
          </Button>
        ) : null}
      </div>

      {successMessage && !editing ? (
        <p className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">{successMessage}</p>
      ) : null}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="profile-name" className="text-sm font-medium text-muted-foreground">
                    Name
                  </label>
                  <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="profile-email" className="text-sm font-medium text-muted-foreground">
                    Email
                  </label>
                  <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={updateProfile.isPending}>
                  <XIcon data-icon="inline-start" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <dl className="grid gap-6 md:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium">{data.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="mt-1 font-medium">{data.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Email verified</dt>
                <dd className="mt-1">
                  <Badge variant={data.email_verified_at ? "success" : "warning"}>
                    {data.email_verified_at ? "Verified" : "Pending"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="mt-1">
                  <Badge variant={data.is_admin ? "secondary" : "muted"}>{data.is_admin ? "Admin" : "User"}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <ChangePasswordCard />

      <PushNotificationsCard />
    </section>
  );
}
