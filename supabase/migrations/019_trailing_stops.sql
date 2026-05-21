-- T.4 Trailing stops
--
-- trail_distance: the distance (in price units) the stop-loss trails
--                 behind the best price reached since open.
-- trail_high_water: the best price the trade has seen since opening.
--                   NULL means the risk worker has not yet set it
--                   (it initialises on the first tick after open).
--
-- Logic (handled in server/src/workers/risk.ts):
--   Buy:  high_water = max(high_water ?? open_price, mid)
--         trailing_sl = high_water - trail_distance
--         stop_loss   = max(stop_loss ?? -inf, trailing_sl)
--   Sell: high_water = min(high_water ?? open_price, mid)
--         trailing_sl = high_water + trail_distance
--         stop_loss   = min(stop_loss ?? +inf, trailing_sl)
--
-- Both columns stay NULL for non-trailing trades so existing rows are unaffected.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS trail_distance   numeric(18,5),
  ADD COLUMN IF NOT EXISTS trail_high_water numeric(18,5);
