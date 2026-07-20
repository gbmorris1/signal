-- Watchlist persistence fix.
--
-- `watchlists.market_id` referenced `markets(id)`, but `markets` has RLS with a
-- SELECT-only policy — so the client cannot create a market row. The app tried
-- to upsert one before saving a watch; that upsert silently failed, and then the
-- foreign key rejected the watch itself. Result: saving any market the 15-minute
-- sync hadn't already ingested LOOKED like it worked (optimistic local state)
-- but never persisted. It only surfaced as "my watchlist doesn't sync".
--
-- The watchlist only needs the market id; market data is read from the source
-- API at render time. Dropping the FK is the fix that does NOT reopen the
-- client-writable catalog hole (letting clients INSERT into `markets` would).

alter table watchlists
  drop constraint if exists watchlists_market_id_fkey;

-- Keep lookups fast now that there's no FK index implied.
create index if not exists watchlists_market_idx on watchlists(market_id);
