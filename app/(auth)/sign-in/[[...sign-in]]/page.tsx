import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

export default function Page() {
  if (DEV_AUTH_USER_ID) {
    redirect("/");
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
