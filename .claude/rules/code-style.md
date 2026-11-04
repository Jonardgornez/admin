# Code Style

# React Frontend Coding Practices

## Components

- [ ] Keep components small and focused on one responsibility.
- [ ] Prefer reusable components over duplicated UI.
- [ ] Keep components easy to read and understand.
- [ ] Extract complex UI sections into separate components.
- [ ] Avoid components with excessive conditional logic.
- [ ] Avoid creating abstractions unless they provide real reuse or clarity.
- [ ] Keep feature-specific logic close to the feature.
- [ ] Use consistent component naming.

## TypeScript

- [ ] Use TypeScript consistently.
- [ ] Define clear types for component props.
- [ ] Avoid `any`.
- [ ] Prefer type inference for simple values.
- [ ] Use descriptive type and interface names.
- [ ] Reuse shared types instead of duplicating definitions.
- [ ] Avoid unnecessary type assertions.
- [ ] Keep types aligned with the expected data shape.

## Mock Data

- [ ] Keep mock data separate from UI components.
- [ ] Use realistic data structures.
- [ ] Type mock data where appropriate.
- [ ] Don't hardcode large datasets inside JSX.
- [ ] Keep mock data easy to replace with real backend data later.
- [ ] Avoid putting application logic inside mock data files.

## Tailwind CSS

