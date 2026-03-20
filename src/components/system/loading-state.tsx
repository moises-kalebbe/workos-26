import { Loader2 } from "lucide-react";
import { StatePanel } from "@/components/system/state-panel";

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return <StatePanel state="loading" icon={Loader2} title="Montando a area de trabalho" description={message} />;
}

