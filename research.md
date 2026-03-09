# Research

## 조사 범위
이 문서는 `/Users/hanwha/Documents/New project/threadbot` 전체를 기준으로 작성했다. 현재 저장소에는 서로 다른 두 시스템이 함께 들어 있다.

- Python MVP: 로컬 파일 기반 수집/생성/게시/검수 파이프라인
- `vercel/` 운영형 버전: Supabase + Vercel + Resend + Threads Graph API 기반 서버리스 운영 시스템

둘은 같은 비즈니스 목적을 공유하지만 저장 방식, UI, 자동화 진입점, 인증 방식이 다르다.

## 1. 프로젝트 목적과 문제 정의
이 시스템의 핵심 목적은 항공사 채용 및 승무원 준비 관련 신호를 모아, 특정 계정 페르소나에 맞는 Threads 게시글을 꾸준히 생성하고 예약 게시하는 것이다.

세부 목적은 다음과 같다.

- 공식 항공사 채용 페이지 업데이트 추적
- 블로그/SNS/Threads에서 승무원 준비생이 반응할 만한 보조 신호 수집
- 수집 데이터를 바탕으로 계정 톤에 맞는 게시글 생성
- 운영자가 게시 전날 초안을 검수/수정
- 예약 시각에 자동 게시
- 운영 실패 원인과 토큰 상태를 관찰 가능한 형태로 보존

## 2. Python MVP 구조

### 2.1 엔트리포인트
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/cli.py`

CLI 스크립트는 세 개다.

- `weekly_collect`
- `daily_post`
- `morning_prepare`

`pyproject.toml`에서 각 함수가 콘솔 스크립트로 노출된다.

### 2.2 설정 로딩
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/config.py`

`load_settings()`는 `.env`를 읽고 다음 경로/설정을 만든다.

- 소스 목록: `data/inputs/sources.yaml`
- 말투 샘플: `data/style/writing_samples.txt`
- 수동 보강: `data/inputs/manual_items.csv`
- 출력 디렉터리: `data/outputs`
- OpenAI 키/모델
- 게시 엔드포인트/토큰
- SMTP
- 대시보드 URL

기본 베이스 디렉터리는 `Path.cwd()`다. 즉 Python MVP는 현재 작업 디렉터리 의존성이 강하다.

### 2.3 수집 파이프라인
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/pipeline.py`
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/collectors.py`

흐름:

1. `sources.yaml` 로드
2. 각 URL에 대해 `build_collector(url)`로 수집기 선택
3. `collect(name, url, since)` 실행
4. `manual_items.csv` 결과 병합
5. `(title, link)` 기준 중복 제거
6. 최신순 정렬
7. `signals_*.json`, `signals_*.md` 생성

#### 수집기 분기
- `NaverBlogCollector`
  - `blog.naver.com/<blogId>`에서 blog ID 추출
  - `https://rss.blog.naver.com/<blogId>.xml` 사용
  - 제목/요약에 채용 관련 키워드가 있어야 통과
- `RecruiterCollector`
  - `recruiter.co.kr` 계열 페이지 HTML anchor 파싱
  - 텍스트 블록에서 날짜 추정
  - 보조 전략으로 `/sitemap.xml`을 읽고 `/career/` 경로 갱신 확인
- `GenericWebCollector`
  - 나머지 URL 대상
  - 화면에 보이는 anchor 텍스트 기반 저정밀 수집
  - SNS처럼 스크래핑이 어려운 경우 빈 결과가 많을 가능성이 높음

#### 판단 휴리스틱
- 채용 관련 여부: `_is_hiring_related()`
- 항공사 추정: `_guess_airline()`
- 직무 추정: `_guess_role()`
- 날짜 파싱: `_parse_date()`, `_find_date_in_text()`

