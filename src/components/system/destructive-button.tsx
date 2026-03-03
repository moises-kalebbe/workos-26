import { Button, type ButtonProps } from "@/components/ui/button";

export function DestructiveButton(props: ButtonProps) {
  return <Button {...props} variant="destructive" />;
}

