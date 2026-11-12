/**
 * The reel player's own UI types. The reel itself is `Reel`
 * (`models/reel.model.ts`), built from the web API's feed.
 */

export interface MicroLearningFilterOption {
  id: string;
  label: string;
  selected: boolean;
}

/** Option keys exposed by the inline reel-card menu. */
export type MicroLearningOptionId = 'about' | 'transcript' | 'glossary';