#### 관찰 사항
- 구조가 단순하고 빠르지만 DOM/텍스트 휴리스틱 의존도가 높다.
- 공식 사이트에선 sitemap fallback이 상대적으로 유효하다.
- Instagram/Facebook/Threads 프로필은 실제로 본문 수집보다 링크 노출에 의존하게 될 가능성이 높다.
- dedupe key가 `(title, link)`라서 같은 공고가 링크만 달라 재게시되면 중복으로 남을 수 있다.

### 2.4 데이터 모델
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/models.py`

핵심 엔티티는 `HiringSignal` 단일 dataclass다.

필드:

- `source_name`
- `source_url`
- `title`
- `link`
- `published_at`
- `airline`
- `role`
- `summary`
- `confidence`

ORM은 없다. 전부 JSON 직렬화/역직렬화로 처리한다.

### 2.5 글 생성
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/writer.py`

흐름:

1. `read_style()`로 샘플 말투 읽기
2. `build_fact_sheet()`로 최대 10개 신호를 프롬프트용 문자열로 변환
3. OpenAI API 키가 있으면 `client.responses.create(...)`
4. 없으면 `fallback_post()`
5. `save_post()`로 `post_*.json` 저장

프롬프트 특징:

- 5슬라이드 고정
- 전직 대한항공 승무원 출신 컨설턴트 계정 라이터 페르소나
- 공감 -> 문제 -> 경험 -> 해결 -> 행동유도 구조
- 링크는 마지막 슬라이드에만 1~2개 허용

#### 관찰 사항
- Python MVP 프롬프트와 `vercel/` 프롬프트는 서로 다르다.
- Python 버전은 슬라이드 넘버링을 강제하지만, `vercel/` 버전은 오히려 넘버링을 제거하는 방향으로 진화했다.
- 즉 현재 운영 중심은 Python보다 `vercel/` 쪽 로직일 가능성이 높다.

### 2.6 초안/게시/이메일
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/drafts.py`
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/publisher.py`
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/emailer.py`

#### 초안
- 파일명: `draft_YYYY-MM-DD.json`
- KST 기준 날짜 사용
- 필드: `date`, `created_at`, `updated_at`, `status`, `approved`, `source_json`, `post`

#### 게시
- `THREADS_DRY_RUN=true`면 실제 업로드 없이 JSON 로그만 남김
- 실게시 시 `THREADS_PUBLISH_ENDPOINT`로 POST
- payload는 `{ "text": post_text }`
- Threads 공식 2단계 publish flow가 아니라 환경변수로 주어진 프록시 엔드포인트/업로더를 가정함

#### 이메일
- SMTP 직접 사용
- `morning_prepare()`는 초안 생성 후 이메일 발송
- SMTP 설정이 없으면 콘솔에 출력

### 2.7 Streamlit 대시보드
`/Users/hanwha/Documents/New project/threadbot/src/threadbot/dashboard.py`

기능:

- 최근 게시글 표시
- 최신 signals 기반 추천 글 5개 생성
- Bing RSS 기반 Threads 태그 리스팅
- 진행 중 추정 채용 필터링
- `sources.yaml` URL 추가
- `draft_*.json` 본문 수정/승인

특징:

- 모든 상태는 로컬 파일을 읽어 구성
- 승인 상태는 다음 `daily_post()`에서 오늘 초안이 있으면 그 본문을 우선 사용

## 3. Vercel 운영형 구조

### 3.1 전체 개념
`/Users/hanwha/Documents/New project/threadbot/vercel`

이 버전은 Python MVP를 운영형으로 옮긴 것이다. 핵심 차이는 다음과 같다.

- 파일 저장 대신 Supabase 테이블 사용
- Streamlit 대신 Next.js 대시보드 사용
- SMTP 대신 Resend 사용
- 게시는 Threads Graph API 공식 2단계 flow 사용
- 관리자 액션은 Google OAuth + Supabase 세션으로 보호
- cron 결과를 `cron_runs` 테이블에 저장
- `crawl`/`direct` 쓰기 모드 분리

### 3.2 DB 스키마
`/Users/hanwha/Documents/New project/threadbot/vercel/supabase/schema.sql`

테이블:

- `sources`
  - 수집 대상 URL 저장
  - 일부 설정값 저장소 역할도 겸함
- `signals`
  - 수집 결과 저장
- `drafts`
  - 날짜별 초안 저장
- `posts`
  - 실제 게시 기록 저장
- `cron_runs`
  - cron 성공/실패 로그 저장

#### 중요한 설계 포인트
`sources` 테이블이 단순 소스 목록 이상의 설정 저장소로도 사용된다.

- `manual://mode/crawl`
- `manual://mode/direct`
- `manual://config/threads_publish_token`
- `manual://config/threads_publish_token_expires_at`

