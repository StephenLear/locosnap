// ============================================================
// LocoSnap — Supabase auth storage adapter (SecureStore)
// ============================================================
// SecureStore (iOS Keychain / Android Keystore) has a soft 2 KB
// limit per value on iOS — Supabase sessions sometimes exceed
// this once provider tokens are attached. We chunk the payload
// across N keys and store the chunk count alongside.
//
// On first launch after upgrade we also migrate any existing
// session out of AsyncStorage so users stay signed in.

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHUNK_SIZE = 1800;
const COUNT_SUFFIX = "__chunkCount";

async function setChunked(key: string, value: string): Promise<void> {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}${COUNT_SUFFIX}`, String(chunks));
  for (let i = 0; i < chunks; i++) {
    const part = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_${i}`, part);
  }
}

async function getChunked(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(`${key}${COUNT_SUFFIX}`);
  if (!countRaw) return null;
  const count = parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count < 1) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}_${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function removeChunked(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}${COUNT_SUFFIX}`);
  const count = countRaw ? parseInt(countRaw, 10) : 0;
  await SecureStore.deleteItemAsync(`${key}${COUNT_SUFFIX}`);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}_${i}`);
  }
}

export const secureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const fromSecure = await getChunked(key);
      if (fromSecure !== null) return fromSecure;
      // One-time migration: pull any leftover session out of AsyncStorage.
      const fromAsync = await AsyncStorage.getItem(key);
      if (fromAsync !== null) {
        await setChunked(key, fromAsync);
        await AsyncStorage.removeItem(key);
        return fromAsync;
      }
      return null;
    } catch (err) {
      console.warn("[SECURE_STORAGE] getItem failed:", err);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await setChunked(key, value);
    } catch (err) {
      console.warn("[SECURE_STORAGE] setItem failed:", err);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await removeChunked(key);
    } catch (err) {
      console.warn("[SECURE_STORAGE] removeItem failed:", err);
    }
  },
};
