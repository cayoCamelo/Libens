import { cn } from "@/lib/utils";

export function LibensLogo({
  compacto = false,
  className,
}: {
  compacto?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.7rem] bg-primary text-sm font-bold text-primary-foreground"
      >
        L
      </span>
      {!compacto ? (
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Libens
        </span>
      ) : (
        <span className="font-display text-sm font-semibold tracking-wide text-muted-foreground">
          Libens
        </span>
      )}
    </span>
  );
}
