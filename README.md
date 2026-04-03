# 좋은습관PT - 센터 과제관리

멀티지점 트리형 과제관리 + AI 실행 가이드 + PWA + 웹푸시 + 서버 세션 로그인

## 이번 배포 버전 핵심 변경
- **보안 강화 로그인**: 프론트에서 PIN을 직접 조회하지 않고 `/api/login`에서 서버 검증
- **PIN 평문 제거**: `coaches.pin` 대신 `coach_credentials.pin_hash` 사용 (bcrypt 기반)
- **세션 쿠키 인증**: `httpOnly` 쿠키 + `app_sessions` 테이블로 로그인 상태 관리
- **브라우저 직접 DB 접근 제거**: 프론트는 Supabase를 직접 읽고 쓰지 않고, 전부 서버 API를 통해 처리
- **RLS 기본 차단**: 브라우저 anon 접근을 막고 서버(service role)만 DB에 접근
- **웹푸시 API 보호**: 푸시 구독/발송 API는 로그인 세션이 있어야만 호출 가능
- **AI API 보호**: `/api/ai`는 로그인 세션이 있어야만 호출 가능
- **로그인 IP/기기 제한**: 반복 실패 시 15분 잠금으로 무차별 대입 방지
- **Origin 검사**: 주요 POST API에 same-origin 검증 추가
- **단건 저장 유지**: 과제 1건 또는 여러 건을 API로 저장하여 동시 덮어쓰기 위험 완화

## 스택
Vite + React / Supabase / Gemini / Vercel / PWA / Web Push

## 배포 순서
1. **Supabase 프로젝트 생성**
2. **SQL Editor**에서 `supabase-schema.sql` 실행
3. **Gemini API Key** 발급
4. **웹푸시 VAPID 키 생성**
   - 로컬에서 `npx web-push generate-vapid-keys`
   - 생성된 public/private key 를 환경변수에 등록
5. **Vercel 배포**
   - GitHub 저장소 연결
   - 환경변수 등록
   - Deploy
6. **Cron 확인**
   - `CRON_SECRET` 등록
   - Production 배포 후 Cron Jobs에서 `/api/cron-due-reminders` 확인

## 환경변수
| 변수 | 설명 |
|---|---|
| `SUPABASE_URL` | 서버용 Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버용 service role key |
| `GEMINI_API_KEY` | Gemini key |
| `WEB_PUSH_PUBLIC_KEY` | VAPID public key |
| `WEB_PUSH_PRIVATE_KEY` | VAPID private key |
| `WEB_PUSH_SUBJECT` | `mailto:you@example.com` 형식 |
| `CRON_SECRET` | Vercel Cron 요청 검증용 문자열 |

## 초기 PIN / 운영 계정 생성
보안상 **배포용 README에는 기본 PIN을 적지 않았습니다.**

- `supabase-schema.sql`에는 더 이상 바로 로그인 가능한 시드 계정을 넣지 않았습니다.
- 먼저 스키마를 실행한 뒤, `seed-admin.template.sql`을 참고해 **직접 관리자 계정과 PIN을 생성**해 주세요.
- 공개 저장소에는 실제 운영용 PIN 해시를 절대 커밋하지 않는 것을 권장합니다.


## 관리자 계정 생성 방법
1. `seed-admin.template.sql`의 `{{OWNER_ID}}`, `{{OWNER_NAME}}`, `{{ADMIN_PIN}}`를 실제 값으로 바꿉니다.
2. Supabase SQL Editor에서 실행합니다.
3. 템플릿 SQL은 실행 시 `crypt(..., gen_salt('bf'))`로 bcrypt 해시를 생성합니다.
4. 첫 로그인 후 관리자 화면에서 코치 계정을 추가하고 PIN을 재설정하세요.

## 새로 생긴 서버 API
- `POST /api/login`
- `POST /api/logout`
- `GET /api/bootstrap`
- `GET /api/tasks`
- `POST /api/task-save`
- `POST /api/task-delete`
- `POST /api/branch-save`
- `POST /api/branch-delete`
- `POST /api/coach-save`
- `POST /api/coach-delete`
- `POST /api/push-subscribe`
- `POST /api/push-notify`
- `GET/POST /api/cron-due-reminders`

## 운영 메모
- 코치 로그인은 4자리 PIN 기반이지만, 이제 PIN 평문은 DB에 저장되지 않습니다.
- 로그인 후에는 브라우저 로컬스토리지 대신 세션 쿠키를 사용합니다.
- 웹푸시는 HTTPS 환경에서만 동작합니다.
- 현재 구조는 **내부 운영용 무료 배포**에 맞춘 현실적인 보안 강화안입니다.
- 지점이 많이 늘거나 외부 고객용 SaaS로 확장할 경우, 이후 Supabase Auth 기반으로 재설계하는 것이 좋습니다.


## 로그인 방식
- 로그인 화면에서 먼저 코치를 선택한 뒤 4자리 PIN을 입력합니다.
- 서버는 coach_id + bcrypt PIN 해시를 기준으로 검증하며, 과거 SHA-256 해시는 첫 로그인 성공 시 자동으로 bcrypt로 업그레이드합니다.
