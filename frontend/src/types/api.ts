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
}
