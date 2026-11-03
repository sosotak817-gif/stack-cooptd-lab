import { pbkdf2, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const windowMs = 15 * 60_000;
export const pinIdentityPrefix = 'local-pin:';
export const pinReady = env => !!env.DB && /^[a-f0-9]{64}$/.test(env.PIN_PEPPER || '');

function derive(pin, salt, pepper) {
  return new Promise((resolve, reject) => {
    pbkdf2(pin + pepper, salt, 600_000, 32, 'sha256', (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function throttle(db, scope, key, limit, now, hash, fail) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare(`
    INSERT INTO lab_auth_attempts(scope,key_hash,window_start,attempts) VALUES(?,?,?,1)
    ON CONFLICT(scope,key_hash,window_start) DO UPDATE SET attempts=attempts+1
    WHERE attempts < ? RETURNING attempts
  `).bind(scope, await hash(key), windowStart, limit).first();
  if (!result) throw fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
}

export async function handlePinAuth(request, env, action, auth) {
  const { body, fail, hash, random, reply, sameOrigin, startSession } = auth;
  if (!pinReady(env)) throw fail('PIN 계정 설정을 확인해 주세요.', 503);
  sameOrigin(request);
  const source = request.headers.get('CF-Connecting-IP');
  if (!source) throw fail('접속 정보를 확인할 수 없습니다.', 403);

  const now = Date.now();
  await throttle(env.DB, action + ':source', source + env.PIN_PEPPER, action === 'register' ? 5 : 30, now, hash, fail);
  await env.DB.prepare('DELETE FROM lab_auth_attempts WHERE window_start < ?').bind(now - 2 * windowMs).run();
  const input = await body(request);
  const nickname = typeof input?.nickname === 'string' ? input.nickname.normalize('NFKC').trim() : '';
  if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname)) {
    throw fail('닉네임은 한글, 영문, 숫자, 밑줄로 2~16자여야 합니다.');
  }
  const normalized = nickname.toLowerCase();
  const existing = await env.DB.prepare(`
    SELECT u.id,u.nickname,c.pin_hash FROM lab_pin_credentials c
    JOIN lab_users u ON u.id=c.user_id WHERE c.nickname_normalized=?
  `).bind(normalized).first();
  if (action === 'nickname') return reply({ available: !existing });
  if (typeof input.pin !== 'string' || !/^\d{8}$/.test(input.pin)) throw fail('PIN은 숫자 8자리여야 합니다.');

  if (action === 'login') {
    await throttle(env.DB, 'login:nickname', normalized + env.PIN_PEPPER, 8, now, hash, fail);
    const [version, salt, expected] = (existing?.pin_hash || '').split('$');
    const key = await derive(input.pin, salt || '0'.repeat(64), env.PIN_PEPPER);
    if (version !== 'pbkdf2-sha256-v1' || !/^[a-f0-9]{64}$/.test(expected || '') || !timingSafeEqual(encoder.encode(key.toString('hex')), encoder.encode(expected))) {
      throw fail('닉네임 또는 PIN을 확인해 주세요.', 401);
    }
    return startSession(request, env, existing);
  }

  if (input.pin !== input.pinConfirmation) throw fail('PIN 재입력이 일치하지 않습니다.');
  if (existing) throw fail('이미 사용 중인 닉네임입니다.', 409);
  const id = crypto.randomUUID();
  const salt = random();
  const key = await derive(input.pin, salt, env.PIN_PEPPER);
  const statements = [
    env.DB.prepare('INSERT INTO lab_users(id,naver_id,nickname,created_at) VALUES(?,?,?,?)')
      .bind(id, pinIdentityPrefix + id, nickname, now),
    env.DB.prepare('INSERT INTO lab_pin_credentials(user_id,nickname_normalized,pin_hash) VALUES(?,?,?)')
      .bind(id, normalized, 'pbkdf2-sha256-v1$' + salt + '$' + key.toString('hex'))
  ];
  try {
    return await startSession(request, env, { id, nickname }, statements, 201);
  } catch (error) {
    if (String(error.message).includes('lab_pin_credentials.nickname_normalized')) {
      throw fail('이미 사용 중인 닉네임입니다.', 409);
    }
    throw error;
  }
}
