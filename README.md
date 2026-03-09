# ThreadBot

## 프로젝트 개요
이 저장소는 항공사 채용 및 승무원 준비 관련 신호를 수집하고, 그 데이터를 바탕으로 Threads 게시글 초안을 생성한 뒤 예약 게시까지 이어지게 만드는 자동화 시스템이다. 코드베이스는 두 축으로 나뉜다. 루트의 Python 코드는 초기 MVP로서 로컬 파일 기반 수집, 초안 생성, 이메일 발송, Streamlit 검수 UI를 제공한다. `vercel/`은 이를 운영형 구조로 확장한 버전으로, Vercel 서버리스 API, Supabase 저장소, Resend 이메일, Google 로그인 기반 관리자 UI를 묶어 실제 일일 운영에 맞춘다.

## 현재 작업 컨텍스트
현재 작업은 운영 규칙 정리까지 확장됐다. 하루 2건 중복 게시 문제는 KST 날짜 계산 수정으로 대응했고, 이어서 게시 운영 정책도 바꿨다. 이제 글 게시와 초안 생성은 평일만 대상이며, 토요일과 일요일은 게시하지 않는다. 카테고리는 달력상의 요일 이름에 고정되는 방식이 아니라 월-화-수-목-금 5개 카테고리를 평일 게시 순서 기준으로 반복해서 순환한다. 추가로, 한 개의 쓰레드 안에서 올라가는 첫 게시와 연속 스레드 각각은 너무 짧게 쪼개지지 않도록 최소 150자 이상 규칙이 적용됐다.

## 핵심 디렉토리 구조
- `src/threadbot/`: Python MVP. 수집기, 글 생성기, 게시기, 초안 관리, Streamlit 대시보드, CLI 엔트리포인트가 있다.
- `data/inputs/`: Python MVP용 입력 데이터. 수집 소스 목록 YAML과 수동 보강 CSV가 있다.
- `data/style/`: 글 말투 샘플 텍스트가 있다.
- `scripts/`: Python MVP 자동 실행용 쉘 스크립트와 cron 설치 스크립트가 있다.
- `vercel/app/`: Next.js App Router 페이지와 API 라우트가 있다.
- `vercel/components/`: 관리자 로그인, 소스 관리, 초안 재생성, 직접 입력 업로드 등 클라이언트 컴포넌트가 있다.
- `vercel/lib/`: 수집, 생성, 게시, 인증, 토큰 관리, 요일별 콘텐츠 규칙 등 핵심 서버 로직이 있다.
- `vercel/supabase/`: Supabase 스키마와 초기 소스 적재 SQL이 있다.

## 기술 스택 요약
- Python 3.9+
- `requests`, `beautifulsoup4`, `feedparser`, `PyYAML`, `openai`, `streamlit`
- TypeScript / Next.js App Router
- Supabase
- Resend
- Threads Graph API
- Vercel Cron

## 에이전트 간 역할 분담
- 현재 에이전트: KST 날짜/게시 가드 수정, 평일 게시 순환 규칙 반영, Vercel/Supabase 운영 접근 정리, 문서 갱신
- 후속 에이전트 예정 역할:
  - 데이터 수집/정합성 개선 담당
  - 콘텐츠 생성 품질 및 프롬프트 규칙 개선 담당
  - 운영 UI/API 안정화 담당
현재 시점에는 실제 구현 작업에 착수한 별도 에이전트는 없다.

## 작업 진행 상태
- 현재 상태: `운영 규칙 수정 완료 / 로컬 검증 완료`
- 코드 수정 여부: 완료
- 현재 목표: KST 기준 하루 1개 게시 보장

## 시스템 현재 상태 한눈에 보기
- Python MVP는 로컬 파일(`data/outputs/*.json`) 중심으로 동작한다.
- `vercel/` 버전은 실운영에 가까운 구조이며, 초안/게시/수집 결과를 Supabase 테이블에 적재한다.
- 수집 소스는 공식 채용 페이지, 네이버 블로그, SNS/Threads 키워드까지 확장돼 있다.
- 글 생성에는 OpenAI가 사용되며, 실패 시 fallback 문구 생성 로직이 있다.
- 게시는 Threads Graph API의 2단계 publish flow를 사용한다.
- 초안과 게시는 평일만 실행되며, 단순 `내일`이 아니라 다음 평일 게시일 기준으로 생성된다.
- 게시 retry cron은 유지되며, 날짜 계산 버그 수정으로 하루 1회 가드가 같은 KST 날짜를 기준으로 동작하도록 맞췄다.
- 첫 게시와 연속 스레드는 각각 최소 150자 이상이 되도록 강제한다.
- `vercel` 의존성 설치 후 프로덕션 빌드까지 통과했다.
- Vercel CLI 로그인과 프로젝트 링크가 완료됐다.
- 요일별 카테고리는 월-화-수-목-금 5개만 사용하고, 실제 평일 게시 순서에 따라 반복된다.
- 운영 확인용 문서와 Supabase 조회 스크립트는 [`/Users/hanwha/Documents/New project/threadbot/vercel/OPS_ACCESS.md`](/Users/hanwha/Documents/New%20project/threadbot/vercel/OPS_ACCESS.md), [`/Users/hanwha/Documents/New project/threadbot/vercel/scripts/query-cron-runs.sh`](/Users/hanwha/Documents/New%20project/threadbot/vercel/scripts/query-cron-runs.sh)에 있다.
- 직접 입력한 텍스트를 기반으로 글을 쓰는 `direct` 모드와 크롤링 기반 `crawl` 모드가 공존한다.

## 참고 파일 안내
- `research.md`: 현재 시스템이 정확히 어떻게 동작하는지에 대한 상세 분석. Python MVP, Vercel 구조, DB 스키마, API, 데이터 흐름, 비즈니스 규칙을 기록한다.
- `plan.md`: 코드 수정 전 설계 문서. 잠재적 개선 방향, 변경 후보 파일, 트레이드오프, 승인 후 Todo를 기록한다.

## 업데이트 규칙 메모
- 작업 단계가 바뀌면 이 파일의 `현재 작업 컨텍스트`, `에이전트 간 역할 분담`, `작업 진행 상태`를 즉시 갱신한다.
- 다른 에이전트가 합류하면 담당 영역과 현재 넘겨줄 문맥을 이 파일에 먼저 반영한다.
