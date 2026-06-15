import json

# 읽을 파일(train.jsonl)과 저장할 파일(pretty.json) 경로
input_file = r'D:\Project\SceneDiary\docs\gemini-tuning\daily-persona-preference.jsonl'
output_file = r'D:\Project\SceneDiary\docs\gemini-tuning\my_data.json'

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