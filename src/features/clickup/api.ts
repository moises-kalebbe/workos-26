import { getClerkToken } from "@/lib/clerkBridge";
import type { CUSpaceViewsResponse, CUTaskCreate, CUTasksResponse, CUTaskUpdate, CUViewResponse } from "./types";

async function cuFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getClerkToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`/api/clickup/${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = (json as { error?: string; err?: string })?.error
      ?? (json as { err?: string })?.err
      ?? "Erro na API ClickUp";
    throw new Error(msg);
  }
  return json as T;
}

export const clickupApi = {
  getView: (viewId: string) =>
    cuFetch<CUViewResponse>(`view/${viewId}`),

  getViewTasks: (viewId: string, page = 0) =>
    cuFetch<CUTasksResponse>(`view/${viewId}/task?page=${page}`),

  updateTask: (taskId: string, payload: CUTaskUpdate) =>
    cuFetch(`task/${taskId}`, { method: "PUT", body: JSON.stringify(payload) }),

  createTask: (listId: string, payload: CUTaskCreate) =>
    cuFetch(`list/${listId}/task`, { method: "POST", body: JSON.stringify(payload) }),

  getListMembers: (listId: string) =>
    cuFetch<{ members: { user: { id: number; username: string; email: string; profilePicture: string | null; color: string } }[] }>(
      `list/${listId}/member`,
    ),

  getSpaceViews: (spaceId: string) =>
    cuFetch<CUSpaceViewsResponse>(`space/${spaceId}/view`),

  testAuth: () =>
    cuFetch<{ teams: { id: string; name: string }[] }>("team"),
};
