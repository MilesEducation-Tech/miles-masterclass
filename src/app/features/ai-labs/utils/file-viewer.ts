import { AiLabFile } from '@features/ai-labs/models/ai-labs.model';

/**
 * The viewer tab a brief file opens in — v3's `openBriefPreview`. A signed S3 link opened directly
 * downloads itself, so the tab shows the file instead (an image inline, a PDF framed) under a
 * Download link the learner chooses to click. A type the browser can't show gets the link alone.
 *
 * Built with DOM calls only, never an HTML string, so nothing from the API is parsed as markup.
 */

/** Google's preview, when it comes up blank: how often to ask again, and how many times. */
const PREVIEW_RETRY_MS = 4_000;
const PREVIEW_RETRIES = 5;

/** How a file can be shown in the tab — `null` means Download only. */
function previewKind(file: AiLabFile): 'image' | 'pdf' | null {
  const type = (file.content_type ?? '').toLowerCase();
  const docType = file.doc_type.toLowerCase();
  const name = (file.filename ?? '').toLowerCase();
  if (
    type.startsWith('image/') ||
    ['image', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(docType)
  )
    return 'image';
  if (type === 'application/pdf' || docType === 'pdf' || name.endsWith('.pdf')) return 'pdf';
  return null;
}

/** The disposition a presigned link was signed with (`inline` / `attachment`), else ''. */
function signedDisposition(url: string): string {
  try {
    return (new URL(url).searchParams.get('response-content-disposition') ?? '')
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Fill `tab` with the viewer for `url`. A PDF is read and re-served as a blob typed
 * `application/pdf`, so it shows whatever headers the bucket sends — plain `fetch` with no
 * credentials, never `ApiClient`, so our auth header can't reach S3. When the bucket refuses our
 * origin (CORS), Google's viewer renders it instead, which hands Google the ~15-minute link: v3's
 * agreed interim until AI Labs signs these `inline` or opens CORS.
 */
export async function renderFileViewer(
  tab: Window,
  url: string,
  file: AiLabFile,
  label: string,
  labName: string,
): Promise<void> {
  const kind = previewKind(file);
  // What the viewer shows, and what Download saves — the original link unless read into a blob.
  let src = url;
  let downloadHref = url;
  if (kind === 'pdf' && !signedDisposition(url).startsWith('inline')) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = new Blob([await res.blob()], { type: 'application/pdf' });
      // The tab's own URL object, so the blob lives as long as the tab does.
      src = downloadHref = (tab as Window & typeof globalThis).URL.createObjectURL(blob);
    } catch {
      // `/viewer?embedded=true`, not `/gview`: the latter refuses to be framed.
      src = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`;
    }
  }
  if (tab.closed) return;

  const doc = tab.document;
  doc.title = `${labName} — ${label.toLowerCase()}`;
  doc.body.style.cssText =
    'margin:0;min-height:100vh;box-sizing:border-box;padding:24px;background:#0e0e0e;' +
    'color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif;display:flex;' +
    'flex-direction:column;align-items:center;gap:16px';

  const bar = doc.createElement('div');
  bar.style.cssText =
    'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;gap:16px';
  const title = doc.createElement('p');
  title.style.cssText = 'margin:0;font-size:15px;font-weight:600';
  title.textContent = `${labName} · ${label}`;
  const download = doc.createElement('a');
  download.href = downloadHref;
  download.setAttribute('download', file.filename ?? label.toLowerCase());
  download.textContent = 'Download';
  download.style.cssText =
    'padding:10px 16px;border-radius:8px;background:#fff;color:#000;font-size:14px;' +
    'font-weight:600;text-decoration:none';
  bar.append(title, download);

  let body: HTMLElement;
  if (kind === 'image') {
    const img = doc.createElement('img');
    img.src = src;
    img.alt = `${label} for ${labName}`;
    img.style.cssText = 'max-width:min(100%,1200px);height:auto;border-radius:12px;background:#fff';
    body = img;
  } else if (kind === 'pdf') {
    const frame = doc.createElement('iframe');
    frame.src = src;
    frame.title = `${label} for ${labName}`;
    frame.style.cssText =
      'width:100%;max-width:1200px;height:calc(100vh - 120px);border:0;border-radius:12px;background:#fff';
    body = frame;
    if (src !== downloadHref) keepPreviewLoading(tab, frame, src);
  } else {
    body = doc.createElement('p');
    body.style.cssText = 'margin:48px 0 0;font-size:14px;color:#a1a1a1;text-align:center';
    body.textContent = `${file.filename ?? label} can't be previewed here — use Download to save it.`;
  }
  doc.body.replaceChildren(bar, body);
}

/**
 * Google's viewer now and then comes up blank on a first load. A blank answer leaves the frame on
 * our own empty page — same-origin, so `contentDocument` is readable; once Google's document is in,
 * it reads `null`. Re-asked every few seconds, a handful of times at most.
 */
function keepPreviewLoading(tab: Window, frame: HTMLIFrameElement, src: string): void {
  let tries = 0;
  const timer = tab.setInterval(() => {
    if (tab.closed || frame.contentDocument === null || tries >= PREVIEW_RETRIES) {
      tab.clearInterval(timer);
      return;
    }
    tries++;
    frame.src = src;
  }, PREVIEW_RETRY_MS);
}
