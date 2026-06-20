import json
from pathlib import Path

base_dir = Path(__file__).parent


# 읽을 파일(pretty.json)과 저장할 파일(train.jsonl) 경로
input_file = base_dir / 'persona_happy.json' 
output_file = base_dir / 'train.jsonl'

with open(input_file, 'r', encoding='utf-8') as fin, \
     open(output_file, 'w', encoding='utf-8') as fout:
    
    # 1. JSON 파일 전체를 리스트로 읽어옵니다
    data = json.load(fin)
    
    # 2. 리스트의 각 항목을 한 줄씩 JSONL로 씁니다
    for entry in data:
        fout.write(json.dumps(entry, ensure_ascii=False) + '\n')

print(f"변환 완료: {output_file}")
