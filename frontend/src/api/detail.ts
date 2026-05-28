import client from "./client";
import { Trip } from "@/types/api";

export const getDetailPage = async (trip_id: number): Promise<Trip> => {
  const { data } = await client.get<Trip>("/trip_days", {
    params: {
       trip_id: trip_id 
    }
  });
  return data;
};
