import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-6 mb-10", className)}>
      <div className="space-y-2">
        {eyebrow && <div className="overline">{eyebrow}</div>}
        <h1 className="text-h1">{title}</h1>
        {description && (
          <p className="text-body-lg text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
