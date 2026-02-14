# Contributing to Family Hub

Thank you for your interest in contributing! Family Hub is a community-driven project and we welcome contributions of all kinds.

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### Development Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<dein-username>/family-hub.git
   cd family-hub
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment:

   ```bash
   cp .env.example .env
   ```

   Configure `DATABASE_URL`, `REDIS_URL`, and `SESSION_SECRET` at minimum.

4. Set up the database:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/thissepic/family-hub/issues) first to avoid duplicates
- Use the bug report template when creating a new issue
- Include steps to reproduce, expected behavior, and actual behavior

### Suggesting Features

- Open a [feature request issue](https://github.com/thissepic/family-hub/issues/new)
- Describe the use case and why it would benefit Family Hub users
- Be open to discussion about alternative approaches

### Submitting Code

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below.

3. **Test your changes** locally.

4. **Commit** with a clear, descriptive message:

   ```bash
   git commit -m "Add feature: short description of what and why"
   ```

5. **Push** and open a Pull Request against `main`.

### Pull Request Guidelines

- Keep PRs focused on a single change
- Provide a clear description of what the PR does and why
- Reference related issues (e.g., "Closes #42")
- Make sure linting passes (`npm run lint`)
- Add or update translations in both `messages/en.json` and `messages/de.json` if your change includes user-facing text

## Code Style

- **TypeScript** for all source code
- **Tailwind CSS** for styling (no custom CSS unless absolutely necessary)
- Use existing **shadcn/ui** components where possible
- Follow the existing project structure (routers in `src/lib/trpc/routers/`, components in `src/components/<module>/`)
- Use **tRPC** for all API endpoints
- Keep business logic in `src/lib/`, UI logic in `src/components/`

## Translations

Family Hub supports English and German. When adding user-facing strings:

1. Add the key to `messages/en.json`
2. Add the German translation to `messages/de.json`
3. Use `useTranslations()` from `next-intl` in your components

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](./LICENSE).
