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
  PRIMARY KEY (id, event_date)
);

-- Hypertable on event_date is what makes this a competitive Tiger Data
-- submission rather than "Postgres with extra steps": time-range queries
-- (the forecast window, a month of transactions) hit only the relevant
-- chunks instead of scanning the whole table.
SELECT create_hypertable('financial_events', 'event_date', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS financial_events_owner_date_idx ON financial_events (owner_id, event_date DESC);
CREATE INDEX IF NOT EXISTS financial_events_owner_id_idx ON financial_events (owner_id, id);
CREATE INDEX IF NOT EXISTS financial_events_category_idx ON financial_events (category);

-- Continuous aggregate: monthly spend by category, for the Budgets module
-- and the dashboard's "monthly expenses" metric. Only actual (not planned)
-- events count toward real spend. Refreshes incrementally as new events
-- land, instead of re-scanning history on every dashboard load.
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_category_spend
WITH (timescaledb.continuous) AS
SELECT
  owner_id,
  time_bucket('1 month', event_date) AS month,
  category,
  direction,
  sum(amount) AS total
FROM financial_events
WHERE record = 'actual'
GROUP BY owner_id, month, category, direction;

SELECT add_continuous_aggregate_policy('monthly_category_spend',
  start_offset => INTERVAL '3 months',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
