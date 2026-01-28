# Frontend Agent Guidelines

## Core Philosophy

The frontend is the "Brain" of the application. It acts as a **Thick Client**,
meaning it downloads all historical events and projects them locally to build
the application state.

### Mobile-First & Responsive Design

**CRITICAL:** The application is primarily used on **mobile devices and
tablets** (e.g., at the tennis table).

- All new features MUST be mobile-friendly and responsive.
- UI elements should be touch-friendly.
- Use Tailwind CSS responsive utilities (`xs:`, `sm:`, `md:`, `lg:`) to ensure
  layouts work across all screen sizes.
- Test changes using browser mobile emulation before finalizing.

### Custom Theming & Colors

The application uses a CSS variable-based theming system (defined in
`tailwind.config.js` and `src/index.css`). **Always prioritize using these theme
classes over hardcoded colors.**

- **Primary:** `text-primary-text` and `bg-primary-background`
- **Secondary:** `text-secondary-text` and `bg-secondary-background`
- **Tertiary:** `text-tertiary-text` and `bg-tertiary-background`

These colors change based on the active client theme (e.g., Skimore, Asplan
Viak, or seasonal themes like Easter/Halloween). Hardcoding hex codes or
standard Tailwind colors (like `bg-blue-500`) will break the theme consistency.

### Custom Tailwind Breakpoints

In addition to the default Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`),
the app defines a custom `xs` breakpoint:

- **`xs`:** 470px

Use `xs:` for layouts that should switch earlier than the default `sm` (640px).
Example: `xs:flex-row` to go horizontal at 470px instead of 640px.

## Architecture

### The `TennisTable` Class

- Located at `src/client/client-db/tennis-table.ts`.
- This is the **Source of Truth** for the runtime state.
- It initializes sub-modules (e.g., `Leaderboard`, `PVP`, `Tournaments`) which
  encapsulate specific domain logic.
- **Usage:** Components access data via this class instance, not by making
  individual API calls for derived data.

### Event Flow

1. **Event Received:** Via initial load or WebSocket.
2. **Projection:** The `TennisTable` class (and its sub-modules) processes the
   event.
3. **State Update:** The calculated state (e.g., a player's new Elo) is updated
   in memory.
4. **UI Render:** React components react to changes in this projected data.

### Web Workers

Heavy simulations (like `simulations.ts` or future Elo predictions) are
offloaded to Web Workers to keep the UI responsive.

## Workflows

### 1. Adding a Feature

- **Data Requirement:**
  - If it requires new data, define a new `EventType` in
    `src/client/client-db/event-store/event-types.ts`.
  - Implement the logic to handle this event in the appropriate sub-module of
    `TennisTable`.
- **UI Implementation:**
  - Create React components using Tailwind CSS.
  - Access data via the `TennisTable` instance contexts.

### 2. Testing

- **Command:** `npm run test` (Runs Jest).
- **Scope:** Focus on unit testing the logic in `client-db` (the projections)
  and component tests for UI.
- **Convention:** Tests are co-located or in `__tests__` directories.

### 3. Linting & Formatting

- **Command:** `npm run lint`.
- Ensure code style matches the existing codebase (Prettier/ESLint).

## Tech Stack

- **Framework:** React (CRA based).
- **Language:** TypeScript.
- **Styling:** Tailwind CSS.
- **State/Data:** Custom Event Sourcing projection (`TennisTable` class).

## Key Files

- `src/client/client-db/tennis-table.ts`: Main projection entry point.
- `src/client/client-db/event-store/event-types.ts`: Definitions of all system
  events.
- `src/App.tsx`: App entry and provider setup.
