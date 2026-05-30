"""사용자의 여행 기록을 바탕으로 여행 유형 분석을 수행하는 서비스입니다.

라우터는 "언제 실행할지"만 결정하고, 실제 분석 준비와 저장 책임은 이 파일에 모읍니다.
아직 LLM 프롬프트와 결과 형식이 확정되지 않았으므로 지금은 백그라운드 작업 골격만 둡니다.
"""

from app.db.models import User
from app.db.session import SessionLocal


def run_travel_style_analysis(user_id: int) -> None:
    """여행글 최초 완료 이후 사용자 여행 유형 분석을 실행하는 백그라운드 작업입니다.

    백그라운드 작업은 요청이 끝난 뒤 실행되므로, 요청에서 쓰던 DB 세션을 재사용하지 않고 새 세션을 엽니다.
    실제 LLM 분석 프롬프트와 결과 저장 로직은 여행 유형 분석 API를 확정한 뒤 이 함수 안에 연결합니다.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return

        # 이미 분석 결과가 있으면 중복 호출로 들어와도 아무 작업도 하지 않습니다.
        if user.travel_style_analysis:
            return

        # TODO: 사용자의 완료된 여행글 데이터를 모아 LLM 여행 유형 분석 함수를 호출하고,
        # user.travel_style_analysis에 JSON 문자열로 저장합니다.
        print(f"[travel-style] pending: user_id={user_id}")
    except Exception as exc:
        print(f"[travel-style] FAILED: user_id={user_id}: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()
