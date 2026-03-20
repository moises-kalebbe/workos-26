import { LucideIcon } from "lucide-react";
import { StatePanel } from "@/components/system/state-panel";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return <StatePanel state="empty" icon={Icon} title={title} description={description || ""} />;
}

