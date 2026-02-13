// ============================================================
// LocoSnap — API Client Service
// Handles all communication with the LocoSnap backend
// ============================================================

import axios, { AxiosError } from "axios";
import {
  API_BASE_URL,
  BLUEPRINT_POLL_INTERVAL,
  BLUEPRINT_TIMEOUT,
} from "../constants/api";
import { IdentifyResponse, BlueprintStatus, BlueprintStyle } from "../types";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s for train identification (Claude can be slow)
});

/**
 * Upload a train photo and get identification results
 */
export async function identifyTrain(
  imageUri: string,
  blueprintStyle: BlueprintStyle = "technical"
): Promise<IdentifyResponse> {
  const formData = new FormData();

  // React Native FormData for image upload
  const filename = imageUri.split("/").pop() || "train.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("image", {
    uri: imageUri,
    name: filename,
    type: type,
  } as any);

  // Include blueprint style preference
  formData.append("blueprintStyle", blueprintStyle);

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
      "Could not connect to LocoSnap servers. Please try again later."
    );
  }
}

/**
 * Check blueprint generation status
 */
export async function checkBlueprintStatus(
  taskId: string
): Promise<BlueprintStatus> {
  try {
    const response = await api.get<BlueprintStatus>(
      `/api/blueprint/${taskId}`
    );
    return response.data;
  } catch {
    throw new Error("Could not check blueprint status.");
  }
}

/**
 * Poll for blueprint completion
 * Returns the image URL when ready, or null if it times out
 */
export function pollBlueprintStatus(
  taskId: string,
  onUpdate: (status: BlueprintStatus) => void
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

      if (Date.now() - startTime > BLUEPRINT_TIMEOUT) {
        onUpdate({
          taskId,
          status: "failed",
          imageUrl: null,
          error: "Blueprint generation timed out. You can try again later.",
        });
        resolve(null);
        return;
      }

      try {
        const status = await checkBlueprintStatus(taskId);
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
        timeoutId = setTimeout(poll, BLUEPRINT_POLL_INTERVAL);
      } catch {
        // Network error — retry
        timeoutId = setTimeout(poll, BLUEPRINT_POLL_INTERVAL * 2);
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
