# Miles Masterclass V3.

> **Status (2026-09-03):** this repo has been stripped to the admin panel only (`src/app/admin/` plus the `src/app/shared/` files it depends on). The learner site, auth, payment, blog, partner pages, SEO, analytics and Storybook were removed and will be rebuilt against a new backend. Sections below describing the public site, its routes and structure are historical until rewritten.

Miles Masterclass V3 is a cutting-edge educational platform built with **Angular (v21)**, designed to deliver high-performance, SEO-optimized content through **Server-Side Rendering (SSR)** and **Hydration**.

The application offers a tailored learning experience, dynamically routing users to content specific to their **Country** and **Profession** (e.g., `/in/accounting`, `/us/cpa`).

## 🚀 Key Features

- **Modern Tech Stack**: Built on Angular v21 with Signals for state management and Standalone Components.
- **Dynamic Localization**: Context-aware routing (`/:country/:profession_type`) ensures users see relevant content.
- **Hybrid Rendering**: Optimized performance using a mix of SSR, Prerendering (SSG), and Client-Side Rendering (CSR).
- **Immersive Video Player**: Integrated **Video.js** player with custom controls and YouTube support forMaster Classes.
- **Production Ready**: Docker support and environment-specific configurations (`local`, `development`, `production`).

---

## 💻 Tech Stack

- **Framework**: [Angular v21](https://angular.dev) (Signals, Control Flow, SSR)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) (via PostCSS)
- **Icons**: `@ng-icons` (Heroicons, Material Symbols, etc.)
- **Video**: `video.js` & `videojs-youtube`
- **State Management**: Angular Signals & RxJS
- **Backend/SSR**: Express.js

---

## 📂 Project Structure

The project follows a modular "Features" architecture:

```
src/app/
├── core/               # Singleton services, guards, interceptors, and models
│   ├── guards/         # e.g., validate-profession-country.guard
│   ├── services/       # Global API services
│   └── tokens/         # Injection tokens
├── features/           # Domain-specific feature modules
│   ├── home/           # Landing page content
│   ├── offerings/      # Educational products (Masterclass, Podcast, etc.)
│   │   ├── masterclass/
│   │   ├── podcast/
│   │   ├── webinar/
│   │   └── micro-learning/
│   └── payment/        # Checkout flows
│       ├── cart/
│       ├── invoice/
│       ├── orders/
│       └── plan/
├── layout/             # Main app shell (Header, Footer, Nav)
├── shared/             # Reusable UI components (Buttons, Cards, Inputs)
└── app.routes.ts       # Main routing configuration
```

---

## 🚦 Routing Architecture

The application uses a **hierarchical routing strategy**:

1.  **Root Redirect**: The empty path `''` is guarded and redirects users to a default or detected country/profession.
2.  **Dynamic Wrapper**: The core application logic lives under `:country/:profession_type`.
3.  **Feature Routes**: Child routes define the actual content pages.

**Example URLs:**

- `/in/accounting/home` -> Indian Accounting Home Page (SSR)
- `/us/cpa/masterclass/123/audit-basics` -> Specific Course Detail (SSR)
- `/in/accounting/checkout` -> Payment Flow (Client-Side, No SEO)

### Guards

- `rootRedirectGuard`: Handles the default redirection logic.
- `validateProfessionCountryGuard`: Ensures the provided `:country` and `:profession_type` params are valid. If not, redirects to 404.

---

## ⚡ Angular Rendering Strategies (Hybrid)

This project is configured to use different rendering modes depending on the route type to balance **SEO** (Search Engine Optimization) with **Server Load**.

### Core Concepts

- **SSR (Server-Side Rendering)**: HTML generated on request. Best for dynamic, SEO-heavy pages.
- **SSG (Prerendering)**: HTML generated at build time. Best for static landing pages.
- **CSR (Client-Side Rendering)**: HTML generated in browser. Best for private/interactive pages (Checkout).

### Configuration (`src/app/app.routes.server.ts`)

We follow a **Recommended Hybrid Strategy**:

```typescript
export const serverRoutes: ServerRoute[] = [
  // 1. Static Content (SSG)
  { path: 'page-not-found', renderMode: RenderMode.Prerender },

  // 2. High-Performance Landing Pages (SSG)
  // We prerender top priority landing pages for instant load
  {
    path: ':country/:profession_type',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      // Return list of known combos: [{ country: 'in', profession_type: 'accounting' }]
      return [];
    },
  },

  // 3. Interactive/Private Flows (Client-Side Only)
  // Skipping server rendering saves resources for checkout
  {
    path: ':country/:profession_type/checkout',
    renderMode: RenderMode.Client,
  },

  // 4. Default / Fallback (SSR)
  // Handles deep links, masterclass details, and any param combo not prerendered
  { path: '**', renderMode: RenderMode.Server },
];
```

---

## 🛠 Development

### Prerequisites

- **Node.js**: v20.17.0 or higher
- **pnpm**: 10+

### Installation

```bash
pnpm install
```

### Running the Application

| Environment     | Command           | Port   | Description                       |
| :-------------- | :---------------- | :----- | :-------------------------------- |
| **Local**       | `pnpm start`      | `4100` | Uses `environment.local.ts`       |
| **Development** | `pnpm start:dev`  | `4100` | Uses `environment.development.ts` |
| **Production**  | `pnpm start:prod` | `4100` | Uses `environment.ts` (simulated) |

> **Note**: These commands run `ng serve`. For SSR testing, use `pnpm serve:ssr:miles-masterclass-v3`.

### Docker Support

To run the application using Docker:

```bash
docker-compose up --build
```

This will start the application on port **4000** (as configured in `docker-compose.yml`).

---

## 🎨 Styling

- **Tailwind CSS**: Utility-first CSS framework for rapid UI development.
- **Custom Styles**: Global overrides in `src/styles/styles.css`.
- **Component Styles**: Scoped CSS for encapsulation.

---

For more help with Angular CLI, use `ng help` or check out the [Angular CLI Documentation](https://angular.dev/tools/cli).
