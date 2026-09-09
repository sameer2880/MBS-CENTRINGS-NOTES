import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/Sidebar";
import { Gate } from "@/lib/gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => (
    <Gate>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </Gate>
  ),
});
