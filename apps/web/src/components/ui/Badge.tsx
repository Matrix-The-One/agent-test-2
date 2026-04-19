import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-medium tracking-[0.04em] text-[color:var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
};
