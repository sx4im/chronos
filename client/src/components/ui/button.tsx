import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { m, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

const MotionButton = m.button as React.ForwardRefExoticComponent<any>

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground btn-fill-up btn-fill-gold",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background btn-fill-up btn-fill-gold",
        secondary:
          "bg-secondary text-secondary-foreground btn-fill-up btn-fill-gold",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "size-10",
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
