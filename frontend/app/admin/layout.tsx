import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminGuard from "@/components/admin/AdminGuard";
import AppLayout from "@/components/layout/AppLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGuard>
        <AppLayout>{children}</AppLayout>
      </AdminGuard>
    </ProtectedRoute>
  );
}
