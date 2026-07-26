"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { selectors } from "@/lib/backend";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { User } from "@/types/api";

export default function ProfilePage() {
  const { data, loading, error } = useApiQuery<{ success: boolean; data: User }, User>("/profile", { select: selectors.profile });

  if (loading) return <LoadingBlock label="Loading profile..." />;
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <EmptyBlock title="Profile unavailable" description="The backend did not return a profile payload under the expected `data` key." />;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Profile</h1>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <dl className="grid gap-4 md:grid-cols-2">
          <div><dt className="text-sm text-neutral-500">Name</dt><dd className="mt-1 font-medium">{data.name}</dd></div>
          <div><dt className="text-sm text-neutral-500">Email</dt><dd className="mt-1 font-medium">{data.email}</dd></div>
          <div><dt className="text-sm text-neutral-500">Email verified</dt><dd className="mt-1 font-medium">{data.email_verified_at ? "Yes" : "No"}</dd></div>
          <div><dt className="text-sm text-neutral-500">Admin</dt><dd className="mt-1 font-medium">{data.is_admin ? "Yes" : "No"}</dd></div>
        </dl>
      </div>
    </section>
  );
}
