import client from "./client";
import { useUserStore } from "@/data/userStore";
import { Trip } from "@/types/api";

export const getTripDays = async (): Promise<Trip[]> => {
  const user_id = useUserStore.getState().userProfile?.userId;
  console.log("현재 map 호출하는 user_id:", user_id); // 이게 undefined라면 422 에러가 납니다!
  const { data } = await client.get<Trip[]>("/trips", {
    params: {
      user_id: Number(user_id),
    },
  });
  return data;
};
