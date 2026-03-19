// Mock for expo-image-manipulator — native module, can't run in Node/Jest
export const manipulateAsync = jest.fn(async (uri: string) => ({ uri }));
export const SaveFormat = { JPEG: "jpeg", PNG: "png" };
export default { manipulateAsync, SaveFormat };
