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

export interface Trip {
  id: number;                // int8 (기본키 PK)
  user_id: number;           // int8 (외래키 FK)
  title: string;             // varchar(200)
  destination: string;       // varchar(200)
  start_date: string;        // date ('YYYY-MM-DD' 형태의 문자열)
  end_date: string;          // date ('YYYY-MM-DD' 형태의 문자열)
  cover_photo_id: number | null; // int8 (커버 사진이 없을 수도 있으므로 null 허용)
  status: string;            // varchar(20) (예: 'PLANNING', 'TRAVELING', 'COMPLETED')
  tripDays:Days[];
}