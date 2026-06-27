from app.db.neo4j_session import aura_neo4j
import uuid
from datetime import datetime,date, timezone
import json
from typing import List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone


# 스키마 정의
class Place(BaseModel):
    name: Optional[str] = None # 장소 명
    type: Optional[str] = None  #"landmark|restaurant|cafe|beach|street|unknown"
    country: Optional[str] = None # 나라명 
    city: Optional[str] = None # 도시명
    lat: Optional[float] = None # 위치
    lng: Optional[float] = None # 위치
    confidence: Optional[float] = 0.0 # 사진 분석 정확도

class Keyword(BaseModel):
    name: List[str] = Field(default_factory=list) # 키워드 명 "밥", "치즈", "사람들", "영화관 좌석"
    type: List[str] = Field(default_factory=list)  # 장소 유형 "landmark|restaurant|unknown"
    weight: Optional[float] = 0.0

class Day_Memory(BaseModel):
    title: Optional[str] = None # 당일 제목
    description: Optional[str] = None # 당일 내용
    day_number: Optional[int] = 1 # 일차
    mood: Optional[str] = None # 당일 기분
    weather: Optional[str] = None # 당일 날씨
    keywords: Optional[Keyword] = None #당일 키워드
    place: List[Place] = Field(default_factory=list) # 당일 장소
    emotions: Optional[str] = None  # 당일 기분
    summaryShort: Optional[str] = None # 당일 내용 요약

class TripData(BaseModel):
    title: Optional[str] = None # 여행 제목
    mood_persona: Optional[str] = None # 작성 페르소나
    travelType: Optional[str] = None # 국기(국냉여행, 해외여행)
    startDate: Optional[date] = None
    endDate: Optional[date] = None

class Seed(BaseModel):
    trip: TripData # 여행
    days: List[Day_Memory] = Field(default_factory=list)# 여행 상세

# seed에서 과거 데이터의 카테고리를 찾아내기
def past_graph_context(
        user_id: str,
        seed: Seed,
        limit: int = 3
) -> list[dict]:
    keyword_names = [
        name
        for day in seed.days
        if day.keywords
        for name in (day.keywords.name or [])
        if name
    ]
    place_names = [
        place.name
        for day in seed.days
        for place in (day.place or [])
        if place.name
    ]

    keyword_names = list(dict.fromkeys(keyword_names))
    place_names = list(dict.fromkeys(place_names))
    print("입력 키워드:",keyword_names)
    print("입력 장소:",place_names)
    query = """
    MATCH (u:User {userId: $userId})-[:WENT_ON]->(pastTrip:Trip)

    OPTIONAL MATCH (pastTrip)-[:HAS_MEMORY]->(m:Memory)
    OPTIONAL MATCH (m)-[:HAS_KEYWORD]->(mk:Keyword)
    OPTIONAL MATCH (pastTrip)-[:VISITED]->(p:Place)

    WITH pastTrip,
     collect(DISTINCT mk.name) AS allKeywords,
     collect(DISTINCT p.name) AS allPlaces,
     collect(DISTINCT {
        title: m.title,
        description: m.description,
        mood: m.mood,
        day_number: m.day_number,
        weather: m.weather,
        emotions: m.emotions,
        summaryShort: m.summaryShort
     }) AS memories

    WITH pastTrip, allKeywords, allPlaces, memories,
        size([x IN allKeywords WHERE x IN $keywordNames]) AS keywordScore,
        size([x IN allPlaces WHERE x IN $placeNames]) AS placeScore

    WITH pastTrip, allKeywords, allPlaces, memories,
        keywordScore,
        placeScore,
        keywordScore + placeScore * 2 AS totalScore

    WHERE totalScore > 0

    RETURN
      pastTrip.tripId AS tripId,
      pastTrip.title AS title,
      pastTrip.startDate AS startDate,
      pastTrip.endDate AS endDate,
      pastTrip.travelType AS travelType,
      pastTrip.mood_persona AS mood_persona,
      allKeywords AS matchedKeywords,
      allPlaces AS matchedPlaces,
      memories AS memories,
      totalScore AS score

    ORDER BY score DESC, pastTrip.startDate DESC
    LIMIT $limit
    """

    with aura_neo4j.get_session() as session:
        result = session.run(
            query,
            userId=user_id,
            keywordNames=keyword_names,
            placeNames=place_names,
            limit=limit
        )
        records = [record.data() for record in result]

        print("조회 키워드:", keyword_names)
        print("조회 장소:", place_names)
        print("조회 내용:")
        for record in records:
            print(record)
            
        return records



