import client from "./client";
import { DetailPage } from "@/types/api";

export const getDetailPage = async (trip_id: number): Promise<DetailPage> => {
  const { data } = await client.get<DetailPage>("/trip_days", {
    params: {
       trip_id: trip_id 
    }
  });
  return data;
};
