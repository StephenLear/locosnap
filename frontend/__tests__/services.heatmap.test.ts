// Exercise the real fetchSpotHeatmap implementation against a mocked
// supabase client. Mirrors the pattern used by services.wrongId.test.ts.
jest.mock('../services/supabase', () => jest.requireActual('../services/supabase'));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  cacheDirectory: '/tmp/',
  downloadAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('base64-arraybuffer', () => ({ decode: jest.fn() }));

const rpcMock = jest.fn();
jest.mock('../config/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

// Import AFTER mocks are set up
import { fetchSpotHeatmap } from '../services/supabase';

describe('fetchSpotHeatmap', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('calls the RPC with default grid + min users and maps rows (with numeric coercion)', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          cell_lat: '50.9',
          cell_lng: '6.9',
          spot_count: '43',
          rarity_score: '120',
          top_rarity: 'epic',
          distinct_classes: '12',
        },
      ],
      error: null,
    });

    const cells = await fetchSpotHeatmap();

    expect(rpcMock).toHaveBeenCalledWith('get_spot_heatmap', {
      p_grid: 0.1,
      p_min_users: 2,
    });
    expect(cells).toEqual([
      {
        lat: 50.9,
        lng: 6.9,
        spotCount: 43,
        rarityScore: 120,
        topRarity: 'epic',
        distinctClasses: 12,
      },
    ]);
  });

  it('forwards a custom grid and min-users', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await fetchSpotHeatmap(0.25, 3);

    expect(rpcMock).toHaveBeenCalledWith('get_spot_heatmap', {
      p_grid: 0.25,
      p_min_users: 3,
    });
  });

  it('returns [] when the RPC errors (e.g. not deployed)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    expect(await fetchSpotHeatmap()).toEqual([]);
  });

  it('returns [] when data is null', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    expect(await fetchSpotHeatmap()).toEqual([]);
  });
});
