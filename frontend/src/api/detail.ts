import client from "./client";
import { DetailPage } from "@/types/api";

export const getDetailPage = async (trip_id: number): Promise<DetailPage> => {
  console.log("상세보기 trip_days 호출")
  const { data } = await client.get<DetailPage>("/detail/trip_days", {
    params: {
       trip_id: trip_id 
    }
  });
  return data;
};
