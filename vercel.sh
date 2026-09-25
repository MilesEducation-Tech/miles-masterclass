# Angular CLI 22 hard-aborts below ^22.22.3 / ^24.15.0; Vercel's 24.x image sits at 24.14.1,
# so package.json engines pins the build to 22.x. Logged here to prove the patch in the deploy log.
node -v

if [[ "$VERCEL_ENV" == "production" ]] ; then
  echo "Executing Production Build..."
  pnpm run build:prod
else
  echo "Executing UAT/Dev Build..."
  pnpm run build:dev
fi
