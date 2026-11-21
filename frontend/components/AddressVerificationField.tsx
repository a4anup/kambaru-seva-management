"use client";

import type { AddressVerificationStatus } from "@kambaru/backend";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/StatusBadge";

export function AddressVerificationBadge({
  status,
  className = "",
}: {
  status: AddressVerificationStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status === "unverified" ? "Unverified" : "Verified"}
      className={className}
    />
  );
}

export function AddressVerificationField({
  id,
  status,
  reason,
  onStatusChange,
  onReasonChange,
  className = "",
}: {
  id: string;
  status: AddressVerificationStatus;
  reason: string;
  onStatusChange: (status: AddressVerificationStatus) => void;
  onReasonChange: (reason: string) => void;
  className?: string;
}) {
  return (
    <div className={`address-verification-fields ${className}`.trim()}>
      <FormField id={`${id}-status`} label="Address verification">
        <select
          className="form-control"
          id={`${id}-status`}
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as AddressVerificationStatus)
          }
          aria-describedby={`${id}-help`}
        >
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </FormField>
      <small id={`${id}-help`}>
        Verified means approved for dispatch. Mark Unverified if prasada is
        returned. Address corrections keep this status until you change it.
      </small>
      <FormField id={`${id}-reason`} label="Verification reason (optional)">
        <textarea
          className="form-control"
          id={`${id}-reason`}
          maxLength={500}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </FormField>
    </div>
  );
}
