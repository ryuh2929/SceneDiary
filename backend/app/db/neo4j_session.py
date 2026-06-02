import os
from neo4j import AsyncGraphDatabase

# 환경 변수에서 설정값 가져오기
URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USER")
PASSWORD = os.getenv("NEO4J_PASSWORD")

# 드라이버 인스턴스 생성
TARGET_DB = "neo4j"  # 소중한 기존 데이터를 지키기 위한 새 도화지 방 이름!

class AuraNeo4j:
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(URI, auth=(USER, PASSWORD))

    # 세션을 열어주는 편의 함수
    def get_session(self):
        return self.driver.session(database=TARGET_DB)
    
    async def create_Index(self):
            queries = [
                "CREATE INDEX user_id_idx IF NOT EXISTS FOR (u:User) ON (u.userId);",
                "CREATE INDEX trip_id_idx IF NOT EXISTS FOR (t:Trip) ON (t.tripId);",
                "CREATE INDEX keyword_norm_idx IF NOT EXISTS FOR (k:Keyword) ON (k.normalizedName);",
                "CREATE INDEX place_norm_idx IF NOT EXISTS FOR (p:Place) ON (p.normalizedName);"
            ]
            
            async with self.driver.session(database=TARGET_DB) as session:
                for q in queries:
                    await session.run(q)
                    print(f"Executed: {q}")

aura_neo4j = AuraNeo4j() # 인스턴스 생성

async def get_db_session():
        async with aura_neo4j.get_session() as session:
            yield session # 요청이 끝나면 알아서 세션을 닫아줌