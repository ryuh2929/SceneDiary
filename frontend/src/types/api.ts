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

  representative_lat: number | null;
  representative_lon: number | null;
  represent_image: string | null;

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
  flag: string | null;       // 여행 대표 이모지 (Twemoji codepoint)
  tripDays:Days[];
}

export interface DetailPage extends Omit<Trip, 'tripDays'> {
  tripDetail: Days[];
}

export type UploadedPhoto = {
  id: number;
  thumbnailUrl: string;
  fileUrl: string;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  displayOrder: number;
};

export type LoadingStep =
  | 'uploading'
  | 'resizing_images'
  | 'creating_thumbnails'
  | 'analyzing_metadata'
  | 'analyzing_photos'
  | 'generating_diary'
  | 'completed'
  | 'failed';

export type UploadedDay = {
  tripDayId: number;
  day: number;
  date: string;
  photos: UploadedPhoto[];
};

export type FirstDayUploadResponse = {
  tripId: number;
  tripDayId: number;
  day: number;
  status: LoadingStep;
  photos: UploadedPhoto[];
  days: UploadedDay[];
};

export type GenerationResponse = {
  tripId: number;
  tripDayId: number;
  day: number;
  status: LoadingStep;
  progress: number;
  errorMessage?: string | null;
};
