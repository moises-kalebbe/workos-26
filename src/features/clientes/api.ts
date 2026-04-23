import { db } from "@/lib/dbClient";
import type { Client, ClientFile } from "./types";

export const clientesApi = {
  clients: {
    list: () =>
      db.from<Client[]>("clients").select("*").order("name", { ascending: true }),

    create: (values: Omit<Client, "id" | "user_id" | "created_at" | "updated_at">) =>
      db.from<Client[]>("clients").insert(values),

    update: (id: string, values: Partial<Omit<Client, "id" | "user_id" | "created_at" | "updated_at">>) =>
      db.from<Client[]>("clients").update(values).eq("id", id),

    delete: (id: string) =>
      db.from<Client[]>("clients").delete().eq("id", id),
  },

  files: {
    listByClient: (clientId: string) =>
      db
        .from<ClientFile[]>("client_files")
        .select("id,user_id,client_id,file_name,file_mime,file_size,service_date,service_type,description,created_at,updated_at")
        .eq("client_id", clientId)
        .order("service_date", { ascending: false }),

    delete: (id: string) =>
      db.from<ClientFile[]>("client_files").delete().eq("id", id),
  },
};
