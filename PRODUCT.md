# not-a-cms Design System

## Design Context

### Users
CMS administrators and content creators ranging from bloggers who never touch code to developers building headless applications. They access the admin UI to manage content, configure automations, and customize their site. The context is focused work — creating, editing, publishing. They need the tool to feel reliable and stay out of their way.

### Brand Personality
**Clean, confident, capable.** The admin should feel like a well-made tool — not flashy, not boring. It communicates competence through clarity. Every element earns its place. The voice is direct and helpful without being terse or robotic.

### Aesthetic Direction
**Distinctive identity** — not a Tailwind template, but its own product. The current blue-600/white/gray palette and system-ui fonts are a starting point to evolve from, not the final identity.

**Primary reference: Notion** — confident use of whitespace, approachable without being childish, information density that scales gracefully, subtle interactions that reward attention. Notion's admin feels like a place you want to work in.

**Anti-references:** Generic SaaS dashboards with gradient hero sections, dark mode with neon accents, glassmorphism cards, or anything that looks like a 2024 AI-generated landing page.

**Theme:** Light mode primary. Dark mode is a future consideration, not a launch requirement.

### Design Principles

1. **Clarity over decoration.** Every visual element communicates something. If it doesn't help the user understand or act, remove it. No ornamental gradients, shadows for style, or colors without meaning.

2. **Earned density.** Start sparse, get denser as users go deeper. The flow list is simple. The flow editor shows more. The replay debugger shows everything. Never dump complexity on a user who hasn't asked for it.

3. **Confident whitespace.** Generous spacing signals quality and control, not emptiness. Notion makes whitespace feel intentional — not-a-cms should too. Resist the urge to fill every gap.

4. **Real identity, not defaults.** Custom font, considered color palette, proper icon system. The admin should be recognizable in a screenshot without seeing the logo. Default Tailwind colors and system fonts are scaffolding, not shipping quality.

5. **Tools, not toys.** The admin is where real work happens. Interactions should feel precise and responsive. Animations serve function (indicating state change, drawing attention) not decoration. The UI respects the user's time.
