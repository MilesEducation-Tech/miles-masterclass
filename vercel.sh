if [[ "$VERCEL_ENV" == "production" ]] ; then
  echo "Executing Production Build..."
  pnpm run build:prod
else
  echo "Executing UAT/Dev Build..."
  pnpm run build:dev
fi
