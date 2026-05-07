import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 tracking-tight",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-cloud/90 shadow-elevation-1",
        success:
          "bg-success text-navy-900 hover:bg-success/90 shadow-glow-success",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-card/60 hover:border-navy-400",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-card/40",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the Button merges its styling onto its single child instead
   * of rendering a <button>. Use for wrapping <a>, <Link>, etc.
   *
   *   <Button asChild><Link href="/foo">Go</Link></Button>
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      // Merge our className onto the single child. Type cast is safe
      // because we've already validated it's a valid React element.
      const child = children as React.ReactElement<{
        className?: string;
      }>;
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
      } as React.HTMLAttributes<HTMLElement>);
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
