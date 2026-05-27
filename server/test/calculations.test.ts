import { describe, it, expect } from 'vitest';
import {
  contractSize,
  calculatePnL,
  notionalUSD,
  defaultVolumeFor,
  pipSizeFor,
  pipValueFor,
  lotsFromPipValue,
  pipLabel,
  isCrypto,
} from '../src/lib/contracts.js';

describe('contractSize', () => {
  it('forex = 100,000', () => expect(contractSize('EURUSD')).toBe(100_000));
  it('XAUUSD = 100', () => expect(contractSize('XAUUSD')).toBe(100));
  it('XAGUSD = 5,000', () => expect(contractSize('XAGUSD')).toBe(5_000));
  it('stock = 1', () => expect(contractSize('AAPL')).toBe(1));
  it('crypto = 1', () => expect(contractSize('BTCUSD')).toBe(1));
  it('PAXGUSD = 1 (crypto fallback)', () => expect(contractSize('PAXGUSD')).toBe(1));
});

describe('isCrypto', () => {
  it('BTCUSD is crypto', () => expect(isCrypto('BTCUSD')).toBe(true));
  it('ETHUSD is crypto', () => expect(isCrypto('ETHUSD')).toBe(true));
  it('EURUSD is not crypto', () => expect(isCrypto('EURUSD')).toBe(false));
  it('XAUUSD is not crypto', () => expect(isCrypto('XAUUSD')).toBe(false));
  it('AAPL is not crypto', () => expect(isCrypto('AAPL')).toBe(false));
});

describe('calculatePnL', () => {
  it('buy EURUSD profit: 0.1 lots, +50 pips', () => {
    // 0.1 * 100000 * (1.1050 - 1.1000) = 0.1 * 100000 * 0.005 = 50
    expect(calculatePnL('buy', 0.1, 1.1000, 1.1050, 'EURUSD')).toBeCloseTo(50, 2);
  });
  it('sell EURUSD profit: 0.1 lots, -50 pips for entry', () => {
    // sell: (open - current) * 0.1 * 100000 = (1.1050 - 1.1000) * 10000 = 50
    expect(calculatePnL('sell', 0.1, 1.1050, 1.1000, 'EURUSD')).toBeCloseTo(50, 2);
  });
  it('buy EURUSD loss: 0.1 lots, -20 pips', () => {
    expect(calculatePnL('buy', 0.1, 1.1000, 1.0980, 'EURUSD')).toBeCloseTo(-20, 2);
  });
  it('buy BTCUSD profit: 0.01 lots, +$1000 move', () => {
    // 0.01 * 1 * (77000 - 76000) = 10
    expect(calculatePnL('buy', 0.01, 76_000, 77_000, 'BTCUSD')).toBeCloseTo(10, 2);
  });
  it('sell BTCUSD profit: 0.01 lots, -$1000 move', () => {
    expect(calculatePnL('sell', 0.01, 77_000, 76_000, 'BTCUSD')).toBeCloseTo(10, 2);
  });
  it('buy XAUUSD profit: 0.1 lots, +$10 move', () => {
    // 0.1 * 100 * (2360 - 2350) = 100
    expect(calculatePnL('buy', 0.1, 2350, 2360, 'XAUUSD')).toBeCloseTo(100, 2);
  });
  it('zero P&L when price unchanged', () => {
    expect(calculatePnL('buy', 0.1, 1.1000, 1.1000, 'EURUSD')).toBe(0);
  });
});

describe('notionalUSD', () => {
  it('EURUSD 0.1 lots at 1.10 = $11,000', () => {
    expect(notionalUSD(0.1, 1.1000, 'EURUSD')).toBeCloseTo(11_000, 0);
  });
  it('BTCUSD 0.01 lots at 76000 = $760', () => {
    expect(notionalUSD(0.01, 76_000, 'BTCUSD')).toBeCloseTo(760, 0);
  });
  it('XAUUSD 0.1 lots at 2350 = $23,500', () => {
    expect(notionalUSD(0.1, 2350, 'XAUUSD')).toBeCloseTo(23_500, 0);
  });
  it('AAPL 1 lot at 220 = $220', () => {
    expect(notionalUSD(1, 220, 'AAPL')).toBeCloseTo(220, 0);
  });
});

describe('defaultVolumeFor', () => {
  it('forex = 0.10', () => expect(defaultVolumeFor('EURUSD')).toBe('0.10'));
  it('gold = 0.10', () => expect(defaultVolumeFor('XAUUSD')).toBe('0.10'));
  it('stock = 1', () => expect(defaultVolumeFor('AAPL')).toBe('1'));
  it('crypto = 0.01', () => expect(defaultVolumeFor('BTCUSD')).toBe('0.01'));
});

describe('spread-bet helpers', () => {
  it('pipSizeFor forex = 0.0001', () => expect(pipSizeFor('EURUSD')).toBe(0.0001));
  it('pipSizeFor crypto = 1', () => expect(pipSizeFor('BTCUSD')).toBe(1));
  it('pipSizeFor gold = 1', () => expect(pipSizeFor('XAUUSD')).toBe(1));

  it('pipValueFor EURUSD 0.1 lots = $1/pip', () => {
    // 0.1 * 100000 * 0.0001 = 1
    expect(pipValueFor(0.1, 'EURUSD')).toBeCloseTo(1, 4);
  });
  it('pipValueFor BTCUSD 0.01 lots = $0.01/pt', () => {
    expect(pipValueFor(0.01, 'BTCUSD')).toBeCloseTo(0.01, 4);
  });
  it('lotsFromPipValue EURUSD $10/pip = 1 lot', () => {
    // 10 / (100000 * 0.0001) = 1
    expect(lotsFromPipValue(10, 'EURUSD')).toBeCloseTo(1, 4);
  });
  it('lotsFromPipValue roundtrip', () => {
    const lots = 0.25;
    expect(lotsFromPipValue(pipValueFor(lots, 'EURUSD'), 'EURUSD')).toBeCloseTo(lots, 4);
  });

  it('pipLabel forex = pip', () => expect(pipLabel('EURUSD')).toBe('pip'));
  it('pipLabel crypto = pt', () => expect(pipLabel('BTCUSD')).toBe('pt'));
  it('pipLabel gold = pt', () => expect(pipLabel('XAUUSD')).toBe('pt'));
});
