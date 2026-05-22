# Customization guide

The starter is intentionally small. Customize it by changing configuration first,
then update the UI and server validation together.

## Change the BabySea model

Model configuration starts in `lib/app-config.ts`:

```ts
export const BABYSEA_MODEL = 'bfl/flux-schnell';
```

The server loads model schema and pricing with the BabySea SDK at runtime. Keep
that pattern when changing models:

- Load schema with `BabySea.library.models()`.
- Estimate cost with `BabySea.estimate()`.
- Validate submitted form values against SDK-returned schema.
- Store only `provider = 'babysea'` in the app database.

BabySea handles underlying provider routing.

## Add schema fields

For a new model-specific field:

1. Render the field in `app/dashboard/generate/page.tsx`.
2. Parse it in `app/dashboard/generate/_lib/server-actions.ts`.
3. Validate it against SDK model metadata.
4. Pass it to the SDK request in `lib/babysea.ts`.
5. Persist request metadata in `generations.output` for debugging.

Do not trust client-side form options alone. Server-side validation is the source
of truth.

## Change credit packs

Credit packs live in `lib/app-config.ts`.

When adding or changing a pack:

1. Update `CREDIT_PACKS`.
2. Create a matching Stripe Product and active Price.
3. Set a unique Stripe lookup key.
4. Test Checkout and webhook credit grants.

The app does not create inline Prices during Checkout. Persistent Prices make the
starter predictable across deployments.

## Change auth behavior

The starter ships with Google OAuth through Supabase Auth. Add the deployed app
URL to Supabase redirect URLs:

```text
https://your-app.example.com/auth/callback
```

If you switch to another OAuth provider, keep the same redirect pattern and
update the login server action.

## Storage and assets

Generated media is copied from BabySea into the private Supabase Storage bucket
`generated-media`. Dashboard previews use signed URLs.

If you change storage behavior, keep generated assets private by default and only
serve short-lived signed URLs to the owner.

## Public repo safety

- Keep `.env.example` complete but empty.
- Never commit `.env.local`, `.env.production`, `.vercel`, or exported secrets.
- Rotate secrets that appear in chats, screenshots, terminal logs, or issues.
- Keep `BABYSEA_API_KEY` and `SUPABASE_SECRET_KEY` server-only.