- [ ] Always use the current, up-to-date Tailwind CSS syntax rather than older conventions — check the installed Tailwind major version before writing config or utility classes, since syntax has changed chronologically across versions (e.g. Tailwind v4's CSS-first setup replaces the old `tailwind.config.js` + `@tailwind base/components/utilities` approach).
- [ ] In Tailwind v4+, configure theme values with `@theme` in the global CSS file and import Tailwind with `@import "tailwindcss";` instead of maintaining a separate JS config file, unless the project is intentionally pinned to v3.
- [ ] Define design tokens (colors, spacing, radii, fonts, shadows) **once** as CSS variables (via `@theme` in v4, or `:root` custom properties in v3) and reference them through Tailwind utility classes everywhere — never hardcode raw hex codes or one-off pixel values inside components.
- [ ] Reuse the same token set across the whole app (e.g. `--color-primary`, `--color-danger`, `--radius-md`) instead of redefining similar colors/spacing per component.
- [ ] Keep token definitions centralized in one global CSS file (`src/index.css`), not scattered or redeclared across individual components.
- [ ] When upgrading Tailwind versions, check for renamed or deprecated utilities/config keys and update usage accordingly instead of leaving mixed old/new syntax in the codebase.

## Component Variants

- [ ] For components with multiple visual states (Button, Badge, Alert, Input, etc.), define variants explicitly with a variant utility such as `class-variance-authority` (`cva`) rather than chaining ternaries or `if/else` inside `className`.
- [ ] Pair `cva` with a `cn()` helper (typically `clsx` + `tailwind-merge`) so variant classes merge safely with any additional `className` passed in as a prop, without utility class conflicts.
- [ ] Type variant props (e.g. `variant`, `size`) via TypeScript — derive prop types from the `cva` config (`VariantProps<typeof buttonVariants>`) so invalid values are caught at compile time, not at runtime.
- [ ] Keep the variant config colocated with its component file rather than in a distant shared file, unless multiple components genuinely share the same variant shape.
- [ ] Avoid duplicating variant logic across similar components — extract a shared variant config only when there is real, repeated reuse.

### Example: Button variants with `cva`

```ts
// src/component/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

```css
/* src/index.css (Tailwind v4 example) */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.2 260);
  --color-primary-foreground: oklch(0.98 0 0);
  --color-secondary: oklch(0.9 0.02 260);
  --color-secondary-foreground: oklch(0.2 0 0);
  --color-destructive: oklch(0.58 0.22 25);
  --color-destructive-foreground: oklch(0.98 0 0);
  --radius-md: 0.375rem;
}
```

The same pattern (`cva` + `cn()` + theme-driven CSS variables) should be reused for any other component with variant states — not just Button.

## Responsive Design

- [ ] Design for mobile and desktop.
- [ ] Avoid fixed widths that break smaller screens.
- [ ] Prefer flexible layouts using Flexbox and Grid.
- [ ] Test layouts at different viewport sizes.
- [ ] Handle long text and dynamic content gracefully.
- [ ] Ensure navigation and interactive elements work on smaller screens.

## Accessibility

- [ ] Use semantic HTML elements.
- [ ] Use `<button>` for actions.
- [ ] Use links for navigation.
- [ ] Provide labels for form controls.
- [ ] Ensure interactive elements are keyboard accessible.
- [ ] Maintain visible focus states.
- [ ] Provide meaningful `alt` text for images.
- [ ] Don't use color as the only way to communicate information.
- [ ] Use ARIA attributes only when native HTML semantics aren't sufficient.

## Forms

- [ ] Use `react-hook-form` for form state (`register`/`Controller`, `formState`) instead of managing individual `useState` fields by hand, once a form has more than one or two inputs.
- [ ] Keep form components easy to understand.
- [ ] Provide clear validation feedback, driven by `formState.errors` from `react-hook-form`.
- [ ] Show loading states during asynchronous operations using `formState.isSubmitting`.
- [ ] Disable actions when appropriate (e.g. submit button disabled while `isSubmitting` or when the form is invalid).
- [ ] Preserve user input when validation fails — this is `react-hook-form`'s default behavior; don't reset the form on failed submit.
- [ ] Make forms keyboard accessible.
- [ ] Keep validation rules consistent with the expected data structure by deriving the form's types from its Zod schema (`z.infer<typeof schema>`) rather than declaring a separate form type by hand.
- [ ] Use Zod schema validation (via `@hookform/resolvers/zod`) when forms become complex.

## State Management

- [ ] Keep state as local as possible.
- [ ] Avoid global state when local state is sufficient.
- [ ] Don't duplicate state that can be derived.
- [ ] Keep state logic separate from presentation when it becomes complex.
- [ ] Use URL state when values should be shareable or bookmarkable.
- [ ] Don't introduce a state-management library without a clear need.

## Navigation

- [ ] Use the router's `Link` component for internal navigation once a router is added (none is installed yet).
- [ ] Avoid unnecessary client-side navigation logic.
- [ ] Keep navigation components reusable.
- [ ] Provide clear active states.
- [ ] Ensure navigation is accessible by keyboard.
- [ ] Handle mobile navigation appropriately.

## Images & Assets

- [ ] Import application images from `src/assets/` so Vite can process them; use `public/` only for files that need a fixed URL.
- [ ] Set `width` and `height` on images to prevent layout shift, and use `loading="lazy"` for offscreen images.
- [ ] Provide meaningful `alt` text.
- [ ] Optimize image dimensions and file sizes.
- [ ] Avoid unnecessarily large assets.
- [ ] Use SVGs appropriately for icons and simple graphics.
- [ ] Keep asset naming consistent.

## Loading, Empty & Error States

- [ ] Design loading states intentionally.
- [ ] Provide useful empty states.
- [ ] Provide user-friendly error states.
- [ ] Avoid leaving users with blank screens.
- [ ] Use skeletons when they improve perceived loading performance.
- [ ] Make error messages understandable to users.

## Performance

- [ ] Optimize images.
- [ ] Avoid unnecessarily large dependencies.
- [ ] Avoid unnecessary re-renders.
- [ ] Lazy-load expensive UI with `React.lazy` and `Suspense` when appropriate.
- [ ] Don't introduce optimization techniques without a measurable reason.
- [ ] Keep the initial JavaScript bundle as small as practical.

## Validation

- [ ] Use Zod to validate user input before processing it, rather than hand-written `if` checks.
- [ ] Define one Zod schema per form/data shape and reuse it — don't duplicate the same rules as separate manual checks elsewhere.
- [ ] Use Zod schema validation for all non-trivial forms, wired into `react-hook-form` via `@hookform/resolvers/zod`.
- [ ] Display validation errors close to the relevant input, using the field-level messages from `formState.errors`.
- [ ] Don't rely only on visual validation feedback.
- [ ] Keep frontend Zod schemas aligned with the future backend contract — the same schema (or a shared package) should validate the API payload too where practical.

### Example: React Hook Form + Zod

```ts
// src/component/contact-form.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (values: ContactFormValues) => {
    await fetch("/api/contact", {
      method: "POST",
      body: JSON.stringify(values),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input id="name" {...register("name")} className="w-full rounded-md border px-3 py-2" />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" type="email" {...register("email")} className="w-full rounded-md border px-3 py-2" />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea id="message" {...register("message")} className="w-full rounded-md border px-3 py-2" />
        {errors.message && (
          <p className="text-sm text-destructive">{errors.message.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
```

The schema (`contactSchema`), the inferred type (`ContactFormValues`), and the `zodResolver` wiring is the standard pattern to reuse for every form in the app.

## API Calls

- [ ] Treat client-side validation as a user-experience aid only. The API must re-validate input and enforce authentication and authorization, because code in the browser can't guarantee either.
- [ ] Never put secrets in client code. Every `VITE_*` environment variable is bundled and visible to users.
- [ ] Check `response.ok` after `fetch`, since it doesn't reject on HTTP error statuses.
- [ ] Return a typed result (e.g. `{ success: true, data } | { success: false, error }`) from API helpers so components can show errors without a try/catch around every call.
- [ ] In forms managed by `react-hook-form`, surface returned errors through `setError`.
- [ ] For actions that must not run twice (payments, sending an email), add explicit guards against double-submits.

## Code Organization

- [ ] Keep related code close together.
- [ ] Separate UI from reusable utilities.
- [ ] Avoid putting unrelated helpers into generic utility files.
- [ ] Keep files reasonably sized.
- [ ] Prefer clear organization over excessive abstraction.
- [ ] Don't create folders or architectural layers before they are needed.

## Naming

- [ ] Use descriptive names.
- [ ] Use consistent naming conventions.
- [ ] Name components based on what they represent.
- [ ] Name functions based on what they do.
- [ ] Avoid vague names such as `data`, `thing`, `stuff`, or `handle`.
- [ ] Use boolean names that communicate state, such as `isLoading` or `isOpen`.

## Code Quality

- [ ] Keep functions focused.
- [ ] Avoid deeply nested conditionals.
- [ ] Avoid duplicated logic.
- [ ] Remove unused code.
- [ ] Remove unused imports and variables.
- [ ] Avoid commented-out code.
- [ ] Avoid premature abstraction.
- [ ] Prefer readable code over clever code.
- [ ] Keep formatting consistent.
- [ ] Fix TypeScript and oxlint errors before merging.

## Future Backend Compatibility

- [ ] Keep UI components independent from the data source where practical.
- [ ] Use typed data models for mock data.
- [ ] Avoid coupling components directly to mock-data implementation details.
- [ ] Design data shapes that can transition naturally to API responses.
- [ ] Keep frontend validation reusable when possible.
- [ ] Don't introduce backend-specific architecture until backend functionality is actually required.

## Before Committing

- [ ] The UI works on mobile and desktop.
- [ ] Components are reusable where appropriate.
- [ ] TypeScript passes.
- [ ] oxlint passes.
- [ ] No unused code remains.
- [ ] Loading, empty, and error states are handled.
- [ ] Forms are accessible.
- [ ] Forms use `react-hook-form` with a Zod schema (via `zodResolver`) rather than manual state + hand-written checks.
- [ ] API calls handle failed responses, and no secrets are exposed in client code.
- [ ] Images are optimized.
- [ ] No obvious duplicated UI or logic exists.
- [ ] Tailwind syntax matches the project's current Tailwind version (no mixed old/new config styles).
- [ ] Design tokens are used instead of hardcoded colors/spacing values.
- [ ] Components with multiple visual states use a variant pattern (e.g. `cva`) instead of conditional className logic.
- [ ] The code is understandable without unnecessary comments.

## Core Principles

- [ ] **Prefer simplicity over abstraction.**
- [ ] **Prefer reusable components over duplicated UI.**
- [ ] **Keep state local whenever possible.**
- [ ] **Keep mock data replaceable.**
- [ ] **Build accessibility into components from the start.**
- [ ] **Optimize based on actual problems, not assumptions.**
- [ ] **Write code that another developer can understand quickly.**
- [ ] **Always write Tailwind CSS using the current version's syntax.**
- [ ] **Centralize design tokens as reusable CSS variables — never hardcode values.**
- [ ] **Use a variant pattern (e.g. `cva`) for components with multiple visual states.**
- [ ] **Use `react-hook-form` for form state and Zod for schema validation.**
- [ ] **Client-side checks are for user experience only — the API must validate input and enforce auth.**
