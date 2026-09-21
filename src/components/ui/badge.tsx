import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/12 text-primary-soft",
        secondary: "border-secondary/25 bg-secondary/12 text-secondary",
        outline: "border-border bg-elevated text-muted-foreground",
        success: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
        warning: "border-amber-500/25 bg-amber-500/12 text-amber-300",
        destructive: "border-red-500/25 bg-red-500/12 text-red-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
