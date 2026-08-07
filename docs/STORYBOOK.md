# Storybook Integration — Miles Masterclass v3

## Table of Contents

- [Overview](#overview)
- [Why Storybook for This Project](#why-storybook-for-this-project)
- [Use Cases](#use-cases)
- [Benefits](#benefits)
- [Component Coverage](#component-coverage)
- [Required Data & Mocking Strategy](#required-data--mocking-strategy)
- [Getting Started](#getting-started)
- [Writing Stories Guidelines](#writing-stories-guidelines)
- [Folder Structure](#folder-structure)
- [Addons Included](#addons-included)
- [Future Roadmap](#future-roadmap)

---

## Overview

Storybook is integrated into the Miles Masterclass v3 Angular project as an **isolated component development and documentation tool**. It provides a dedicated environment to build, test, and showcase UI components outside the main application, without needing backend APIs, authentication, or routing.

**Version:** Storybook 10.x
**Framework:** `@storybook/angular`
**Angular Version:** 21.x (standalone components, signals, OnPush)
**Theme:** Dark mode (matches the project design system)

---

## Why Storybook for This Project

| Project Characteristic                                                           | Storybook Value                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **165 components** across the app                                                | Central catalog to discover and navigate all UI pieces                    |
| **45+ shared/reusable UI components** (buttons, forms, cards, dialogs, spinners) | Develop and test in isolation without navigating the full app             |
| **Custom design system** (Tailwind v4 + CSS variables) — no Material/PrimeNG     | Storybook becomes the **living design system documentation**              |
| **No visual testing infrastructure** (100 unit tests, 0 visual tests)            | Add visual regression testing and accessibility audits                    |
| **2-3 active developers**                                                        | Shared component reference reduces duplication and communication overhead |
| **Signal-based inputs/outputs** (Angular 21)                                     | Easy to control via Storybook's args/controls panel                       |

---

## Use Cases

### 1. Component Development in Isolation

**Problem:** Developing a shared component (e.g., `app-button`, `app-form-field`) requires running the full app, navigating to a page that uses it, and setting up the right state.

**Solution:** Storybook renders each component standalone. Developers can iterate on variants, sizes, and states without touching routes or services.

**Example:** The `app-progress` component has 5 variants x 4 sizes x 4 label positions x striped/animated/indeterminate toggles. Testing all combinations in the app is impractical — Storybook makes it trivial.

### 2. Living Design System Documentation

**Problem:** The project uses a custom Tailwind-based design system with CSS variables (colors, typography, spacing). There is no centralized visual reference for how components should look.

**Solution:** Storybook auto-generates interactive documentation (`autodocs`) for every component. Designers and developers can browse the full component catalog in a browser.

**What gets documented automatically:**

- All input properties with types and defaults
- Interactive controls to tweak each input in real time
- Rendered preview for every story variant

### 3. Visual Regression Testing

**Problem:** CSS changes (Tailwind config updates, design token changes) can silently break components across the app. Unit tests don't catch visual regressions.

**Solution:** Storybook enables screenshot-based visual testing. Each story becomes a visual test case that captures the component's rendered appearance.

**Tools that integrate:**

- **Chromatic** — hosted visual regression service (built by the Storybook team)
- **Storybook Test Runner** — run all stories as tests in a headless browser
- **Percy** — alternative visual testing platform

### 4. Accessibility (a11y) Auditing

**Problem:** Ensuring all components meet WCAG accessibility standards is difficult to verify manually across all variants and states.

**Solution:** The `@storybook/addon-a11y` addon (already installed) runs automated accessibility checks on every story using axe-core. Issues surface as violations directly in the Storybook panel.

**What it catches:**

- Missing ARIA labels
- Insufficient color contrast
- Missing form labels
- Keyboard navigation issues
- Role and landmark misuse

### 5. Cross-team Communication

**Problem:** When designers want to review component implementations or QA needs to understand available states, they currently need to run the full app and navigate to specific pages.

**Solution:** Storybook can be deployed as a static site (e.g., on Vercel, Netlify, or an internal server). Non-technical stakeholders can browse and interact with all components in a browser.

### 6. Onboarding New Developers

**Problem:** A new developer joining the team has no quick way to understand the component library — they need to grep through 165 components and their templates.

**Solution:** Storybook provides a navigable, categorized component catalog. New developers can explore all available components, their APIs, and their visual states in minutes.

### 7. Edge Case & State Testing

**Problem:** Some UI states are difficult to reproduce in the running app:

- Error states (network failure, 404)
- Loading states (fast connections make them invisible)
- Empty states
- Disabled/readonly form fields
- Long text overflow

**Solution:** Storybook stories can simulate any state combination by setting inputs directly, without needing to manipulate backend data.

---

## Benefits

### For Developers

- **Faster iteration** — No full app reload; hot-reload on component changes only
- **Component isolation** — Fix styling issues without worrying about parent layout side effects
- **Discoverable API** — `autodocs` generates input/output documentation from TypeScript types
- **Consistent patterns** — Stories serve as usage examples for how to consume shared components

### For the Design System

- **Single source of truth** — All component variants visible in one place
- **Token validation** — See how design tokens (colors, spacing, radius) render across all components
- **Theme testing** — Validate dark theme consistency without navigating every page

### For Quality Assurance

- **Visual coverage** — Every story is a visual test case
- **Accessibility compliance** — Automated a11y checks per component
- **State matrix testing** — Easily verify all combinations of inputs (variant x size x disabled, etc.)

### For the Team

- **Reduced duplication** — Developers find existing components before building new ones
- **Shareable documentation** — Deploy Storybook as a static site for design/QA/PM review
- **PR review context** — Link to specific stories when reviewing UI changes

---

## Component Coverage

**37 story files** | **150+ individual stories** | **6 categories**

### UI Components (10 components)

| Component    | Selector           | Stories | Key Variants                                                             |
| ------------ | ------------------ | ------- | ------------------------------------------------------------------------ |
| Button       | `app-button`       | 12      | All 7 variants, 4 sizes, disabled, showcase                              |
| Spinner      | `app-spinner`      | 8       | All 5 sizes, color variations                                            |
| Progress     | `app-progress`     | 12      | 5 variants, 4 sizes, labels, striped, indeterminate                      |
| FormField    | `app-form-field`   | 13      | text, email, password, number, textarea, select, checkbox, sizes, errors |
| ErrorState   | `app-error-state`  | 5       | network, 404, access denied, session expired                             |
| PageLoading  | `app-page-loading` | 5       | Sizes, custom messages                                                   |
| OTP          | `app-otp`          | 6       | numeric, alphanumeric, disabled, readonly                                |
| Toast        | `app-toast`        | 6       | success, error, info, non-closable, long message                         |
| Forms        | `app-forms`        | 2       | signal, model wrappers                                                   |
| Autocomplete | `app-autocomplete` | 5       | default, hint, disabled, required, empty                                 |

### Card Components (5 components)

| Component  | Selector          | Stories | Key Variants                                    |
| ---------- | ----------------- | ------- | ----------------------------------------------- |
| Vertical   | `app-vertical`    | 4       | Masterclass, podcast, micro-learning, all types |
| Horizontal | `app-horizontal`  | 4       | Masterclass, podcast, micro-learning, stacked   |
| Square     | `app-square`      | 4       | Default, variants, grid layout                  |
| ComingSoon | `app-coming-soon` | 3       | Default, second card, row                       |
| Hover      | `app-hover`       | 3       | Masterclass, podcast, micro-learning            |

### Skeleton Components (4 components)

| Component                     | Selector                               | Stories              |
| ----------------------------- | -------------------------------------- | -------------------- |
| ChapterSkeleton               | `app-chapter-skeleton`                 | 2 (single, multiple) |
| MasterclassCourseHeroSkeleton | `app-masterclass-course-hero-skeleton` | 1                    |
| PodcastCourseHeroSkeleton     | `app-podcast-course-hero-skeleton`     | 1                    |
| SliderSkeleton                | `app-slider-skeleton`                  | 1                    |

### Standalone Components (7 components)

| Component   | Selector           | Stories | Key Variants                                         |
| ----------- | ------------------ | ------- | ---------------------------------------------------- |
| Heading     | `app-heading`      | 5       | Default, subtitle, long, short, showcase             |
| MilesSlug   | `app-miles-slug`   | 4       | Masterclass, podcast, micro-learning, all            |
| RatingStar  | `app-rating-star`  | 9       | Ratings, partial, readonly, sizes, 10-star, showcase |
| RecordDisk  | `app-record-disk`  | 6       | Default, animating, disk-only, directions            |
| Backward    | `app-backward`     | 4       | Default, custom label, with route                    |
| Marquee     | `app-marquee`      | 4       | Left, right, slow, paused                            |
| CourseAbout | `app-course-about` | 3       | Masterclass, podcast, micro-learning                 |

### Dialog Components (7 components)

| Component           | Selector                          | Stories | Key Variants                               |
| ------------------- | --------------------------------- | ------- | ------------------------------------------ |
| AssessmentResult    | `app-assessment-result-dialog`    | 3       | Passed, failed, barely passed              |
| SelectCpeMode       | `app-select-cpe-mode`             | 4       | Masterclass, podcast, micro-learning, free |
| CertificateDownload | `app-certificate-download-dialog` | 3       | All certs, miles only, nasba only          |
| HtmlContent         | `app-html-content-dialog`         | 2       | Terms, privacy policy                      |
| Filter              | `app-filter-dialog`               | 2       | Default filters, with selections           |
| Share               | `app-share-dialog`                | 2       | Default, long URL                          |
| UtilsDialog         | `app-utils-dialog`                | 4       | Confirmation, info list, warning, table    |

### Layout Components (4 components)

| Component     | Selector             | Stories | Key Variants                               |
| ------------- | -------------------- | ------- | ------------------------------------------ |
| Header        | `app-header`         | 4       | Guest user, logged in, mobile, tablet      |
| Footer        | `app-footer`         | 3       | Default, mobile, tablet                    |
| FooterOverlay | `app-footer-overlay` | 1       | Default                                    |
| Notification  | `app-notification`   | 4       | Empty, success+info, multi-position, error |

### Components NOT in Storybook (browser-heavy / not suitable)

| Component                 | Reason                                          |
| ------------------------- | ----------------------------------------------- |
| `video-js`, `audio-js`    | Require video.js library and real media sources |
| `video-poster`            | Video element + IntersectionObserver + Dialog   |
| `wave-canvas`             | Canvas/requestAnimationFrame rendering          |
| `carousel`, `slider`      | Swiper library + multiple service dependencies  |
| `section-nav`             | IntersectionObserver + SectionNavService        |
| `cart-drawer-dialog`      | PaymentFacade state + Router navigation         |
| `coupon-dialog`           | PaymentFacade API calls                         |
| `firm-sponsorship-dialog` | ApiClient API calls                             |
| `video-dialog`            | Embeds video-js (browser-only)                  |
| `course-info`             | Embeds video-poster (browser-only)              |

---

## Required Data & Mocking Strategy

### Mock Data Files

Located in `src/app/shared/components/__mocks__/`:

| File               | Contents                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `content.mock.ts`  | `MOCK_MASTERCLASS_CARD`, `MOCK_PODCAST_CARD`, `MOCK_MICROLEARNING_CARD`, `MOCK_CONTENT_ABOUT`, `MOCK_CARDS` |
| `toast.mock.ts`    | `MOCK_SUCCESS_TOAST`, `MOCK_ERROR_TOAST`, `MOCK_INFO_TOAST`                                                 |
| `services.mock.ts` | `MockUtils`, `MockFeatureFacade`, `MockLogger`, `MockRouter`                                                |
| `dialog.mock.ts`   | `MockDialogRef`                                                                                             |

### Service Mocking Patterns

**For card components** (Vertical, Horizontal, Hover):

```typescript
moduleMetadata({
  providers: [
    { provide: Utils, useClass: MockUtils },
    { provide: FeatureFacade, useClass: MockFeatureFacade },
    { provide: Logger, useClass: MockLogger },
  ],
});
```

**For dialog components** (use template ref pattern):

```typescript
render: () => ({
  props: {
    init(component: MyDialog) {
      component.dialogRef = new MockDialogRef() as any;
      component.data = {/* dialog data */};
    },
  },
  template: `<app-my-dialog #comp />{{ init(comp) }}`,
});
```

**For layout components** (Header, Footer):

```typescript
moduleMetadata({
  imports: [RouterModule.forRoot([], { initialNavigation: 'disabled' as any })],
  providers: [
    { provide: Auth, useClass: MockAuth },
    { provide: Domain, useClass: MockDomain },
  ],
});
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Project dependencies installed (`pnpm install`)

### Run Storybook

```bash
pnpm storybook
```

This starts Storybook on `http://localhost:6006` by default with dark mode enabled.

### Build Static Storybook (for deployment)

```bash
pnpm build-storybook
```

Output goes to `storybook-static/` — deploy this folder to any static hosting.

### Run in Parallel with Dev Server

```bash
# Terminal 1 — App dev server
pnpm start

# Terminal 2 — Storybook
pnpm storybook
```

---

## Writing Stories Guidelines

### File Naming

Stories are co-located with their components:

```
src/app/shared/components/ui/button/
  button.ts
  button.html
  button.css
  button.stories.ts    <-- Story file
  button.spec.ts       <-- Unit test
```

### Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { MyComponent } from './my-component';

const meta: Meta<MyComponent> = {
  title: 'Category/ComponentName', // Sidebar navigation path
  component: MyComponent,
  tags: ['autodocs'], // Auto-generate docs page
  argTypes: {
    inputName: {
      control: 'select',
      options: ['option1', 'option2'],
      description: 'What this input does',
    },
  },
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    inputName: 'option1',
  },
};
```

### Category Naming Convention

| Category      | Components                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| `UI/`         | Primitive components (Button, Spinner, Progress, FormField, OTP, Toast, etc.) |
| `Cards/`      | Card variants (Vertical, Horizontal, Square, Hover, ComingSoon)               |
| `Components/` | Standalone shared components (Heading, RatingStar, RecordDisk, Marquee, etc.) |
| `Skeleton/`   | Loading skeleton placeholders                                                 |
| `Dialog/`     | Modal dialogs (AssessmentResult, Filter, Share, CertificateDownload, etc.)    |
| `Layout/`     | Header, Footer, FooterOverlay, Notification                                   |

### Tips for Angular Signal-Based Components

- Use `args` for signal inputs — Storybook maps them correctly
- For `model()` two-way bindings, use `args` with the model name
- For `output()` events, log to the actions panel:
  ```typescript
  export const WithAction: Story = {
    args: { variant: 'default' },
    render: (args) => ({
      props: { ...args, onClicked: ($event: any) => console.log('clicked', $event) },
      template: `<app-button [variant]="variant" (clicked)="onClicked($event)">Click Me</app-button>`,
    }),
  };
  ```

---

## Folder Structure

```
miles-masterclass-v3/
├── .storybook/
│   ├── main.ts              # Storybook config (stories glob, addons, framework)
│   ├── manager.ts           # Manager UI config (dark theme)
│   ├── preview.ts           # Global parameters (dark background, docs theme)
│   ├── tsconfig.json        # TypeScript config for Storybook
│   ├── tsconfig.doc.json    # TypeScript config for docs
│   └── typings.d.ts         # Module declarations (videojs-youtube, etc.)
├── src/
│   ├── app/
│   │   ├── layout/
│   │   │   ├── header/header.stories.ts
│   │   │   ├── footer/footer.stories.ts
│   │   │   └── footer-overlay/footer-overlay.stories.ts
│   │   └── shared/components/
│   │       ├── __mocks__/               # Shared mock data & services
│   │       │   ├── content.mock.ts
│   │       │   ├── toast.mock.ts
│   │       │   ├── services.mock.ts
│   │       │   └── dialog.mock.ts
│   │       ├── ui/                      # 10 UI component stories
│   │       ├── cards/                   # 5 card component stories
│   │       ├── skeleton/                # 4 skeleton component stories
│   │       ├── dialog/                  # 7 dialog component stories
│   │       ├── heading/heading.stories.ts
│   │       ├── rating-star/rating-star.stories.ts
│   │       ├── record-disk/record-disk.stories.ts
│   │       ├── marquee/marquee.stories.ts
│   │       ├── backward/backward.stories.ts
│   │       ├── miles-slug/miles-slug.stories.ts
│   │       ├── course-about/course-about.stories.ts
│   │       └── notification/notification.stories.ts
```

---

## Addons Included

| Addon                         | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `@storybook/addon-docs`       | Auto-generated documentation pages from component metadata and stories |
| `@storybook/addon-a11y`       | Accessibility auditing (axe-core) on every story                       |
| `@storybook/addon-onboarding` | First-run onboarding guide for new Storybook users                     |

### Recommended Future Addons

| Addon                           | Purpose                                                         | When to Add                                   |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `@storybook/addon-interactions` | Test user interactions (click, type, hover) directly in stories | When Storybook 10-compatible version releases |
| `@chromatic-com/storybook`      | Visual regression testing in CI                                 | When ready to integrate into CI pipeline      |

---

## Future Roadmap

### Completed

1. **Phase 1:** UI primitive components — 10 components, 74 stories
2. **Phase 2:** Card components — 5 components, 18 stories + mock data factories
3. **Phase 3:** Standalone components — 7 components, 35 stories
4. **Phase 4:** Dialog components — 7 components, 20 stories
5. **Phase 5:** Skeleton loaders — 4 components, 5 stories
6. **Phase 6:** Layout components — 4 components (Header, Footer, FooterOverlay, Notification), 12 stories + responsive viewport stories
7. **Dark mode** — Storybook UI, docs, and canvas all default to dark theme

### Next Steps

1. **Deploy Storybook** — Build static site (`pnpm build-storybook`) and deploy to Vercel/Netlify for team-wide access
2. **CI integration** — Add `build-storybook` to CI pipeline to catch story compilation errors on every PR
3. **Visual regression testing** — Integrate Chromatic or Storybook Test Runner for automated screenshot diffs
4. **Interaction testing** — Add `@storybook/addon-interactions` once the Storybook 10-compatible version releases, to test click/type/hover flows
5. **Expand coverage** — Add stories for feature-level page components as they stabilize
