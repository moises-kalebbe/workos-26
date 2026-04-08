import { Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/system/confirm-action-dialog";

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirmar exclusao"
      description={`Tem certeza que deseja excluir ${itemLabel}? Esta acao nao pode ser desfeita.`}
      confirmLabel="Excluir"
      onConfirm={onConfirm}
      destructive
    />
  );
}

export const DeleteIcon = Trash2;

