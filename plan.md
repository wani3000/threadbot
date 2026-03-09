# Plan

## 목적
이 문서는 실제 코드 변경 전에 무엇을 어떻게 바꿀지 합의하기 위한 설계 문서다. 현재는 하루 2건 게시 버그를 수정하기 위한 작업 계획으로 업데이트됐다.

## 현재 전제
- 현재 사용자가 요청한 직접 과제는 “하루 1개만 게시되도록 버그 수정”이다.
- 대상 런타임은 `vercel/` 운영형 버전이다.
- `/api/cron/post`는 의도적으로 2회 실행되므로, 코드가 중복 실행을 안전하게 흡수해야 한다.
- 현재 저장소에는 Python MVP와 `vercel/` 운영형 버전이 공존하지만, 이번 수정 범위는 `vercel/` 쪽이다.

## 문제 정의
현재 해결할 실질 버그는 “KST 기준 하루 1개여야 하는 Threads 게시가 2개 올라가는 것”이다.

직접 원인:

1. `/api/cron/post`가 09:00, 09:30 두 번 실행된다.
2. 중복 방지의 기준이 되는 KST 날짜 계산이 잘못 구현돼 있다.
3. 동일한 잘못된 KST 계산 패턴이 여러 파일에 중복돼 있다.

추가 운영 요구:

4. 토요일과 일요일은 게시일에서 제외해야 한다.
5. 카테고리는 달력 요일이 아니라 평일 게시 순서 기준으로 월-화-수-목-금 반복이어야 한다.

## 접근 전략
수정은 다음 순서로 진행한다.

1. KST 날짜 계산을 공통 유틸로 추출
2. `post`/`morning`/`manual ingest`/대시보드가 같은 유틸을 사용하게 변경
3. 하루 1회 게시 가드가 09:00/09:30 두 cron 모두에서 같은 날짜를 보게 보장
4. 정적 검증과 재현 스크립트로 확인

이 전략의 이유:

- 스케줄을 제거하지 않아도 재시도 cron의 장점은 유지할 수 있다.
- 날짜 계산만 바로잡으면 기존 hard guard가 의도대로 동작할 가능성이 높다.
- 중복된 KST 계산 코드를 같이 정리해야 같은 유형의 날짜 버그 재발을 막을 수 있다.

## 구현 설계

### A. KST 유틸 추가
후보 파일:
- `/Users/hanwha/Documents/New project/threadbot/vercel/lib/kst.ts`

예상 코드:

```ts
const KST_TIME_ZONE = "Asia/Seoul";

export function kstDate(offsetDays = 0, baseDate = new Date()): string {
  const shifted = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  return `${year}-${month}-${day}`;
}

export function kstWeekday(baseDate = new Date()): number {
  // 0=Sun ... 6=Sat
}
```

### B. 잘못된 날짜 계산 교체
대상 파일:
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/regenerate-today/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/manual/ingest/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/page.tsx`

핵심 변경:

```ts
import { kstDate, kstWeekday } from "@/lib/kst";
```

### C. 검증 방식
- 재현 스크립트로 자정 경계 시각에서 `kstDate()`가 올바른 날짜를 반환하는지 확인
- `next build` 또는 최소 TypeScript/린트 검증

예상 검증 스니펫:

```bash
node -e '/* 2026-03-08T15:00:00Z should map to 2026-03-09 KST */'
```

### D. 평일 게시 순환 규칙
후보 파일:
- `/Users/hanwha/Documents/New project/threadbot/vercel/lib/weekdayTheme.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/lib/kst.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/vercel.json`

핵심 변경:

```ts
if (isKstWeekend()) {
  return skip;
}

