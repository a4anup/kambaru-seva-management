"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/Input";

export function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      id={id}
      name="password"
      type={visible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Enter your password"
      autoComplete="current-password"
      aria-invalid={invalid}
      aria-describedby={describedBy}
      leadingIcon={<LockKeyhole size={19} />}
      className={className}
      trailingAction={
        <button
          className="input-icon-button"
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      }
    />
  );
}
