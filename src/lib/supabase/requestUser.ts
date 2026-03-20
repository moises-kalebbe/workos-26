import type { User } from "@supabase/supabase-js";

export async function getRequestUser(
  supabase: any,
  request: Request,
): Promise<User | null> {
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (bearerToken) {
    const {
      data: { user },
    } = await supabase.auth.getUser(bearerToken);

    return user ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}
