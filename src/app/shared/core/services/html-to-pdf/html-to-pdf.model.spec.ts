import { autoPageFormatMm, MM_TO_PX } from './html-to-pdf.model';

const NO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };

describe('autoPageFormatMm', () => {
  it('sizes the page so the image fills it exactly — no letterboxing, no second page', () => {
    // 1280px-wide clone captured at quality 2 → 2560x5000 canvas
    const [w, h] = autoPageFormatMm(1280, 2560, 5000, NO_MARGINS);

    expect(w).toBeCloseTo(1280 / MM_TO_PX, 3); // 338.67mm
    // The image is drawn at `imgWidth = w`, so its height must equal the page height
    expect(h).toBeCloseTo((5000 * w) / 2560, 6);
  });

  it('is independent of capture scale — quality only changes sharpness, not page size', () => {
    const at1x = autoPageFormatMm(1280, 1280, 2500, NO_MARGINS);
    const at3x = autoPageFormatMm(1280, 3840, 7500, NO_MARGINS);

    expect(at3x[0]).toBeCloseTo(at1x[0], 6);
    expect(at3x[1]).toBeCloseTo(at1x[1], 6);
  });

  it('adds margins on top of the content box', () => {
    const bare = autoPageFormatMm(1280, 2560, 5000, NO_MARGINS);
    const [w, h] = autoPageFormatMm(1280, 2560, 5000, { top: 5, right: 4, bottom: 3, left: 2 });

    expect(w).toBeCloseTo(bare[0] + 6, 6);
    expect(h).toBeCloseTo(bare[1] + 8, 6);
  });
});
