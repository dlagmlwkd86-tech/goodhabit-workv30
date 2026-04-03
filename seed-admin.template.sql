-- ============================================
-- 좋은습관PT 운영용 관리자 계정 생성 템플릿
-- 실제 운영용 값으로 바꾼 뒤 Supabase SQL Editor에서 실행하세요.
-- ============================================

-- 1) 아래 placeholder를 실제 값으로 교체하세요.
--    {{OWNER_ID}}      예: owner-cheongra
--    {{OWNER_NAME}}    예: 희장
--    {{ADMIN_PIN}}     예: 2486
--
-- 2) PIN은 SQL 실행 시 bcrypt(Blowfish) 해시로 저장됩니다.
--    plaintext PIN이나 해시를 공개 저장소에 남기지 마세요.

INSERT INTO coaches (id, name, role, emoji, branch_id)
VALUES ('{{OWNER_ID}}', '{{OWNER_NAME}}', 'owner', '👤', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO coach_credentials (coach_id, pin_hash)
VALUES ('{{OWNER_ID}}', crypt('{{ADMIN_PIN}}', gen_salt('bf')))
ON CONFLICT (coach_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash;
