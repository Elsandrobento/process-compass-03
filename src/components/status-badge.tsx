import { STATUS_LABEL, statusColor } from "@/lib/process-labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusColor(status),
        className,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "alta" ? "bg-destructive" : priority === "media" ? "bg-warning" : "bg-muted-foreground";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} aria-hidden />;
}
