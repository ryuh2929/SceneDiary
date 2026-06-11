## 참고 주소
https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/preference-tuning/prepare-data?hl=ko&_gl=1*n0xwq7*_ga*MTMzODAwMTA1OC4xNzgxMTQ5NzU0*_ga_WH2QY8WWF5*czE3ODExNTM4MDgkbzIkZzEkdDE3ODExNTg1ODgkajEyJGwwJGgw

이 문서에서는 Gemini 모델의 선호도 조정 데이터 세트를 정의하는 방법을 설명합니다.

## 선호도 조정 데이터 세트 정보

선호도 조정 데이터 세트는 좋아요/싫어요, 쌍별, 점수 피드백과 같은 신호를 사용하여 인간 선호도를 포착하기 위해 생성됩니다.

## 맞춤설정된 선호도 조정 데이터 준비

이 예에서는 다음과 같이 정의됩니다.

example은 입력과 completions 필드 쌍으로 구성됩니다.

입력에는 contents 및 선택적 system_instruction이 포함됩니다. 최대 입력 및 최대 완성 토큰 수의 합계는 128K 이하여야 합니다.

contents 필드는
[지도 미세 조정에 사용되는 형식](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini-supervised-tuning-prepare#example-contents)과 동일합니다. 사용자 턴으로 끝나야 하는 멀티턴 텍스트 데이터를 지원합니다. 멀티모달 데이터는 지원하지 않습니다.

completions 필드는 한 쌍의 완성된 턴과 해당 점수로 구성됩니다. 이 쌍에는 선호하는 완성된 턴 하나와 선호하지 않는 완성된 턴 하나가 있어야 합니다.

completion은 모델 응답을 나타내는 단일 모델 턴입니다. score 필드는 완성된 턴이 선호되는지 여부를 나타냅니다. 가능한 값은 0 또는 1뿐입니다. 0은 선호하지 않는 완성된 턴을 나타내고 1은 선호하는 완성된 턴을 나타냅니다.

각 example의 completions 턴에 대해서만 학습합니다.

## Gemini용 데이터 세트 예시

    {
      "system_instruction": {
        "parts": [
          {
            "text": "You are a chat bot."
          }
        ]
      },
      "contents": [
        {
          "role": "user",
          "parts": [
            {
              "text": "What is my favorite fruit?"
            }
          ]
        }
      ],
      "completions": [
        {
          "score": 1,
          "completion": {
            "role": "model",
            "parts": [
              {
                "text": "Apple! Apple! Apple!"
              }
            ]
          }
        },
        {
          "score": 0,
          "completion": {
            "role": "model",
            "parts": [
              {
                "text": "Your favorite fruit is apple."
              }
            ]
          }
        }
      ]
    }

## 다음 단계

- [선호도 조정을 사용하여 Gemini 모델 조정](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini-use-preference-tuning).


## 구글 클라우드의 jsonl 테스트 셋에 대한 답변
사용자님께서 제공해주신 링크와 데이터 형식을 보니, 제가 이전에 안내해 드린 내용은 일반적인 **파인튜닝(SFT, Supervised Fine-Tuning)**에 대한 것이었고, 지금 하시는 작업은 구글이 제공하는 **'Preference Tuning(선호도 튜닝)'**이 맞습니다. 제가 이 부분을 놓치고 일반적인 튜닝 가이드를 드려 혼란을 드렸네요.

공식 문서를 보고 계신다면 그 방향이 맞습니다. Preference Tuning은 모델에게 "이런 답변이 저런 답변보다 더 좋아!"라고 가르치는 방식이라서, 데이터셋 구성에 대한 질문이 훨씬 핵심적입니다.

질문하신 **"'어색한 문체, 과장된 문체 등 여러 가지' 중에 고민하는 것"**에 대해 명확히 답변해 드릴게요.

결론: '비선호(Score: 0)' 데이터도 일관성이 있어야 합니다.
모델에게 "이런 거 하지 마"라고 가르칠 때, 그 "하지 말아야 할 것(Score: 0)"의 기준을 하나로 통일하는 것이 훨씬 학습 효과가 좋습니다.

1. 왜 일관성이 중요한가요?
Preference Tuning은 모델이 **'선호도 경계선'**을 배우는 과정입니다.

만약 Score: 0 데이터에 어떤 건 '너무 시적인 표현', 어떤 건 '너무 짧고 성의 없는 답변', 어떤 건 '맞춤법이 틀린 답변'을 섞어 넣으면, 모델은 **"대체 왜 이게 나쁜 거지?"**라고 헷갈려 합니다.
반면, **"우리는 일상적이고 담백한 문체를 원해"**라는 목표가 확실하다면, Score: 0인 데이터는 **모두 일관되게 '과장되거나 문학적인 표현'**으로 구성하는 것이 좋습니다.
2. 전략적 데이터셋 구성 팁
지금 사용자님의 목표는 **"과장된 문학적 표현을 피하고, 일상적이고 담백하게 기록하는 것"**입니다. 그렇다면 데이터셋을 이렇게 구성하세요:

Score: 1 (선호): 당연히 사용자님이 원하는 담백하고 일상적인 말투.
Score: 0 (비선호): 무조건 '과장되고 문학적인 표현'을 포함한 답변.
이렇게 하면 모델은 **"질문이 들어왔을 때, 시적이고 과장된 톤으로 말하면 점수가 낮아지고, 담백하고 일상적인 톤으로 말하면 점수가 높아지는구나!"**라는 명확한 패턴을 학습하게 됩니다.

3. 너무 다양한 비선호 예시는 피하세요
비선호 예시에 너무 다양한 부정적 케이스(예: 비속어, 거짓말, 시적 표현, 아주 짧은 답변 등)를 섞으면, 모델이 '좋은 답변'의 정의를 제대로 배우지 못하고 '나쁜 답변'의 범위만 너무 넓어져서 성능이 저하될 수 있습니다.

요약하자면:

지금 하시는 방식대로 하시는 게 맞습니다. (데이터 형식도 정확합니다.)
데이터셋을 만들 때 Score: 0 (비선호) 예시들은 모두 '문학적이고 과장된 문체'로 통일해서 학습시켜 보세요. 그러면 모델이 "아, 내 핵심 임무는 '과장하지 않는 것'이구나"라는 것을 확실하게 인지할 것입니다.
이미 공식 문서를 찾아보실 정도라면 꽤 높은 수준의 튜닝을 하시는 거니, 지금 방향대로 **'비선호 데이터의 일관성'**만 유지해서 밀고 나가시면 아주 좋은 모델이 나올 것 같습니다!