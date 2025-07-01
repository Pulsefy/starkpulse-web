# Environment Configuration

This project uses environment variables to manage configuration for different deployment environments (development, staging, production).

## How it works
- Environment variables are loaded from `.env` files using [dotenv](https://www.npmjs.com/package/dotenv).
- On startup, all required variables are validated using a schema (see `src/config/environment.validate.js`).
- Sensitive data is never logged.
- Default values are provided for non-critical variables.

## Setup
1. Copy the appropriate template file:
   - For development: `cp .env.development .env`
   - For staging: `cp .env.staging .env`
   - For production: `cp .env.production .env`
2. Fill in all required values in your `.env` file.

## Required Variables
See the top of each `.env.*` file for required variables. Validation is enforced at runtime.

## Switching Environments
Set `NODE_ENV` in your `.env` file to one of: `development`, `staging`, `production`.

## Security
- Never commit `.env` files with real secrets to version control.
- All sensitive variables are validated and not logged.

## Adding New Variables
- Add the variable to the schema in `src/config/environment.validate.js`.
- Add it to the appropriate `.env.*` template(s).

---

For more details, see the comments in `src/config/environment.validate.js`.
