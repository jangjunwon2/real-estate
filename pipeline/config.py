import os
from dataclasses import dataclass


@dataclass
class Config:
    naver_client_id: str
    naver_client_secret: str
    molit_api_key: str
    bok_api_key: str
    anthropic_api_key: str
    backend_url: str
    pipeline_api_key: str
    resend_api_key: str
    resend_from: str
    solapi_api_key: str
    solapi_api_secret: str
    kakao_sender_key: str
    kakao_template_urgent: str
    kakao_template_property: str
    kakao_rest_api_key: str
    user_email: str
    user_phone: str
    user_region: str
    user_budget_min: int
    user_budget_max: int


def load_config() -> Config:
    required = [
        'NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET',
        'ANTHROPIC_API_KEY', 'BACKEND_URL', 'PIPELINE_API_KEY',
        'RESEND_API_KEY', 'USER_EMAIL',
    ]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f'필수 환경변수 누락: {missing}')
    return Config(
        naver_client_id=os.environ['NAVER_CLIENT_ID'],
        naver_client_secret=os.environ['NAVER_CLIENT_SECRET'],
        molit_api_key=os.environ.get('MOLIT_API_KEY', ''),
        bok_api_key=os.environ.get('BOK_API_KEY', ''),
        anthropic_api_key=os.environ['ANTHROPIC_API_KEY'],
        backend_url=os.environ['BACKEND_URL'].rstrip('/'),
        pipeline_api_key=os.environ['PIPELINE_API_KEY'],
        resend_api_key=os.environ['RESEND_API_KEY'],
        resend_from=os.environ.get('RESEND_FROM', 'onboarding@resend.dev'),
        solapi_api_key=os.environ.get('SOLAPI_API_KEY', ''),
        solapi_api_secret=os.environ.get('SOLAPI_API_SECRET', ''),
        kakao_sender_key=os.environ.get('KAKAO_SENDER_KEY', ''),
        kakao_template_urgent=os.environ.get('KAKAO_TEMPLATE_URGENT', ''),
        kakao_template_property=os.environ.get('KAKAO_TEMPLATE_PROPERTY', ''),
        kakao_rest_api_key=os.environ.get('KAKAO_REST_API_KEY', ''),
        user_email=os.environ['USER_EMAIL'],
        user_phone=os.environ.get('USER_PHONE', ''),
        user_region=os.environ.get('USER_REGION', '서울'),
        user_budget_min=int(os.environ.get('USER_BUDGET_MIN', 30000)),
        user_budget_max=int(os.environ.get('USER_BUDGET_MAX', 60000)),
    )
