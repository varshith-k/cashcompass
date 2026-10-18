-- Additive migration; preserves all existing accounts and financial events.
CREATE TABLE IF NOT EXISTS nessie_user_accounts (
  owner_id text PRIMARY KEY,
  provisioning_token text NOT NULL UNIQUE,
  customer_id text UNIQUE,
  account_id text UNIQUE,
  customer_attempted boolean NOT NULL DEFAULT false,
  account_attempted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (account_id IS NULL OR customer_id IS NOT NULL),
  CHECK (NOT account_attempted OR customer_id IS NOT NULL)
);
