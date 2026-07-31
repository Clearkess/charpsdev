import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminGuard from "@/components/admin/AdminGuard";
import AppLayout from "@/components/layout/AppLayout";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGuard>
        <AppLayout>
          <AdminNav />
          {children}
        </AppLayout>
      </AdminGuard>
    </ProtectedRoute>
  );
}
