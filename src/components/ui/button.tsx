import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian disabled:pointer-events-none disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-obsidian border border-obsidian-border text-white hover:border-bronze hover:text-bronze shadow-lg shadow-black/50",
        destructive:
          "bg-red-900 border border-red-500/50 text-white hover:bg-red-900/90 shadow-lg",
        outline:
          "border border-obsidian-border bg-transparent hover:bg-obsidian-light hover:text-bronze text-gray-300",
        secondary:
          "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/5",
        ghost: "hover:bg-white/5 hover:text-bronze text-gray-400",
        link: "text-bronze underline-offset-4 hover:underline",
        bronze: "bg-bronze text-obsidian font-bold hover:bg-bronze-light shadow-lg shadow-bronze-glow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