def save_trip_graph(
        user_id: str,
        user_name:str,
        seed: Seed,
        trip_id:int
) -> bool:
    trip_id = str(trip_id)
    now = datetime.now(timezone.utc).isoformat()

    trip = seed.trip
    days = [mem.model_dump() for mem in seed.days]

    query = """
    MERGE (u:User {userId: $userId})
    ON CREATE SET u.name = $userName

    MERGE (t:Trip {tripId: $tripId})
    ON CREATE SET
      t.startDate = CASE WHEN $startDate IS NULL THEN null ELSE date($startDate) END,
      t.endDate = CASE WHEN $endDate IS NULL THEN null ELSE date($endDate) END,
      t.title = $title,
      t.mood_persona = $mood_persona,
      t.travelType = $travelType,
      t.createdAt = datetime($createdAt)
    ON MATCH SET
      t.title = $title,
      t.mood_persona = $mood_persona,
      t.travelType = $travelType,
      t.updatedAt = datetime($createdAt)

    MERGE (u)-[:WENT_ON {role: "owner"}]->(t)

    WITH t

    UNWIND $days_memories AS memory
      MERGE (m:Memory {
        tripId: $tripId,
        day_number: memory.day_number
      })
      ON CREATE SET
        m.memoryId = randomUUID(),
        m.title = memory.title,
        m.description = memory.description,
        m.mood = memory.mood,
        m.weather = memory.weather,
        m.emotions = memory.emotions,
        m.summaryShort = memory.summaryShort
        
      ON MATCH SET
        m.title = memory.title,
        m.description = memory.description,
        m.mood = memory.mood,
        m.weather = memory.weather,
        m.emotions = memory.emotions,
        m.summaryShort = memory.summaryShort

      MERGE (t)-[hm:HAS_MEMORY]->(m)
      SET hm.day_number = memory.day_number

      WITH t, m, memory

      OPTIONAL MATCH (m)-[oldKw:HAS_KEYWORD]->(:Keyword)
      DELETE oldKw

      WITH t, m, memory

      OPTIONAL MATCH (m)-[oldPlace:VISITED]->(:Place)
      DELETE oldPlace

      WITH t, m, memory

      FOREACH (kwName IN CASE
        WHEN memory.keywords IS NULL THEN []
        ELSE coalesce(memory.keywords.name, [])
      END |
        MERGE (mk:Keyword {normalizedName: toLower(trim(kwName))})
        ON CREATE SET 
          mk.name = kwName,
          mk.type = CASE
            WHEN size(coalesce(memory.keywords.type, [])) > 0
            THEN memory.keywords.type[0]
            ELSE "unknown"
          END
        MERGE (m)-[hk:HAS_KEYWORD]->(mk)
        SET hk.weight = coalesce(memory.keywords.weight, 0.8)
      )

      FOREACH (p_obj IN [p IN coalesce(memory.place, []) WHERE p.name IS NOT NULL] |
        MERGE (p:Place {normalizedName: toLower(trim(p_obj.name))})
        ON CREATE SET 
          p.name = p_obj.name,
          p.type = p_obj.type,
          p.country = p_obj.country,
          p.city = p_obj.city,
          p.lat = toFloat(p_obj.lat),
          p.lng = toFloat(p_obj.lng),
          p.confidence = p_obj.confidence
        MERGE (m)-[visited:VISITED]->(p)
      )
    """

    params = {
        "userId": user_id,
        "userName": user_name,
        "tripId": trip_id,
        "startDate": trip.startDate.isoformat() if trip.startDate else None,
        "endDate": trip.endDate.isoformat() if trip.endDate else None,
        "title": trip.title,
        "mood_persona": trip.mood_persona,
        "travelType": trip.travelType,
        "createdAt": now,
        "days_memories": days,
    }

    try:
      with aura_neo4j.get_session() as session:
          result = session.run(query, **params)
          result.consume()

      print("neo4j 저장 성공")
      return True

    except Exception as exc:
        print("neo4j 저장 실패")
        print(f"[neo4j] save_trip_graph failed: {exc}")
        return False


from app.db.models import TripDay, Trip
def update_trip_day_graph(trip_day: TripDay, trip: Trip) -> bool:
    query = """
    MERGE (t:Trip {tripId: $tripId})
    SET
      t.title = $tripTitle,
      t.travelType = $travelType,
      t.updatedAt = datetime($updatedAt)

    MERGE (m:Memory {
      tripId: $tripId,
      day_number: $dayNumber
    })
    ON CREATE SET
      m.memoryId = randomUUID()
    SET
      m.title = $title,
      m.description = $description,
      m.weather = $weather,
      m.emotions = $emotions,
      m.locationSummary = $locationSummary,
      m.updatedAt = datetime($updatedAt)

    MERGE (t)-[hm:HAS_MEMORY]->(m)
    SET hm.day_number = $dayNumber
    """

    params = {
        "tripId": str(trip.id),
        "tripTitle": trip.title,
        "travelType": trip.flag,
        "dayNumber": trip_day.day_number,
        "title": trip_day.subtitle,
        "description": trip_day.content,
        "weather": trip_day.weather,
        "emotions": trip_day.emotion,
        "locationSummary": trip_day.location_summary,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        with aura_neo4j.get_session() as session:
            session.run(query, **params).consume()
        return True
    except Exception as exc:
        print(f"[neo4j] update_trip_day_graph failed: {exc}")
        return False