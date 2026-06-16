import json
from pathlib import Path

# 이 스크립트가 있는 폴더를 기준으로 파일 경로를 잡습니다.
base_dir = Path(__file__).resolve().parent
input_file = base_dir / 'daily-persona-preference.jsonl'
output_file = base_dir / 'my_data.json'

data = []
with open(input_file, 'r', encoding='utf-8') as f:
    # 1. JSONL 파일을 한 줄씩 읽어서 리스트에 담습니다
    for line in f:
        if line.strip():  # 빈 줄 건너뛰기
            data.append(json.loads(line))

# 2. 리스트 전체를 예쁘게(indent=4) 저장합니다
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print("변환 완료! my_data.json 파일을 열어보세요.")
