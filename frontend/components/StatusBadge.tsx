export type DisplayStatus = "Ready" | "Pending" | "To Dispatch" | "Dispatched" | "Exception" | "Active" | "Paused" | "Cancelled";

export function StatusBadge({ status, className = "" }: { status: DisplayStatus; className?: string }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status status-${statusClass} ${className}`.trim()}>{status}</span>;
}
