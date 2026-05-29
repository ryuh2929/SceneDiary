import os
from neo4j import GraphDatabase

# 환경 변수에서 설정값 가져오기
URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "password1234")

# 드라이버 인스턴스 생성
driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def get_neo4j_driver():
    return driver