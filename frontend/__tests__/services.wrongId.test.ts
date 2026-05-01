// Exercise the real submitWrongIdReport implementation against a mocked
// supabase client. Mirrors the pattern used by services.identity.test.ts.
jest.mock('../services/supabase', () => jest.requireActual('../services/supabase'));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  cacheDirectory: '/tmp/',
  downloadAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('base64-arraybuffer', () => ({ decode: jest.fn() }));

const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });
const fromMock = jest.fn(() => ({ insert: insertMock }));

jest.mock('../config/supabase', () => ({
  supabase: { from: fromMock },
}));

// Import AFTER mocks are set up
import { submitWrongIdReport } from '../services/supabase';

describe('submitWrongIdReport', () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockClear();
    insertMock.mockResolvedValue({ data: null, error: null });
  });

  it('inserts a low-confidence-decline report with required fields', async () => {
    const ok = await submitWrongIdReport({
      source: 'low-confidence-decline',
      returnedClass: 'BR 412',
      returnedOperator: 'Deutsche Bahn',
      returnedConfidence: 65,
    });
    expect(fromMock).toHaveBeenCalledWith('wrong_id_reports');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'low-confidence-decline',
        returned_class: 'BR 412',
        returned_operator: 'Deutsche Bahn',
        returned_confidence: 65,
      })
    );
    expect(ok).toBe(true);
  });

  it('inserts a card-wrong-id report with optional user_correction', async () => {
    const ok = await submitWrongIdReport({
      source: 'card-wrong-id',
      returnedClass: 'Class 33',
      userCorrection: 'Class 69',
      spotId: 'spot-uuid-1',
      userId: 'user-1',
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'card-wrong-id',
        returned_class: 'Class 33',
        user_correction: 'Class 69',
        spot_id: 'spot-uuid-1',
        user_id: 'user-1',
      })
    );
    expect(ok).toBe(true);
  });

  it('defaults missing optional fields to null', async () => {
    await submitWrongIdReport({
      source: 'low-confidence-decline',
      returnedClass: 'BR 412',
    });
    const payload = insertMock.mock.calls[0][0];
    expect(payload.user_id).toBeNull();
    expect(payload.spot_id).toBeNull();
    expect(payload.photo_url).toBeNull();
    expect(payload.returned_operator).toBeNull();
    expect(payload.returned_confidence).toBeNull();
    expect(payload.user_correction).toBeNull();
  });

  it('returns false on supabase error and does not throw', async () => {
    insertMock.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    const ok = await submitWrongIdReport({
      source: 'card-wrong-id',
      returnedClass: 'Class 33',
    });
    expect(ok).toBe(false);
  });
});
