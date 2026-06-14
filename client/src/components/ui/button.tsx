import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { m, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

const MotionButton = m.button as React.ForwardRefExoticComponent<any>

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[var(--primary-active)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-canvas text-ink hover:bg-surface-card",
        secondary:
          "bg-surface-card text-ink hover:bg-surface-strong",
        onColor:
          "bg-canvas text-ink hover:bg-surface-soft",
        ghost: "text-ink hover:bg-surface-card",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-3",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-7 text-[15px]",
        icon: "size-11",
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
  disableMotion?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disableMotion = false, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion()
    const Comp = asChild ? Slot : "button"
    const classes = cn(buttonVariants({ variant, size, className }))

    if (!asChild && !disableMotion && !shouldReduceMotion) {
      return (
        <MotionButton
          className={classes}
          ref={ref}
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.6 }}
          {...props}
        />
      )
    }

    return (
      <Comp
        className={classes}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
