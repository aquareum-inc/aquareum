import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, Ref } from "react";

import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,transform,opacity] duration-200 ease-out-expo active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Ink and paper: the one confident action in a view. */
        primary: "bg-primary text-primary-foreground hover:bg-primary/88",
        /* The action that removes, stops or ends something. The colour is on this button only. */
        destructive: "bg-destructive-fill text-white hover:bg-destructive-fill/88",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-hover hover:text-foreground",
        outline:
          "border border-hairline bg-transparent text-foreground hover:bg-hover",
      },
      size: {
        sm: "h-8 px-3 text-caption [&_svg]:size-3.5",
        md: "h-10 px-4 text-body [&_svg]:size-4",
        lg: "h-12 px-6 text-lead [&_svg]:size-[18px]",
        icon: "size-10 active:scale-[0.92] [&_svg]:size-[18px]",
        "icon-sm": "size-8 active:scale-[0.92] [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
