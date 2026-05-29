from app.db.neo4j_session import get_neo4j_driver

# db 파일에서 만들어둔 통로를 가져옵니다.
driver = get_neo4j_driver()

def save_diary_to_neo4j(diary_data: dict):
    # 'session'을 열어 안전하게 쿼리를 실행합니다.
    with driver.session() as session:
        # 데이터 저장 로직(트랜잭션)을 실행합니다.
        session.execute_write(_execute_create_query, diary_data)

def _execute_create_query(tx, data):
    # Neo4j 쿼리문(Cypher)입니다.
    # $id, $content 같은 변수를 사용해 보안을 유지합니다(SQL 인젝션 방지).
    query = """
    MERGE (d:Diary {id: $id})
    SET d.content = $content
    MERGE (p:Place {name: $place})
    MERGE (d)-[:VISITED]->(p)
    """
    tx.run(query, id=data['id'], content=data['content'], place=data['place'])