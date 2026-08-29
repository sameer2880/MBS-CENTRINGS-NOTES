import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isMasterAdmin } from "@/lib/access";

/**
 * Gates an entire page to the master admin / admin-role account only.
 * Managers (and, in practice, workers who never reach these routes) see a
 * friendly "ask the admin" card instead of the page content.
 *
 * Usage: wrap the page's returned JSX, e.g.
 *   return <AdminOnly>{...actual page markup...}</AdminOnly>;
 *
 * Keep this at the leaf of the render tree (i.e. still call all of the
 * page's hooks first) so React's rules of hooks aren't violated by an
 * early return.
 */
export function AdminOnly({ children, label = "This section" }: { children: ReactNode; label?: string }) {
  if (isMasterAdmin()) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <div>
            <div className="font-semibold">Admin access only</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {label} is only available to admins. Please ask the admin if you need access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}