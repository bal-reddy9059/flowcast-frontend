# Vercel deployment

1. Import `bal-reddy9059/flowcast-frontend` in Vercel and keep `main` as the production branch.
2. Add these variables for Production, Preview, and Development:
   - `NEXT_PUBLIC_API_URL=https://<backend-host>/api/v1`
   - `NEXT_PUBLIC_WS_URL=wss://<backend-host>/api/v1`
   - `BACKEND_URL=https://<backend-host>`
3. Deploy. Pushes to `main` automatically create production deployments; other branches create previews.
4. In the backend deployment, set:
   - `FRONTEND_URL=https://<vercel-project-domain>`
   - CORS allowed origins to the Vercel production domain (and preview pattern if previews call the API).
5. In Google Cloud OAuth, retain the backend callback URL and ensure the backend's `GOOGLE_REDIRECT_URI` matches it.

Never commit real credentials or API secrets. Vercel injects these variables during builds and at runtime.
