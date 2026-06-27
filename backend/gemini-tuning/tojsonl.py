import json
from pathlib import Path

# 이 스크립트가 있는 폴더를 기준으로 파일 경로를 잡습니다.
base_dir = Path(__file__).resolve().parent
input_file = base_dir / 'poetic-persona-dpo-v2.json'
output_file = base_dir / 'poetic-persona-dpo-v2.jsonl'

with open(input_file, 'r', encoding='utf-8') as fin, \
     open(output_file, 'w', encoding='utf-8') as fout:
    
    # 1. JSON 파일 전체를 리스트로 읽어옵니다
    data = json.load(fin)
    
    # 2. 리스트의 각 항목을 한 줄씩 JSONL로 씁니다
    for entry in data:
        fout.write(json.dumps(entry, ensure_ascii=False) + '\n')

print(f"변환 완료: {output_file}")
