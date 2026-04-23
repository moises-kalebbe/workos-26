import type { Client, ClientFile } from "@/types";
export type { Client, ClientFile };

export const SERVICE_TYPES = [
  "Palestra",
  "Design",
  "Video",
  "Consultoria",
  "Fotografia",
  "Social Media",
  "Outro",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export type FiltersState = {
  serviceType: string;
  serviceMonth: string;
};
