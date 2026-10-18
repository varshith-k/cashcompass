-- CashCompass financial-event schema for Tiger Data (TimescaleDB on Postgres).
-- Run against a Tiger Data Cloud service with:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Matches src/lib/finance/types.ts::FinancialEvent exactly. If that type
-- changes, this schema and src/lib/finance/tiger-repository.ts both need
-- the matching change.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- owner_id is the Auth0 `sub` of the user the event belongs to. Every query
-- in tiger-repository.ts filters on it; the app never takes it from the client.
-- The primary key includes event_date because TimescaleDB requires unique
-- indexes on a hypertable to contain the partitioning column.
CREATE TABLE IF NOT EXISTS financial_events (
  id text NOT NULL,
  owner_id text NOT NULL,
  event_date timestamptz NOT NULL,
  amount numeric(12, 2) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('income', 'expense')),
  record text NOT NULL CHECK (record IN ('actual', 'planned')),
  certainty text NOT NULL CHECK (certainty IN ('certain', 'uncertain')),
  recurrence text NOT NULL CHECK (recurrence IN ('one-time', 'recurring')),
  source text NOT NULL CHECK (source IN ('manual', 'nessie')),
  category text NOT NULL,
  counterparty text NOT NULL,
  scenario_id text,
  counterparty_phone text,
  friend_id text,
  notes text,
  is_receipt boolean NOT NULL DEFAULT false,
  minimum_payment numeric(12, 2),
  source_record_id text,
  PRIMARY KEY (id, event_date)
);

-- Safe upgrades for existing installations.
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS counterparty_phone text;
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS friend_id text;
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS is_receipt boolean NOT NULL DEFAULT false;
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS minimum_payment numeric(12, 2);
ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS source_record_id text;

-- Hypertable on event_date is what makes this a competitive Tiger Data
-- submission rather than "Postgres with extra steps": time-range queries
-- (the forecast window, a month of transactions) hit only the relevant
-- chunks instead of scanning the whole table.
SELECT create_hypertable('financial_events', 'event_date', if_not_exists => TRUE);

-- Compression: chunks older than 30 days compress automatically. Segmented
-- by owner_id so a per-user query still only decompresses that user's
-- rows, ordered by event_date since that's how this table is always read.
ALTER TABLE financial_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'owner_id',
  timescaledb.compress_orderby = 'event_date DESC'
);
SELECT add_compression_policy('financial_events', INTERVAL '30 days', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS financial_events_owner_date_idx ON financial_events (owner_id, event_date DESC);
CREATE INDEX IF NOT EXISTS financial_events_owner_id_idx ON financial_events (owner_id, id);
CREATE INDEX IF NOT EXISTS financial_events_category_idx ON financial_events (category);

-- Continuous aggregate: monthly spend by category, for the Budgets module
-- and the dashboard's "monthly expenses" metric. Only actual (not planned)
-- events count toward real spend. Refreshes incrementally as new events
-- land, instead of re-scanning history on every dashboard load.
-- materialized_only = false enables real-time aggregation: a query against
-- this view transparently unions the materialized (refreshed hourly, below)
-- history with a live aggregate over whatever hasn't been refreshed yet.
-- Without it, a transaction added seconds ago wouldn't show up here until
-- the next scheduled refresh - up to an hour of a visibly stale dashboard.
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_category_spend
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  owner_id,
  time_bucket('1 month', event_date) AS month,
  category,
  direction,
  sum(amount) AS total
FROM financial_events
WHERE record = 'actual'
GROUP BY owner_id, month, category, direction
WITH NO DATA;

-- Safe to re-run: fixes an existing installation created before this
-- setting was added above (IF NOT EXISTS skips the CREATE either way).
ALTER MATERIALIZED VIEW monthly_category_spend SET (timescaledb.materialized_only = false);

SELECT add_continuous_aggregate_policy('monthly_category_spend',
  start_offset => INTERVAL '3 months',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- A devnet transaction may settle only one ledger entry, across users and restarts.
CREATE TABLE IF NOT EXISTS solana_settlement_receipts (
  signature text PRIMARY KEY,
  owner_id text NOT NULL,
  entry_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

-- Bill email reminders ("Remind me" on Bills & Payments). One per bill per
-- user; moved to the next occurrence when a recurring bill is paid.
-- last_sent_key prevents sending twice for the same due date.
CREATE TABLE IF NOT EXISTS bill_reminders (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  bill_id text NOT NULL,
  email text NOT NULL,
  days_before integer NOT NULL CHECK (days_before BETWEEN 0 AND 30),
  hour integer NOT NULL CHECK (hour BETWEEN 0 AND 23),
  time_zone text NOT NULL,
  last_sent_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, bill_id)
);

-- Settle Up friends, per user. The app also creates this table on first use
-- (src/lib/finance/app-tables.ts), so older deployments keep working.
CREATE TABLE IF NOT EXISTS friends (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  nessie_account_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS friends_owner_name_idx ON friends (owner_id, lower(name));

-- A balance one user shared with another CashCompass user (by email). The
-- recipient sees it only with that verified email and must accept it; after
-- that, payments on either side are mirrored to the other.
CREATE TABLE IF NOT EXISTS shared_balances (
  id text PRIMARY KEY,
  from_owner_id text NOT NULL,
  from_name text NOT NULL,
  from_email text,
  to_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('they_owe_sender', 'sender_owes')),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  due_date timestamptz NOT NULL,
  from_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'settled', 'cancelled')),
  to_owner_id text,
  to_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_owner_id, from_event_id)
);
CREATE INDEX IF NOT EXISTS shared_balances_to_email_idx ON shared_balances (to_email, status);

-- Durable per-user planning, balance checkpoints, and synchronization state.
CREATE TABLE IF NOT EXISTS planning_profiles (
  owner_id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
