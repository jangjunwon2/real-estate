import os
import resend


def send_failure_alert() -> None:
    resend.api_key = os.environ['RESEND_API_KEY']
    run_id = os.environ.get('GITHUB_RUN_ID', 'unknown')
    repo = os.environ.get('GITHUB_REPOSITORY', '')
    url = f'https://github.com/{repo}/actions/runs/{run_id}' if repo else '#'
    resend.Emails.send({
        'from': '부동산AI <alert@yourdomain.com>',
        'to': os.environ['USER_EMAIL'],
        'subject': '⚠️ 부동산AI 파이프라인 실패',
        'html': f'<p>파이프라인이 실패했습니다. <a href="{url}">GitHub Actions 로그 확인</a></p>',
    })


if __name__ == '__main__':
    send_failure_alert()
