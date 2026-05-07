import { cn } from "@/lib/utils/cn";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const dimensions = {
    sm: { mark: 24, text: "text-base" },
    md: { mark: 30, text: "text-lg" },
    lg: { mark: 40, text: "text-2xl" },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={dimensions.mark}
        height={dimensions.mark}
        viewBox="395 395 115 115"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Optified"
      >
        <path
          fill="currentColor"
          d="M470.74,404.16l-34.1,41.57,6.1,7.14c7.22,8.45,7.22,20.9,0,29.35l-2.88,3.37-33.86-39.9,31.25-38.12c1.77-2.15,4.41-3.4,7.19-3.4h26.3Z"
        />
        <path
          fill="currentColor"
          d="M512.9,445.69l-32.49,38.28c-1.77,2.08-4.36,3.28-7.09,3.28h-26.55l35.48-41.51-6.96-8.48c-6.83-8.33-6.83-20.32,0-28.65l3.6-4.39,34,41.47Z"
        />
      </svg>
      {showWordmark && (
        <>
          <span className={cn("font-extrabold tracking-tight", dimensions.text)}>
            Optified
          </span>
          <span className="text-overline text-muted-foreground ml-0.5">
            Medical
          </span>
        </>
      )}
    </div>
  );
}
