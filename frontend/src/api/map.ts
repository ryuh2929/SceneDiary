import client from "./client";
import { Days } from "@/types/api";

export const getTripDays = async (): Promise<Days[]> => {
  const { data } = await client.get<Days[]>("/trip_days");
  return data;
};
