// Logo tipográfico de JornalPro. Casco de obra estilizado + libretita.

import { cn } from "@/lib/utils";

export function Logo({ className, variant = "horizontal", invertOnDark = true }) {
  const mark = (<span
      className={cn("flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm",className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        {/* Casco de obra */}
        <path
          d="M3 14a9 9 0 0 1 18 0v2H3v-2Z"
          fill="currentColor"
        />
        <rect x="2" y="14" width="20" height="2.5" rx="1" fill="currentColor" />
        {/* Libretita al costado */}
        <path
          d="M14 4.5h6.5v15H14z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="hsl(var(--primary-foreground))"
          fillOpacity="0.25"
        />
        <path d="M16 8h3M16 11h3M16 14h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>);

  if (variant === "mark") return mark;

  return (<span
      className={cn("flex items-center gap-2 select-none",variant === "vertical" && "flex-col text-center",className,
      )}
    >
      {mark}
      <span
        className={cn("display text-lg font-bold tracking-tight",invertOnDark && "dark:text-foreground text-foreground",
        )}
      >
        JornalPro
      </span>
    </span>);
}
