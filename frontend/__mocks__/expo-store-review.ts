// Mock for expo-store-review — native module, can't run in Node/Jest.
// Tests that exercise reviewPrompt logic mock these per-test; this file
// is a fallback for any test that imports a module which transitively
// pulls expo-store-review (e.g. trainStore -> reviewPrompt).
export const requestReview = jest.fn(async () => undefined);
export const isAvailableAsync = jest.fn(async () => false);
export const hasAction = jest.fn(async () => false);
export default { requestReview, isAvailableAsync, hasAction };
