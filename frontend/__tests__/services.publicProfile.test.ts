// Exercise the real Social Phase 1 mappers + fetchers, mocking the
// underlying supabase client + native deps the file ships with.
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
import {
  mapPublicProfile,
  mapPublicCollectionItem,
  fetchPublicProfile,
  fetchPublicCollection,
} from '../services/supabase';

describe('mapPublicProfile', () => {
  it('maps snake_case → camelCase and coerces bigint counts to numbers', () => {
    const out = mapPublicProfile({
      user_id: 'u1',
      username: 'TrainFan',
      country_code: 'DE',
      spotter_emoji: 'train_steam',
      level: 4,
      total_spots: '120',      // Postgres bigint can arrive as string
      unique_classes: '88',
      rare_count: 7,
      epic_count: 3,
      legendary_count: 1,
    });
    expect(out).toEqual({
      userId: 'u1',
      username: 'TrainFan',
      countryCode: 'DE',
      spotterEmoji: 'train_steam',
      level: 4,
      totalSpots: 120,
      uniqueClasses: 88,
      rareCount: 7,
      epicCount: 3,
      legendaryCount: 1,
    });
    expect(typeof out.totalSpots).toBe('number');
  });

  it('defaults username and nullable identity fields', () => {
    const out = mapPublicProfile({ user_id: 'u2' });
    expect(out.username).toBe('Anonymous Spotter');
    expect(out.countryCode).toBeNull();
    expect(out.spotterEmoji).toBeNull();
    expect(out.totalSpots).toBe(0);
    expect(out.level).toBe(1);
  });
});

describe('mapPublicCollectionItem', () => {
  it('maps fields and excludes any location/photo', () => {
    const out = mapPublicCollectionItem({
      spot_id: 's1',
      train_id: 't1',
      class: 'BR 140',
      name: 'Lufthansa',
      operator: 'DB Cargo',
      type: 'Electric',
      designation: "Bo'Bo'",
      rarity_tier: 'legendary',
      blueprint_url: 'https://x/bp.png',
      spotted_at: '2026-06-09T10:00:00Z',
    });
    expect(out).toEqual({
      spotId: 's1',
      trainId: 't1',
      class: 'BR 140',
      name: 'Lufthansa',
      operator: 'DB Cargo',
      type: 'Electric',
      designation: "Bo'Bo'",
      rarityTier: 'legendary',
      blueprintUrl: 'https://x/bp.png',
      spottedAt: '2026-06-09T10:00:00Z',
    });
    // Never carries coordinates / photo
    expect(out).not.toHaveProperty('latitude');
    expect(out).not.toHaveProperty('photoUrl');
  });

  it('defaults name to null and rarity to common', () => {
    const out = mapPublicCollectionItem({ spot_id: 's2', train_id: 't2' });
    expect(out.name).toBeNull();
    expect(out.rarityTier).toBe('common');
    expect(out.blueprintUrl).toBeNull();
  });
});

describe('fetchPublicProfile (graceful degradation)', () => {
  beforeEach(() => rpcMock.mockReset());

  it('returns null (no crash) when the RPC is not deployed yet (42883)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42883', message: 'missing' } });
    expect(await fetchPublicProfile('u1')).toBeNull();
  });

  it('returns null when the user is private (empty rows)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    expect(await fetchPublicProfile('u1')).toBeNull();
  });

  it('returns the mapped profile on success', async () => {
    rpcMock.mockResolvedValue({
      data: [{ user_id: 'u1', username: 'A', total_spots: 5 }],
      error: null,
    });
    const out = await fetchPublicProfile('u1');
    expect(out?.userId).toBe('u1');
    expect(out?.totalSpots).toBe(5);
    expect(rpcMock).toHaveBeenCalledWith('get_public_profile', { target_user_id: 'u1' });
  });
});

describe('fetchPublicCollection (graceful degradation)', () => {
  beforeEach(() => rpcMock.mockReset());

  it('returns [] when the RPC is missing from the schema cache (PGRST202)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'no fn' } });
    expect(await fetchPublicCollection('u1')).toEqual([]);
  });

  it('maps the row array on success and passes pagination args', async () => {
    rpcMock.mockResolvedValue({
      data: [{ spot_id: 's1', train_id: 't1', class: 'BR 140', rarity_tier: 'epic' }],
      error: null,
    });
    const out = await fetchPublicCollection('u1', 25, 50);
    expect(out).toHaveLength(1);
    expect(out[0].class).toBe('BR 140');
    expect(rpcMock).toHaveBeenCalledWith('get_public_collection', {
      target_user_id: 'u1',
      p_limit: 25,
      p_offset: 50,
    });
  });
});
