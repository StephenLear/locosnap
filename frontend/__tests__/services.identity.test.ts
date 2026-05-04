// Override the global ./services/supabase mock so we exercise the real
// updateProfileIdentity implementation, while still mocking the underlying
// supabase client + native deps that ship with the file.
jest.mock('../services/supabase', () => jest.requireActual('../services/supabase'));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  cacheDirectory: '/tmp/',
  downloadAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('base64-arraybuffer', () => ({ decode: jest.fn() }));

const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const updateMock = jest.fn(() => ({ eq: eqMock }));
const fromMock = jest.fn(() => ({ update: updateMock }));

jest.mock('../config/supabase', () => ({
  supabase: { from: fromMock },
}));

// Import AFTER mocks are set up
import { updateProfileIdentity } from '../services/supabase';

describe('updateProfileIdentity', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
  });

  it('PATCHes the new columns by user id', async () => {
    const result = await updateProfileIdentity('user-1', {
      country_code: 'DE',
      spotter_emoji: 'train_steam',
    });
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(updateMock).toHaveBeenCalledWith({
      country_code: 'DE',
      spotter_emoji: 'train_steam',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
    expect(result.error).toBeNull();
  });

  it('handles partial updates (only country_code)', async () => {
    const result = await updateProfileIdentity('user-1', { country_code: 'PL' });
    expect(updateMock).toHaveBeenCalledWith({ country_code: 'PL' });
    expect(result.error).toBeNull();
  });

  it('handles onboarding flag', async () => {
    const result = await updateProfileIdentity('user-1', {
      has_completed_identity_onboarding: true,
    });
    expect(updateMock).toHaveBeenCalledWith({
      has_completed_identity_onboarding: true,
    });
    expect(result.error).toBeNull();
  });
});
