// ============================================================
// CarSnap — API Client Service
// Handles all communication with the CarSnap backend
// ============================================================

import axios, { AxiosError } from "axios";
import {
  API_BASE_URL,
  INFOGRAPHIC_POLL_INTERVAL,
  INFOGRAPHIC_TIMEOUT,
} from "../constants/api";
import { IdentifyResponse, InfographicStatus } from "../types";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s for car identification (Claude can be slow)
});

/**
 * Upload a car photo and get identification results
 */
export async function identifyCar(
  imageUri: string
): Promise<IdentifyResponse> {
  const formData = new FormData();

  // React Native FormData for image upload
  const filename = imageUri.split("/").pop() || "car.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("image", {
    uri: imageUri,
    name: filename,
    type: type,
  } as any);

  try {
    const response = await api.post<IdentifyResponse>(
      "/api/identify",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ error: string }>;

    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }

    if (axiosError.code === "ECONNABORTED") {
      throw new Error(
        "Request timed out. Please check your connection and try again."
      );
    }

    throw new Error(
      "Could not connect to CarSnap servers. Please try again later."
    );
  }
}

/**
 * Check infographic generation status
 */
export async function checkInfographicStatus(
  taskId: string
): Promise<InfographicStatus> {
  try {
    const response = await api.get<InfographicStatus>(
      `/api/image/${taskId}`
    );
    return response.data;
  } catch {
    throw new Error("Could not check infographic status.");
  }
}

/**
 * Poll for infographic completion
 * Returns the image URL when ready, or null if it times out
 */
export function pollInfographicStatus(
  taskId: string,
  onUpdate: (status: InfographicStatus) => void
): { cancel: () => void; promise: Promise<string | null> } {
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  const cancel = () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };

  const promise = new Promise<string | null>((resolve) => {
    const startTime = Date.now();

    const poll = async () => {
      if (cancelled) {
        resolve(null);
        return;
      }

      if (Date.now() - startTime > INFOGRAPHIC_TIMEOUT) {
        onUpdate({
          taskId,
          status: "failed",
          imageUrl: null,
          error: "Infographic generation timed out. You can try again later.",
        });
        resolve(null);
        return;
      }

      try {
        const status = await checkInfographicStatus(taskId);
        onUpdate(status);

        if (status.status === "completed" && status.imageUrl) {
          resolve(status.imageUrl);
          return;
        }

        if (status.status === "failed") {
          resolve(null);
          return;
        }

        // Continue polling
        timeoutId = setTimeout(poll, INFOGRAPHIC_POLL_INTERVAL);
      } catch {
        // Network error — retry
        timeoutId = setTimeout(poll, INFOGRAPHIC_POLL_INTERVAL * 2);
      }
    };

    poll();
  });

  return { cancel, promise };
}

/**
 * Health check — verify the backend is running
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await api.get("/api/health", { timeout: 5000 });
    return response.data.status === "ok";
  } catch {
    return false;
  }
}
