import client from "./client";
import { Trip } from "@/types/api";

export const getTrips = async (year: number, user_id : number): Promise<Trip[]> => {
  const { data } = await client.get<Trip[]>("/home/trips", {
    params: {
      year: year, // 백엔드에 year=2026 형태로 알아서 변환되어 날아갑니다.
      user_id: user_id
    }
  });
  return data;
};
