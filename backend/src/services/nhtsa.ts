// ============================================================
// CarSnap — NHTSA API Service
// Free government API for vehicle specs and safety ratings
// ============================================================

import axios from "axios";
import { CarSpecs } from "../types";

const NHTSA_BASE = "https://api.nhtsa.gov";

interface NHTSADecodeResult {
  Variable: string;
  Value: string | null;
  ValueId: string | null;
}

/**
 * Get vehicle specifications from NHTSA
 */
export async function getCarSpecs(
  make: string,
  model: string,
  year: number
): Promise<CarSpecs> {
  const specs: CarSpecs = {
    safetyRating: null,
    crashTestRatings: {
      overall: null,
      frontal: null,
      side: null,
      rollover: null,
    },
    fuelEconomy: null,
    engine: null,
    horsepower: null,
    torque: null,
    transmission: null,
    drivetrain: null,
    wheelbase: null,
    curbWeight: null,
    dimensions: null,
  };

  // Fetch safety ratings
  try {
    const safetyUrl = `${NHTSA_BASE}/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}?format=json`;
    const safetyResponse = await axios.get(safetyUrl, { timeout: 10000 });

    if (safetyResponse.data?.Results?.length > 0) {
      const vehicleId = safetyResponse.data.Results[0].VehicleId;

      if (vehicleId) {
        const ratingsUrl = `${NHTSA_BASE}/SafetyRatings/VehicleId/${vehicleId}?format=json`;
        const ratingsResponse = await axios.get(ratingsUrl, { timeout: 10000 });

        if (ratingsResponse.data?.Results?.length > 0) {
          const ratings = ratingsResponse.data.Results[0];
          specs.safetyRating = parseFloat(ratings.OverallRating) || null;
          specs.crashTestRatings = {
            overall: parseFloat(ratings.OverallRating) || null,
            frontal: parseFloat(ratings.OverallFrontCrashRating) || null,
            side: parseFloat(ratings.OverallSideCrashRating) || null,
            rollover: parseFloat(ratings.RolloverRating) || null,
          };
        }
      }
    }
  } catch (error) {
    console.warn("NHTSA safety ratings unavailable:", (error as Error).message);
  }

  // Fetch vehicle specs via VIN decode API (using make/model/year search)
  try {
    const decodeUrl = `${NHTSA_BASE}/vehicles/DecodeModelYear/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}/modelyear/${year}?format=json`;
    const decodeResponse = await axios.get(decodeUrl, { timeout: 10000 });

    if (decodeResponse.data?.Results) {
      const results: NHTSADecodeResult[] = decodeResponse.data.Results;

      for (const result of results) {
        if (!result.Value) continue;

        switch (result.Variable) {
          case "Engine Number of Cylinders":
            // Will be combined with displacement below
            break;
          case "Displacement (L)":
            const cylinders = results.find(
              (r) => r.Variable === "Engine Number of Cylinders"
            )?.Value;
            specs.engine = cylinders
              ? `${result.Value}L ${cylinders}-Cylinder`
              : `${result.Value}L`;
            break;
          case "Engine Brake (hp) From":
            specs.horsepower = parseInt(result.Value) || null;
            break;
          case "Transmission Style":
            specs.transmission = result.Value;
            break;
          case "Drive Type":
            specs.drivetrain = result.Value;
            break;
          case "Wheel Base (inches) From":
            specs.wheelbase = `${result.Value} in`;
            break;
          case "Curb Weight (lbs)":
            specs.curbWeight = `${result.Value} lbs`;
            break;
        }
      }
    }
  } catch (error) {
    console.warn("NHTSA vehicle specs unavailable:", (error as Error).message);
  }

  return specs;
}
