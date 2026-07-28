"use client";

import { useEffect, useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useProfileQuery, useUpdateProfileMutation } from "@/hooks/queries/useProfileQuery";
import { extractErrorMessage } from "@/lib/api";

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
    </section>
  );
}
