import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

/** A security / compliance document available for preview + download. */
interface ComplianceDocument {
  title: string;
  /** Short context line shown under the title in the rail. */
  description: string;
  /** Absolute URL to the PDF on the CDN. */
  url: string;
}

/** CDN folder holding the security-documentation PDFs. */
const SECURITY_DOCS_BASE = `${environment.S3_BUCKET_URL}static-assests/web-app/security-documentation/`;

@Component({
  selector: 'app-compliance',
  imports: [],
  templateUrl: './compliance.html',
  styleUrl: './compliance.css',
})
export class Compliance {
  private readonly sanitizer = inject(DomSanitizer);

  /** Security & compliance PDFs, served from the CDN security-documentation folder. */
  protected readonly documents: readonly ComplianceDocument[] = [
    {
      title: 'Security Architecture Overview',
      description: 'How our platform is built and secured end to end.',
      url: `${SECURITY_DOCS_BASE}01_Security_Architecture_Overview.pdf`,
    },
    {
      title: 'SOC 2, GDPR & DPDP Compliance Mapping',
      description: 'How our controls map to SOC 2, GDPR and DPDP requirements.',
      url: `${SECURITY_DOCS_BASE}02_SOC2_GDPR_DPDP_Compliance_Mapping.pdf`,
    },
    {
      title: 'Incident Response Plan',
      description: 'How we detect, respond to and recover from security incidents.',
      url: `${SECURITY_DOCS_BASE}03_Incident_Response_Plan.pdf`,
    },
    {
      title: 'Written Information Security Program (WISP)',
      description: 'Our documented information security policies and safeguards.',
      url: `${SECURITY_DOCS_BASE}04_Written_Information_Security_Program_WISP.pdf`,
    },
  ];

  /** URL of the document currently shown in the preview pane (defaults to the first). */
  protected readonly activeUrl = signal<string>(this.documents[0].url);

  /** Full document record for the active URL — powers the mobile "tap to open" card. */
  protected readonly activeDoc = computed<ComplianceDocument>(
    () => this.documents.find((d) => d.url === this.activeUrl()) ?? this.documents[0],
  );

  /**
   * Trusted iframe `src` for the active PDF. Angular blocks raw URLs on
   * `<iframe [src]>`; the URL is our own CDN constant (no user input), so
   * bypassing resource-URL sanitization here is safe.
   */
  protected readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.activeUrl()),
  );

  protected select(doc: ComplianceDocument): void {
    this.activeUrl.set(doc.url);
  }
}
