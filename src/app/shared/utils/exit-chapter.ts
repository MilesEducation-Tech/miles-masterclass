import { Router } from '@angular/router';

/**
 * Navigate from a chapter player URL up to its course detail page.
 *
 * Route shape: `.../:courseId/:courseTitle/chapter/:chapterId/:chapterTitle`
 * → drop the trailing `chapter/:chapterId/:chapterTitle`.
 *
 * Shared by the masterclass and podcast chapter pages, each of which needs it
 * on two paths (logout, and the access-control gate), so the segment maths
 * lives in one place instead of four copies.
 */
export function exitChapterToCourse(router: Router): void {
  const urlTree = router.parseUrl(router.url);
  const segments = urlTree.root.children['primary']?.segments;
  if (!segments || segments.length < 3) return;
  segments.splice(segments.length - 3, 3);
  router.navigateByUrl(urlTree);
}
