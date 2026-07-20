-- Cutover for the Kalshi volume-series fix.
--
-- sync-markets previously stored Kalshi's ROLLING 24h volume in market_snapshots.volume;
-- it now stores LIFETIME cumulative (see the fetchKalshi comment). The two are different
-- quantities on wildly different scales (367 vs 112950 on the same market), so a window
-- spanning the switch yields meaningless deltas — including one enormous fake spike.
--
-- detectVolumeSpike's `curDelta > prev0` bound already rejects that spike, but leaving
-- mixed-unit rows in place would still poison the median baseline for ~3 hours. Clearing
-- them is cheap and unambiguous: market_snapshots is written and read ONLY by
-- sync-markets (the app's price charts come from the venue APIs), the data is <3 days
-- old, and sync repopulates every 15 minutes. Detection stays correctly silent for the
-- first four intervals per market until a real baseline exists.
--
-- Polymarket rows are untouched — that source was always cumulative.

delete from market_snapshots where market_id like 'kalshi:%';
