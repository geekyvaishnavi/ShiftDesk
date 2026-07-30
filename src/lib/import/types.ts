/// Every row leaves the pipeline as exactly one of these.
export type RowOutcome<T> =
  | { status: "accepted"; line: number; raw: string; data: T }
  | { status: "merged"; line: number; raw: string; mergedInto: string; reason: string }
  | { status: "rejected"; line: number; raw: string; reason: string };

export type ImportResult<T> = {
  outcomes: RowOutcome<T>[];
  accepted: number;
  merged: number;
  rejected: number;
};

/// Returned when the header itself is wrong, so no rows are processed.
export type HeaderError = { error: string };
