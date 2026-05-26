export interface Photo {
  id: number;
  file_url: string;
  thumbnail_url: string;
  image_url: string; // 가공된 URL
  thumbnail_image_url: string; // 가공된 썸네일 URL
}
export interface Days {
  id: number;
  trip_id: number;
  day_number: number;
  date: string;

  location_summary: string | null;
  weather: string | null;
  subtitle: string | null;
  emotion: string | null;
  content: string | null;
  symbol: string | null;

  representative_lat: number | null;
  representative_lon: number | null;
  represent_image: number | null;

  photos: Photo[];
}