즉 별도 settings/config 테이블 없이 `sources.url`에 특수 키를 넣어 플래그와 비밀값을 저장한다.

장점:
- 테이블 수를 줄이고 빠르게 구현 가능

단점:
- 의미가 섞인다. 소스 관리와 운영 설정이 한 테이블에 공존
- 관리 UI에서 실수로 설정 row를 노출/수정할 위험이 있다
- 보안 및 모델링 관점에서는 강한 타입 경계가 없다

### 3.3 타입 정의
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/types.ts`

주요 타입:

- `Source`
- `Signal`
- `Draft`

Python의 `HiringSignal`과 거의 동일한 필드를 가진다.

### 3.4 환경과 권한
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/env.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/adminAuth.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/supabase.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/supabaseBrowser.ts`

#### 서버 환경
- `assertEnv()`는 필수 env 존재를 검증하지만 실제 라우트에서 광범위하게 호출되지는 않는다.
- cron 권한은 `CRON_SECRET` 또는 Vercel cron 헤더/UA로 판정한다.

#### 관리자 인증
- 브라우저에서 Supabase 공개키로 세션 생성
- Google OAuth 로그인
- `Authorization: Bearer <supabase access token>`를 서버 API에 전달
- 서버는 service-role client로 `auth.getUser(token)` 후 허용 이메일인지 검증

### 3.5 수집 로직
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/collect.ts`

#### 소스별 수집
- 네이버 블로그는 RSS
- 일반 공식 채용 사이트는 sitemap 기반
- Python MVP보다 `recruiter` HTML anchor 직접 파싱은 줄고 sitemap 의존이 커졌다

#### Threads 키워드 수집
- `collectFromThreadsKeywords()`
- 공식 Threads Graph `keyword_search` 엔드포인트 사용
- 쿼리 확장:
  - 기본 키워드
  - `채용`
  - `면접`
  - `꿀팁`
- 결과 relevance score 계산 후 최소점수 미만 필터링

#### 우선순위
- `prioritizeSignals()`
- 우선순위: Threads > Naver > Instagram/Facebook > 공식 채용 > 기타

이 우선순위는 일반적인 “공식 소스 우선”과 다르다. 여기서는 콘텐츠 생산용 신호를 먼저 보려는 의도가 강하다.

### 3.6 글 생성 로직
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/generate.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/contentGuide.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/weekdayTheme.ts`

#### 핵심 변화
Python MVP보다 규칙이 훨씬 강해졌다.

- 슬라이드 넘버링 금지
- 4~6문단 요구
- 링크 금지
- 자기홍보/댓글유도 금지
- 요일별 고정 카테고리 강제
- 마지막 문장 `❤️`
- 모델 출력이 짧으면 재시도
- 금지 표현 정규화 후 `sanitizeGeneratedPost()` 처리

#### 요일별 카테고리
- 월: 면접 예상질문 관련
- 화: 대한항공 지원 비전공자 조언
- 수: 승무원 준비 꿀팁
- 목: 면접 관련
- 금: 전직 승무원이 본 객실승무원 필요 역량

