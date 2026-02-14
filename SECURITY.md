# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in Family Hub, please report it responsibly. **Do not open a public GitHub issue.**

### How to Report

Send an email to **security@thisisepic.de** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgement** within 48 hours
- **Status update** within 7 days
- We aim to release a fix within 30 days of confirmation

### Scope

The following are in scope:

- Authentication and session management
- Authorization and access control
- SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities
- Sensitive data exposure
- Cryptographic issues (token encryption, password hashing)

The following are out of scope:

- Denial of service attacks
- Social engineering
- Vulnerabilities in third-party dependencies (report these upstream)
- Issues requiring physical access to the server

### Disclosure Policy

We follow coordinated disclosure. Please allow us reasonable time to address the issue before making any public disclosure.

## Security Best Practices for Self-Hosters

- Always deploy behind HTTPS (the included Caddy configuration handles this automatically)
- Use strong, unique values for `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `POSTGRES_PASSWORD`
- Keep your Docker images and dependencies up to date
- Restrict network access to PostgreSQL and Redis (do not expose them publicly)
- Regularly back up your database
