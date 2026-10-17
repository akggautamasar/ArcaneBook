# ArcaneBook

ArcaneBook is a mock-test and quiz platform.

## Migration status

The original AirBook application is being migrated from the provided ZIP. The application source has **not yet been uploaded** to this repository. Do not deploy this repository as a working application yet.

## Architecture

- React + Vite frontend
- Telegram Bot API for free quiz file storage
- Server-side API proxy for Telegram credentials and admin operations

## Security requirements

Never commit `.env` or Telegram bot credentials. Never use `VITE_` environment variables for secrets. Rotate any previously exposed Telegram bot token. Configure secrets on the server/Worker only.

## Planned corrections

- Rebrand AirBook to ArcaneBook
- Move Telegram operations to a secure server API
- Add server-verified admin authentication
- Harden rich HTML rendering
- Improve quiz index consistency and error reporting
