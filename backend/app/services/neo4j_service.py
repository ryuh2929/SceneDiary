from app.db.neo4j_session import aura_neo4j
import uuid
from datetime import datetime


# seed에서 과거 데이터의 카테고리를 찾아내기
async def fetch_past_graph_context(
        user_id: str,
        seed: dict,
        limit: int = 3
) -> list[dict]:
    keyword_names = [k["name"] for k in seed.get("keywords", []) if k.get("name")]
    place_names = [p["name"] for p in seed.get("places", []) if p.get("name")]

    query = """
    MATCH (u:User {userId: $userId})-[:WENT_ON]->(pastTrip:Trip)

    OPTIONAL MATCH (pastTrip)-[:HAS_KEYWORD]->(k:Keyword)
    OPTIONAL MATCH (pastTrip)-[:VISITED]->(p:Place)
    OPTIONAL MATCH (pastTrip)-[:HAS_MEMORY]->(m:Memory)
    OPTIONAL MATCH (m)-[:HAS_KEYWORD]->(mk:Keyword)
    OPTIONAL MATCH (pastTrip)-[:HAS_DIARY]->(d:DiaryEntry)

    WITH pastTrip, d,
         collect(DISTINCT k.name) + collect(DISTINCT mk.name) AS allKeywords,
         collect(DISTINCT p.name) AS allPlaces,
         collect(DISTINCT {
            title: m.title,
            description: m.description,
            mood: m.mood,
            sequence: m.sequence
         }) AS memories

    WITH pastTrip, d, allKeywords, allPlaces, memories,
         size([x IN allKeywords WHERE x IN $keywordNames]) AS keywordScore,
         size([x IN allPlaces WHERE x IN $placeNames]) AS placeScore

    WITH pastTrip, d, allKeywords, allPlaces, memories,
         keywordScore,
         placeScore,
         keywordScore + placeScore * 2 AS totalScore

    WHERE totalScore > 0

    RETURN
      pastTrip.tripId AS tripId,
      pastTrip.title AS title,
      pastTrip.startDate AS startDate,
      pastTrip.endDate AS endDate,
      pastTrip.summary AS summary,
      pastTrip.mood AS mood,
      d.content AS diaryContent,
      allKeywords AS matchedKeywords,
      allPlaces AS matchedPlaces,
      memories AS memories,
      totalScore AS score

    ORDER BY score DESC, pastTrip.startDate DESC
    LIMIT $limit
    """

    async with aura_neo4j.get_session() as session:
        result = await session.run(
            query,
            userId=user_id,
            keywordNames=keyword_names,
            placeNames=place_names,
            limit=limit
        )
        return [record.data() async for record in result]
    



async def save_trip_graph(
        user_id: str,
        user_name:str,
        seed: dict,
        diary: dict,
        photos: list[dict],
        start_date,end_date
) -> str:
    trip_id = str(uuid.uuid4())
    diary_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    trip = seed.get("trip", {})
    places = seed.get("places", [])
    keywords = seed.get("keywords", [])
    memories = seed.get("memories", [])

    query = """
    MERGE (u:User {userId: $userId})
    ON CREATE SET u.name = $userName

    MERGE (t:Trip {tripId: $tripId})
    ON CREATE SET
      t.startDate = CASE WHEN $startDate IS NULL THEN null ELSE date($startDate) END,
      t.endDate = CASE WHEN $endDate IS NULL THEN null ELSE date($endDate) END,
      t.title = $title,
      t.summary = $summary,
      t.mood = $mood,
      t.travelType = $travelType,
      t.createdAt = datetime($createdAt)
    ON MATCH SET
      t.title = $title,
      t.summary = $summary,
      t.mood = $mood,
      t.travelType = $travelType,
      t.updatedAt = datetime($createdAt)

    MERGE (u)-[:WENT_ON {role: "owner"}]->(t)

    WITH t

    UNWIND $keywords AS keyword
      MERGE (k:Keyword {normalizedName: toLower(trim(keyword.name))})
      ON CREATE SET
        k.name = keyword.name,
        k.type = keyword.type
      MERGE (t)-[hk:HAS_KEYWORD]->(k)
      ON CREATE SET hk.weight = keyword.weight
      ON MATCH SET hk.weight = CASE
        WHEN hk.weight IS NULL THEN keyword.weight
        WHEN keyword.weight > hk.weight THEN keyword.weight
        ELSE hk.weight
      END

    WITH t

    UNWIND $memories AS memory
      MERGE (m:Memory {
        tripId: $tripId,
        sequence: memory.sequence
      })
      ON CREATE SET
        m.memoryId = randomUUID(),
        m.title = memory.title,
        m.description = memory.description,
        m.mood = memory.mood,
        m.confidence = memory.confidence
      ON MATCH SET
        m.title = memory.title,
        m.description = memory.description,
        m.mood = memory.mood,
        m.confidence = memory.confidence

      MERGE (t)-[hm:HAS_MEMORY]->(m)
      ON CREATE SET hm.sequence = memory.sequence

      WITH t, m, memory

      FOREACH (kw IN coalesce(memory.keywords, []) |
        MERGE (mk:Keyword {normalizedName: toLower(trim(kw))})
        ON CREATE SET mk.name = kw
        MERGE (m)-[:HAS_KEYWORD {weight: 0.8}]->(mk)
      )

      FOREACH (foodName IN coalesce(memory.foods, []) |
        MERGE (f:Food {normalizedName: toLower(trim(foodName))})
        ON CREATE SET f.name = foodName
        MERGE (m)-[ate:ATE]->(f)
        ON CREATE SET ate.confidence = memory.confidence
      )

      FOREACH (activityName IN coalesce(memory.activities, []) |
        MERGE (a:Activity {normalizedName: toLower(trim(activityName))})
        ON CREATE SET a.name = activityName
        MERGE (m)-[did:DID]->(a)
        ON CREATE SET did.confidence = memory.confidence
      )

      FOREACH (emotionName IN coalesce(memory.emotions, []) |
        MERGE (e:Emotion {normalizedName: toLower(trim(emotionName))})
        ON CREATE SET
          e.name = emotionName,
          e.polarity = "unknown"
        MERGE (m)-[felt:FELT]->(e)
        ON CREATE SET felt.intensity = memory.mood
      )

      FOREACH (_ IN CASE WHEN memory.placeName IS NULL THEN [] ELSE [1] END |
        MERGE (mp:Place {
          normalizedName: toLower(trim(memory.placeName)),
          type: "unknown"
        })
        ON CREATE SET
          mp.placeId = randomUUID(),
          mp.name = memory.placeName
        MERGE (m)-[ha:HAPPENED_AT]->(mp)
        ON CREATE SET
          ha.source = "vlm",
          ha.confidence = memory.confidence
      )
    """

    params = {
        "userId": user_id,
        "userName": user_name,
        "tripId": trip_id,
        "startDate": start_date,
        "endDate": end_date,
        "title": diary.get("title") or trip.get("title"),
        "summary": diary.get("summary") or trip.get("summary"),
        "mood": diary.get("mood") or trip.get("mood"),
        "travelType": trip.get("travelType"),
        "createdAt": now,
        "keywords": keywords,
        "memories": memories,
    }

    async with aura_neo4j.get_session() as session:
        await session.run(query, **params)

    return trip_id