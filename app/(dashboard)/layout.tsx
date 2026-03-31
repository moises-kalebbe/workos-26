import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const DEV_AUTH_USER_ID = process.env.DEV_AUTH_USER_ID || process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!DEV_AUTH_USER_ID) {
    const authState = await auth();
    if (!authState.userId) {
      redirect("/sign-in");
    }
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

