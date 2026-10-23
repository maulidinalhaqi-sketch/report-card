# Dentist Report Card Dashboard — Static Edition

This is a static-only edition of the dashboard. It uses the existing React dashboard and `src/data/report.json`; it does not include the original server, authentication, database migration, or API layer.

## Important data/privacy note

The dashboard data is bundled into the website and can be downloaded by anyone who can access the deployed site. Keep the GitHub repository private if appropriate, but note that a published GitHub Pages website is public. Do not deploy real or confidential dentist/patient/business data publicly without authorization.

## Deploy to GitHub Pages

1. Create a GitHub repository and upload the contents of this folder (not the ZIP file itself).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push/commit the files to the `main` branch. The included workflow installs dependencies, builds the static site into `dist/`, and publishes it.
5. Open the **Actions** tab and wait for **Deploy static dashboard to GitHub Pages** to finish successfully.
6. The public URL will appear under **Settings → Pages** or in the workflow deployment result.

## Test locally (optional)

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

To test a production build:

```bash
npm run build
npm run preview
```

## Data updates

To update the figures shown on the dashboard, update `src/data/report.json`, commit the change, and push to `main`. GitHub Actions will rebuild and redeploy the site.
