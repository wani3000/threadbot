# threadbot

항공사 취업/승무원 채용 정보를 주간 수집하고, 계정 말투로 Threads 게시글을 하루 1회 생성/업로드하는 MVP입니다.

## Vercel 배포 버전

`Vercel + Resend + Supabase` 마이그레이션 버전은 `vercel/` 폴더에 있습니다.

- 배포 가이드: [/Users/chulwan/Documents/GitHub/threadbot/vercel/README.md](/Users/chulwan/Documents/GitHub/threadbot/vercel/README.md)
- Supabase 스키마: [/Users/chulwan/Documents/GitHub/threadbot/vercel/supabase/schema.sql](/Users/chulwan/Documents/GitHub/threadbot/vercel/supabase/schema.sql)

## 1) 설치

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

## 2) 입력 데이터

- 소스 목록: `data/inputs/sources.yaml`
- 수동 보강(소셜/비정형): `data/inputs/manual_items.csv`
- 계정 말투 샘플: `data/style/writing_samples.txt`

기본 운영 정책:
- 수집 1순위는 공식 항공사 채용 페이지
- 비공식 소스(블로그/SNS)는 수동 검증 후 보강 CSV에만 반영 권장

왜 수동 보강이 필요한가:
- Instagram/Threads/Facebook은 크롤링 차단 또는 동적 렌더링이 많아 자동 수집 누락이 생길 수 있습니다.
- 그래서 주간 운영에서는 자동 수집 + 수동 보강 CSV를 함께 쓰는 것이 안정적입니다.

## 3) 실행

주간 수집(최근 7일):

```bash
weekly_collect --days 7
```

결과 파일:
- `data/outputs/signals_*.json`
- `data/outputs/signals_*.md`

일일 게시글 생성/게시:

```bash
daily_post
```

결과 파일:
- `data/outputs/post_*.json`
- `data/outputs/publish_*.json`

오전 7시 검수용 초안 생성/이메일 발송:

```bash
morning_prepare
```

결과 파일:
- `data/outputs/draft_YYYY-MM-DD.json`
- SMTP 설정이 있으면 이메일 발송, 없으면 콘솔 출력

대시보드 실행:

```bash
streamlit run /Users/chulwan/Documents/GitHub/threadbot/src/threadbot/dashboard.py
```

대시보드 메뉴:
- 홈
  - 최근 7일 자동 게시글
  - 수집 데이터 기반 주간 추천 글 5개
  - Threads 태그 기반 최신 글 리스팅(공개 검색 기준)
  - 진행중 채용 정보
- 수집
  - 현재 수집 URL 목록
  - URL 추가하기 버튼(즉시 `sources.yaml` 반영)
- 글수정
  - `draft_*.json` 본문 수정/저장
  - 승인 완료 시 09:00 자동게시에서 해당 본문 사용

## 4) 자동화(크론 예시)

매주 월요일 08:00 수집:

```cron
0 8 * * 1 cd /Users/chulwan/Documents/GitHub/threadbot && ./scripts/run_weekly.sh
```

매일 09:00 게시:

```cron
0 9 * * * cd /Users/chulwan/Documents/GitHub/threadbot && ./scripts/run_daily.sh
```

요청 기준(한국시간 오전 9시)으로 자동 등록:

```bash
./scripts/install_cron_kst.sh
```

자동 등록 시 포함되는 스케줄(KST):
- 월요일 08:30: 주간 수집
- 매일 07:00: 초안 생성 + 이메일 전송
- 매일 09:00: 자동 게시

## 5) 실제 게시 전환

기본은 `THREADS_DRY_RUN=true` 입니다.

실제 업로드하려면:
1. `.env`에서 `THREADS_DRY_RUN=false`
2. `THREADS_PUBLISH_ENDPOINT`, `THREADS_PUBLISH_TOKEN` 입력
3. `daily_post` 실행

주의:
- Threads API 엔드포인트/권한은 Meta 앱 설정 상태에 따라 다를 수 있습니다.
- 이 프로젝트는 엔드포인트를 환경변수로 분리해 두었고, 권한/엔드포인트 확정 후 바로 연결하도록 설계되었습니다.

## 6) 추천 운영 루틴

1. 월요일 아침 `weekly_collect` 실행
2. 생성된 `signals_*.md` 검토
3. 누락된 소셜 정보를 `manual_items.csv`에 추가
4. `weekly_collect` 재실행
5. 매일 `daily_post`로 1회 업로드
