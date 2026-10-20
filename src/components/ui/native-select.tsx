import * as React from "react";
import { cn } from "@/lib/utils";

/** Native picker avoids nested popup focus/scroll locks in modal forms. */
export function NativeSelect({ onValueChange, className, children, ...props }: Omit<React.ComponentProps<"select">, "onChange"> & { onValueChange: (value: string) => void }) {
  return <select {...props} onChange={(event) => onValueChange(event.target.value)} className={cn("h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)}>{children}</select>;
}