const targetDate = nextPostingDate(1);
```

```text
cron: monday-friday only
theme cycle: mon, tue, wed, thu, fri, mon, tue...
```

## 코드 변경 후보 파일
- `/Users/hanwha/Documents/New project/threadbot/README.md`
- `/Users/hanwha/Documents/New project/threadbot/research.md`
- `/Users/hanwha/Documents/New project/threadbot/plan.md`
- `/Users/hanwha/Documents/New project/threadbot/vercel/lib/kst.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/post/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/morning/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/cron/regenerate-today/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/api/manual/ingest/route.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/app/page.tsx`
- `/Users/hanwha/Documents/New project/threadbot/vercel/lib/weekdayTheme.ts`
- `/Users/hanwha/Documents/New project/threadbot/vercel/vercel.json`

## 구현 시 고려 사항
- 기존 09:30 재시도 cron은 유지한다.
- DB 스키마는 바꾸지 않는다.
- 날짜 계산만 바꾸되, KST 기준 오늘/내일 판정이 일관되도록 한다.
- 대시보드 표시용 날짜와 cron용 날짜가 서로 달라지지 않게 공통 유틸을 쓴다.

## 기술적 제약 사항
- Next.js runtime에서 locale string 재파싱은 시간대 버그를 만들 수 있다.
- KST는 DST가 없으므로 offset day 계산은 상대적으로 단순하다.
- 기존 중복 게시 방지 로직은 `posts` 테이블 조회에 의존하므로 날짜 키가 정확해야 한다.

## 권장 1차 실행안
현재 승인된 버그 수정의 1차 실행안은 다음과 같다.

1. `vercel/lib/kst.ts` 추가
2. 잘못된 `kstDate()` 구현 전부 교체
3. 자정 경계 재현으로 날짜 계산 검증
4. 빌드 또는 정적 검증 실행

## Iteration

### Iteration 0
- 상태: 초기 분석 완료
- 결론:
  - 코드 수정 전 문서 3종 작성 완료
  - 아직 구현 승인 없음
  - 가장 유력한 후속 작업은 `vercel/` 운영형 중심 정리

### Iteration 1
- 상태: 버그 원인 분석 완료
- 결론:
  - `/api/cron/post` 이중 실행은 의도된 retry 전략
  - 실제 결함은 KST 날짜 계산 구현
  - 공통 KST 유틸 도입 후 관련 라우트/페이지를 함께 수정할 예정

### Iteration 2
- 상태: 수정 완료
- 실제 반영:
  - `vercel/lib/kst.ts` 추가
  - `post`/`morning`/`regenerate`/`manual ingest`/대시보드가 공통 KST 유틸 사용
  - 기존 locale string 재파싱 방식 제거
- 검증:
  - 자정 경계 재현 검증 통과
  - `npm ci` 후 `npm run build` 성공
  - 실제 09:30 운영 로그 조회는 현재 환경 자격 부족으로 미확인

### Iteration 3
- 상태: 운영 접근 도구 준비 완료
- 실제 반영:
  - `vercel` CLI 설치
  - Vercel 로그인 상태 확인
  - `threadbot` 프로젝트 링크 완료
  - `vercel/scripts/query-cron-runs.sh` 추가
  - `vercel/OPS_ACCESS.md` 추가
- 남은 조건:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Iteration 4
- 상태: 평일 게시 순환 규칙 반영 완료
- 실제 반영:
  - 주말 게시/초안 생성 스킵
  - cron 평일 한정
  - 다음 게시일 계산 도입
  - 카테고리 5일 순환 구조로 변경
- 검증:
  - `npm run build` 통과

### 개발자 피드백 기록 공간
- 비어 있음

## 승인 후 Todo
- [x] Agent: Codex - KST 공통 유틸 추가
- [x] Agent: Codex - `post`/`morning`/`regenerate`/`manual ingest`/대시보드의 날짜 계산 교체
- [x] Agent: Codex - 경계 시각 검증 수행
- [x] Agent: Codex - 실제 수정 결과를 문서에 반영
- [x] Agent: Codex - `vercel` 의존성 설치 후 빌드 검증 재실행
- [x] Agent: Codex - Vercel CLI 설치 및 프로젝트 링크
- [x] Agent: Codex - Supabase `cron_runs` 조회 스크립트 추가
- [x] Agent: Codex - 필요한 운영 env 목록 문서화
- [x] Agent: Codex - 토/일 게시 제외 및 평일 순환 카테고리 규칙 반영
- [ ] Agent: TBD - 운영 환경 `cron_runs` 또는 Vercel 로그에서 09:30 스킵 응답(`already_posted_today`) 확인

## 업데이트 이력
- 2026-03-09: 초기 계획 문서 작성. 코드 수정 전 구조 정리와 후속 구현 후보를 기록함.
- 2026-03-09: 하루 2건 게시 버그 수정 계획으로 문서 갱신. KST 날짜 계산 공통화 전략 추가.