현재 규칙은 토요일과 일요일을 게시일에서 제외한다. 따라서 카테고리는 7일 매핑이 아니라 평일 게시 흐름에 맞춰 월-화-수-목-금 5개만 반복된다. 즉 금요일 다음 게시일은 월요일이고, 카테고리도 다시 월요일 카테고리로 순환한다.

`isPostMatchingWeekdayTheme()`는 해당 게시 대상일에 대응하는 키워드 포함 여부로 검사한다. 의미적 일치 검증이 아니라 단순 키워드 매칭이다.

### 3.7 게시 로직
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/threads.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/threadsToken.ts`

#### 게시 방식
- `POST /me/threads`로 container 생성
- `POST /me/threads_publish`로 publish
- 여러 문단이면 reply chain으로 연속 게시
- 체인 중간 실패 시 standalone 게시 fallback 시도

#### 토큰 관리
- 현재 토큰과 만료시각을 `sources` 테이블의 특수 row에 저장
- 게시 중 token error(code 190) 발생 시 자동 refresh 후 1회 재시도
- 별도 cron(`/api/cron/token-refresh`)도 존재

### 3.8 이메일
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/email.ts`

- Resend 사용
- 수정 링크와 초안 본문을 plain text로 전송

### 3.9 쓰기 모드
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/writeMode.ts`

모드:

- `crawl`
  - 수집한 신호 기반 글 생성
- `direct`
  - 관리자가 업로드한 수동 텍스트(`manual-upload`) 기반 글 생성

이 모드도 `sources` 테이블 특수 row로 저장한다.

## 4. Vercel API 엔드포인트 분석

### 4.1 `GET /api/cron/morning`
`/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`

역할:

- 기본 수집 소스 동기화
- 현재 write mode 확인
- `crawl`이면 활성 소스 수집 + Threads 키워드 수집
- `direct`면 최근 7일 `manual-upload` 신호 로드
- dedupe/priority 적용
- `signals` 테이블에 적재(`crawl`일 때만)
- 다음 게시일 날짜 초안 생성
- Resend 이메일 발송
- `cron_runs` 기록

비즈니스 규칙:

- 공식 채용 소스는 지정 요일에만 포함 (`OFFICIAL_SOURCE_WEEKDAY`)
- `quick=1`이면 수집 소스/키워드 수를 줄인 축약 실행
- 오늘 게시글과 내일 초안이 다른 카테고리/전개를 갖도록 extra prompt 추가
- 주말에는 초안 생성을 스킵한다
- 다음 초안 날짜는 단순 `내일`이 아니라 `다음 평일 게시일`이다

### 4.2 `GET /api/cron/post`
`/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`

역할:

- 오늘 초안 조회
- 없으면 오늘 이전 draft 중 pending/regenerated fallback 사용
- KST 하루 1회 게시 hard guard
- 게시 성공/실패를 `posts`와 `drafts.status`에 반영
- `cron_runs` 기록

중복 방지:

- `posts` 테이블에서 오늘 KST 범위 내 성공 게시가 있으면 skip
- `force=1`일 때만 재게시 허용
- 주말 호출 시에는 게시 자체를 스킵한다

### 4.3 `GET /api/cron/token-refresh`
토큰 갱신 전용 cron. 성공/실패 모두 `cron_runs`에 저장한다.

### 4.4 `GET /api/cron/regenerate-today`
현재 날짜 draft 혹은 가장 최근 draft를 다시 AI로 생성한다. 내부적으로 `generatePostDetailed()`를 사용하며, openai 결과가 아니면 실패 처리한다.

### 4.5 `GET/PATCH/POST /api/drafts/:draftDate`
`/Users/hanwha/Documents/New project/threadbot/vercel/app/api/drafts/[draftDate]/route.ts`

#### GET
- 관리자 인증 필요
- 특정 날짜 draft 조회

#### PATCH
- 관리자 인증 필요
- 본문 수정 및 승인 상태 반영
- 승인 시 `status = approved`, 미승인 저장 시 `status = edited`

#### POST
- 관리자 인증 필요
- AI 재생성
- `direct` 모드면 최근 180일 manual-upload 기반
- `crawl` 모드면 해당 draft의 `source_json` 기반
- 동일한 결과가 나오면 재요청 또는 훅 강제 변경

### 4.6 `GET/POST /api/collection/sources`
- GET: 전체 소스 목록
- POST: 관리자 인증 후 소스 추가
- 여러 URL 한 번에 추가 가능

### 4.7 `POST /api/collection/sources/sync`
- 기본 소스 목록 전체 동기화

### 4.8 `GET/POST /api/manual/ingest`
- GET: 최근 manual-upload 목록
- POST: 긴 텍스트를 빈 줄 기준 문단 분리 후 `signals`에 저장

즉 `signals` 테이블은 크롤링 결과와 수동 업로드 원문을 같이 담는 다목적 저장소다.

### 4.9 `GET/POST /api/write-mode`
- 현재 모드 조회/변경

### 4.10 `GET/POST /api/admin/session`
- 현재 Supabase 세션이 관리자 권한을 가지는지 확인

### 4.11 `GET /api/admin/config`
- 런타임에 브라우저용 Supabase URL/publishable key 전달

## 5. 화면 레이어 분석

### 5.1 홈 대시보드
`/Users/hanwha/Documents/New project/threadbot/vercel/app/page.tsx`

대시보드는 다음 정보를 모아 보여준다.

- 최근 cron 성공/실패
- Threads 토큰 상태
- 관리자 로그인 패널
- 작성 방식 선택
- 요일별 콘텐츠 규칙
- 최근 실제 게시글
- 추천 글 샘플
- Threads 키워드별 수집 현황
- 진행 중 공식 캐빈 채용
- 수집 URL 관리
- 내일 초안 미리보기
- 내일 초안 생성에 사용된 수집 요약
- 전체 글 규칙

이 페이지는 운영 패널 성격이 강하며, 단순 CMS가 아니라 “수집 상태 + 콘텐츠 규칙 + 게시 스케줄 + 토큰 상태”를 한 번에 본다.

### 5.2 초안 수정 페이지
`/Users/hanwha/Documents/New project/threadbot/vercel/app/edit/page.tsx`

- 쿼리 `date` 기반 특정 초안 편집
- 관리자 토큰 포함 요청
- 저장/승인 가능

### 5.3 직접 입력 업로드 페이지
`/Users/hanwha/Documents/New project/threadbot/vercel/app/upload/page.tsx`

- 여러 글을 붙여넣어 `manual-upload` 신호로 저장

### 5.4 컴포넌트 역할
- `AdminSessionPanel`: Google 로그인/로그아웃
- `SourceManager`: 소스 목록 조회, 기본 소스 sync, URL 수동 추가
- `TomorrowDraftPanel`: 내일 초안 조회 및 새로고침
- `RegenerateDraftButton`: AI 재작성 실행
- `WriteModeSelector`: `crawl`/`direct` 전환
- `ManualIngestForm`: 직접 글 저장 및 최근 저장 내역 표시

## 6. 입력 데이터와 운영 자산

### 6.1 수집 소스
`/Users/hanwha/Documents/New project/threadbot/data/inputs/sources.yaml`
`/Users/hanwha/Documents/New project/threadbot/vercel/lib/defaultSources.ts`
`/Users/hanwha/Documents/New project/threadbot/vercel/supabase/schema.sql`

소스는 세 위치에서 관리된다.

- Python YAML
- Vercel 기본 상수
- Supabase 초기 SQL

즉 소스 정의가 중복되어 있다. 향후 수정 시 세 군데 동기화 문제가 생길 수 있다.

### 6.2 수동 입력 CSV
`/Users/hanwha/Documents/New project/threadbot/data/inputs/manual_items.csv`

현재 헤더만 있고 데이터는 비어 있다.

### 6.3 스타일 샘플
`/Users/hanwha/Documents/New project/threadbot/data/style/writing_samples.txt`

핵심 스타일:

- 친근하지만 단정한 코칭 톤
- 훅 시작
- 번호형 포인트 전개
- 실전 조언
- 과장 최소화

다만 `vercel/` 버전의 생성 규칙은 이 파일보다 훨씬 복잡하고 별도 하드코딩 콘텐츠 가이드를 가진다.

## 7. 자동화 스크립트

### 7.1 Python MVP 스크립트
`/Users/hanwha/Documents/New project/threadbot/scripts/run_weekly.sh`
`/Users/hanwha/Documents/New project/threadbot/scripts/run_morning.sh`
`/Users/hanwha/Documents/New project/threadbot/scripts/run_daily.sh`
`/Users/hanwha/Documents/New project/threadbot/scripts/install_cron_kst.sh`

- `.venv` 활성화 후 CLI 실행
- cron 설치 스크립트는 절대경로 `/Users/chulwan/Documents/GitHub/threadbot`를 하드코딩한다

이 절대경로는 현재 클론 위치와 다르다. 따라서 현재 워크스페이스에서는 그대로 사용하면 오작동한다.

### 7.2 Vercel cron
`/Users/hanwha/Documents/New project/threadbot/vercel/vercel.json`

- KST 23:59/00:05 초안 생성, 평일만 실행
- KST 09:00/09:30 게시, 평일만 실행
- KST 00:10 토큰 갱신, 매일 실행

## 8. 레이어/저장소/비즈니스 로직 정리

### 8.1 레이어 구조
- 입력 레이어
  - YAML/CSV/직접 업로드/외부 URL/Threads 키워드 검색
- 수집 레이어
  - Python collectors / `vercel/lib/collect.ts`
- 생성 레이어
  - Python `writer.py`
  - Vercel `generate.ts`
- 검수 레이어
  - Streamlit dashboard
  - Next.js edit/upload/dashboard UI
- 게시 레이어
  - Python publisher
  - Vercel Threads publish flow
- 관측 레이어
  - Python은 파일 로그 위주
  - Vercel은 `cron_runs`, 토큰 상태 검사, `posts`

### 8.2 ORM 관리 방식
- Python: ORM 없음
- Vercel: 공식 ORM 없음
- Supabase JS client를 직접 사용하며, SQL 스키마 + 타입 추론 없는 수동 쿼리 구조

### 8.3 기존 API 중복 구현 방지 포인트
이미 존재하는 기능:

- 초안 조회/수정/승인
- AI 재작성
- 수집 소스 추가
- 기본 소스 동기화
- 직접 입력 글 저장
- 쓰기 모드 전환
- 토큰 갱신
- 게시 중복 방지
- cron 실행 로그 저장

따라서 새 기능을 만들 때는 특히 아래를 중복 구현하면 안 된다.

- draft 재생성 버튼/엔드포인트
- manual upload 저장
- write mode 저장 방식
- token refresh flow
- source sync flow

## 9. 현재 설계상 핵심 관찰 사항

### 9.1 Python MVP와 Vercel 운영형이 병존
- 기능 중복이 있다.
- README도 두 버전을 함께 설명하고 있지만 현재 운영 중심은 `vercel/` 쪽으로 보인다.

### 9.2 소스/설정 저장의 경계가 흐림
- `sources` 테이블이 설정 저장소 역할을 같이 한다.
- 빠른 구현에는 유리하지만 모델링 명확성은 떨어진다.

### 9.3 콘텐츠 규칙이 매우 강하고 하드코딩 비중이 큼
- 요일별 카테고리
- 금지 표현
- 마지막 하트
- 광고/댓글 금지
- style sample 외에 별도 큰 텍스트 가이드 존재

### 9.4 소스 정의가 중복 관리됨
- Python YAML
- Vercel `DEFAULT_SOURCES`
- Supabase schema insert

### 9.5 운영형은 공식 Threads publish flow를 이미 구현함
- 따라서 게시 기능 재구현은 불필요하다.

### 9.6 직접 입력 모드가 사실상 별도 데이터 파이프라인
- same `signals` table reused
- `source_name = manual-upload`로 구분

## 10. 현재 시점의 정확한 결론
- 이 프로젝트는 “항공사/승무원 채용 신호 수집 + 계정용 Threads 콘텐츠 자동 생성/예약 게시” 시스템이다.
- 루트 Python 코드는 초기 파일 기반 MVP다.
- `vercel/`은 실운영용 구조에 더 가깝고, 이미 관리자 인증/토큰 관리/cron 로깅/직접 입력 모드까지 갖추고 있다.
- 데이터베이스는 Supabase 단일 계층이며 ORM은 사용하지 않는다.
- API 엔드포인트는 초안, 소스, 수동 입력, 쓰기 모드, cron, 관리자 인증까지 이미 존재한다.
- 향후 구현은 `vercel/`의 기존 엔드포인트와 `sources`/`signals`/`drafts`/`posts`/`cron_runs` 스키마를 우선 재사용해야 한다.

## 11. 현재 버그 조사: 하루 2건 게시

### 증상
- 하루에 Threads 게시글이 2개 업로드됨
- 기대 동작은 KST 기준 하루 1개 게시

### 관련 코드
- `/Users/hanwha/Documents/New project/threadbot/vercel/vercel.json`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/page.tsx`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/manual/ingest/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/regenerate-today/route.ts`

### 확인된 사실
- `vercel.json`에는 `/api/cron/post`가 두 번 등록돼 있다.
  - `0 0 * * *` -> KST 09:00
  - `30 0 * * *` -> KST 09:30 재시도
- 따라서 코드가 올바르면 09:30 실행은 “이미 오늘 게시됨”으로 스킵돼야 한다.
- 그런데 여러 파일의 `kstDate()` 구현이 다음 패턴을 쓴다.
  - `new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10)`

### 왜 문제가 되는가
이 구현은 KST 시각 문자열을 만든 뒤, 그 문자열을 서버 로컬 타임존 기준 `Date`로 다시 파싱한다. 서버가 UTC일 경우 이 값은 “KST 시각”이 아니라 “UTC로 재해석된 같은 벽시계 시각”이 된다. 즉 KST 날짜를 직접 구한 것이 아니다.

예시:
- 실제 시각: `2026-03-08T15:00:00Z`
- 실제 KST: `2026-03-09 00:00`
- 기존 구현 결과: `2026-03-08`

즉 KST 자정부터 오전 8시 59분 59초 사이에는 날짜가 전날로 계산될 수 있다.

### 버그 영향
- post cron이 다른 실행에서 서로 다른 날짜를 오늘로 판단할 수 있다.
- morning cron이 초안 날짜와 공식 소스 포함 요일을 잘못 판단할 수 있다.
- manual ingest와 dashboard 표시 날짜도 같이 틀릴 수 있다.

### 현재 가설 결론
중복 게시의 1차 원인은 “재시도 cron이 두 번 있는 것 자체”가 아니라, 그 두 번 실행을 하루 1회로 묶어야 하는 KST 날짜 계산이 잘못된 점이다. 따라서 스케줄을 제거하기보다 먼저 날짜 계산을 공통 유틸로 바로잡는 것이 맞다.

### 적용한 수정
- 공통 유틸 추가: `/Users/hanwha/Documents/New project/threadbot/vercel/lib/kst.ts`
- 교체 대상:
  - `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`
  - `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`
  - `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/regenerate-today/route.ts`
  - `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/manual/ingest/route.ts`
  - `/Users/hanwha/Documents/New project/threadbot/vercel/app/page.tsx`

새 유틸은 `Intl.DateTimeFormat(..., { timeZone: "Asia/Seoul" })`의 `formatToParts()`를 사용해 연/월/일을 직접 조합한다. 즉 locale string을 다시 `Date`로 파싱하지 않는다.

### 수정 후 검증
- 자정 경계 재현:
  - `2026-03-08T15:00:00Z` -> `2026-03-09` KST로 정상 계산됨
- 코드 검색 결과:
  - 기존 잘못된 `toLocaleString(... timeZone: "Asia/Seoul")` 후 재파싱 패턴 제거
- 빌드 검증:
  - `npm ci` 실행 후 `npm run build` 성공
  - Next.js production build, lint, type check, static page generation 모두 통과

### 아직 확인 못한 항목
- 실제 운영 환경의 09:30 재시도 로그가 `already_posted_today`로 남았는지는 현재 워크스페이스에 Vercel CLI, Supabase 자격 정보, 운영 env가 없어 직접 조회하지 못했다.

### 운영 접근 정리 결과
- `vercel` CLI를 로컬 dev dependency로 설치했다.
- `vercel whoami` 결과 로그인 계정은 `oxaz1234-2461`이다.
- 로컬 폴더를 Vercel 프로젝트 `threadbot`에 링크했다.
- 링크 파일: `/Users/hanwha/Documents/New project/threadbot/vercel/.vercel/project.json`
- Supabase `cron_runs` REST 조회 스크립트 추가:
  - `/Users/hanwha/Documents/New project/threadbot/vercel/scripts/query-cron-runs.sh`
- 필요한 env와 운영 확인 순서를 정리한 문서 추가:
  - `/Users/hanwha/Documents/New project/threadbot/vercel/OPS_ACCESS.md`

현재 남아 있는 유일한 외부 의존 조건은 실제 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 값이다. 이 값이 있어야 `cron_runs`를 직접 조회해 `09:30` 스킵 여부를 원격 데이터로 확인할 수 있다.

## 12. 운영 규칙 변경: 평일만 게시 + 5일 카테고리 순환

### 요구사항
- 토요일, 일요일은 게시일에서 제외
- 카테고리는 달력 요일이 아니라 평일 게시 순서 기준으로 월-화-수-목-금 반복

### 적용한 수정
- `vercel/vercel.json`
  - `morning`, `post` cron을 `1-5` 평일만 실행하도록 변경
- `vercel/app/api/cron/morning/route.ts`
  - 주말 요청 스킵
  - `targetDate`를 `nextPostingDate(1)`로 계산
- `vercel/app/api/cron/post/route.ts`
  - 주말 요청 스킵
- `vercel/lib/kst.ts`
  - `isKstWeekend()`, `nextPostingDate()` 추가
- `vercel/lib/weekdayTheme.ts`
  - 주말 카테고리 제거
  - 5개 카테고리 순환 구조로 변경
- `vercel/app/page.tsx`
  - `내일` 대신 `다음 게시일` 표시

### 기대 효과
- 금요일 저녁에 생성되는 다음 초안은 월요일용이 된다
- 주말에는 자동 게시가 실행되지 않는다
- 평일 게시 흐름이 길게 이어져도 카테고리는 월-화-수-목-금-월-화 식으로 반복된다

## 업데이트 이력
- 2026-03-09: 초기 전체 코드베이스 분석 완료. Python MVP와 Vercel 운영형 구조를 분리해 정리함.
- 2026-03-09: 하루 2건 게시 버그 조사 추가. `/api/cron/post` 이중 스케줄과 잘못된 KST 날짜 계산을 확인함.
- 2026-03-09: `vercel/lib/kst.ts` 도입 및 관련 라우트/페이지의 KST 날짜 계산 교체 완료.
- 2026-03-09: `vercel` 의존성 설치 후 production build 검증 완료.
- 2026-03-09: Vercel CLI 설치 및 프로젝트 링크 완료. Supabase `cron_runs` 조회 스크립트와 운영 접근 문서 추가.
- 2026-03-09: 주말 게시 제외 및 월-화-수-목-금 카테고리 순환 규칙 반영.
