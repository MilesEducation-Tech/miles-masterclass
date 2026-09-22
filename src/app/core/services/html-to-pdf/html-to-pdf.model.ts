/** `Auto` = one page sized exactly to the captured content (no pagination). */
export type PageSize = 'A4' | 'Letter' | 'Legal' | 'Auto';
export type Orientation = 'portrait' | 'landscape';

export interface PdfMargins {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface PdfExclude {
  /** Element IDs to hide in the PDF output */
  ids?: string[];
  /** CSS class names to hide in the PDF output */
  classes?: string[];
  /** CSS selectors to hide in the PDF output */
  selectors?: string[];
}

export interface PdfOptions {
  filename?: string;
  pageSize?: PageSize;
  orientation?: Orientation;
  /** Margins in mm (default 0 on all sides) */
  margins?: PdfMargins;
  /** Canvas render scale – higher = sharper but larger file (default 2) */
  quality?: number;
  /** JPEG compression quality 0–1 (default 0.92). Lower = smaller file. */
  imageQuality?: number;
  /** Elements/classes/selectors to exclude from the PDF */
  exclude?: PdfExclude;
  /** Whether to auto-download the file (default true). If false, returns the blob. */
  autoDownload?: boolean;
}

export interface ResolvedPdfOptions {
  filename: string;
  pageSize: PageSize;
  orientation: Orientation;
  margins: Required<PdfMargins>;
  quality: number;
  imageQuality: number;
  exclude: PdfExclude;
  autoDownload: boolean;
}

export interface BatchPdfItem {
  element: HTMLElement | string;
  options?: PdfOptions;
}

export interface PdfLifecycleHooks {
  beforeGenerate?: () => void | Promise<void>;
  afterGenerate?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

/** mm → CSS px at 96 DPI */
export const MM_TO_PX = 96 / 25.4;

/**
 * `pageSize: 'Auto'` page format in mm: content width at 96 DPI, height from the
 * capture's aspect ratio, plus margins. Sized so the image fills exactly one page.
 */
export function autoPageFormatMm(
  contentWidthPx: number,
  canvasWidth: number,
  canvasHeight: number,
  margins: Required<PdfMargins>,
): [number, number] {
  const widthMm = contentWidthPx / MM_TO_PX;
  return [
    widthMm + margins.left + margins.right,
    (canvasHeight * widthMm) / canvasWidth + margins.top + margins.bottom,
  ];
}

/** Page dimensions in mm */
export const PAGE_SIZE_MM: Record<Exclude<PageSize, 'Auto'>, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};
