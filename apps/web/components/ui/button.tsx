import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F3F0EE] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-btn border-[1.5px]",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-[#F3F0EE] border-ink shadow-sm hover:bg-ink/90 active:scale-[0.99]",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
        outline:
          "border-ink bg-white text-ink hover:bg-lifted",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
        ghost: "border-transparent bg-transparent hover:bg-secondary text-foreground",
        link: "border-transparent text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-6 py-1.5 text-base tracking-tight",
        sm:      "h-8 rounded-btn px-4 text-xs font-medium",
        lg:      "h-12 rounded-[1.5rem] px-10 text-base font-medium",
        icon:    "h-9 w-9 rounded-full border-ink",
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
