# SceneDiary

Python 3.13.13
node v24.x
npm 11.x

루트 디렉토리에 `.env` 파일 만들기 (NEO4J_USER는 neo4j 권장)
```
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
POSTGRES_PASSWORD=your_password
OPENAI_API_KEY=your_api_key
```

도커 처음 빌드할 때
```
docker compose up --build
```

도커 실행할 때
```
docker compose up -d
```
