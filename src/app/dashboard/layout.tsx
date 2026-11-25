import { DashboardLayout } from "@/components/shell/dashboard-layout";

export const dynamic = "force-dynamic";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}