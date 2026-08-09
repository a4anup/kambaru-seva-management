import type { ChangeEventHandler, InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { formatDisplayDate } from "@/lib/date-format";

type FormattedDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  showIcon?: boolean;
};

export function FormattedDateInput({ className = "", value, onChange, showIcon = true, ...props }: FormattedDateInputProps) {
  return (
    <span className={`formatted-date-input ${className}`.trim()}>
      <span className={!value ? "formatted-date-placeholder" : ""} aria-hidden="true">
        {value ? formatDisplayDate(value) : "DD-MMM-YYYY"}
      </span>
      {showIcon && <CalendarDays size={17} aria-hidden="true" />}
      <input {...props} type="date" value={value} onChange={onChange} />
    </span>
  );
}
