import { BadgeItem } from '../../../../shared/core/models/caira/cpe.model';

export type ButtonKind =
  'registered' | 'resume' | 'exam' | 'retake' | 'feedback' | 'download' | 'view-details' | 'none';

/** A field-of-study chip on a tracker row. */
export interface TrackerFieldOfStudy {
  id: string | number;
  name: string;
  cpe_credits?: number;
}

/**
 * One row of the tracker table.
 *
 * Built by `badgeToTableRow` from #23's badge rows. The Django-era
 * `reportToTable` that also produced this shape is gone — CAIRA aggregates by
 * level and badge, not by the `transaction_type` / `master_class` /
 * `all_classes_completed` report row that mapper read.
 */
export interface TrackerTableRow {
  key: string;
  /** Widened from `number` for CAIRA (Decision 8): badge ids are strings. */
  id: string | number | null;
  courseName: string;
  /** Empty on every CAIRA row — #23 carries no breakdown (G-38). */
  fieldsOfStudy: TrackerFieldOfStudy[];
  deliveryMethod: string;
  totalCredits: number;
  completedAt: string | null;
  registeredAt: string | null;
  cairaLevel: number | null;
  actionKind: ButtonKind;
  /** The badge the row was built from — the row actions read its URLs. */
  raw: BadgeItem;
}
