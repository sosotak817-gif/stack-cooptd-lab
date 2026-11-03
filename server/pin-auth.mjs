import { pbkdf2, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const windowMs = 15 * 60_000;
export const pinIdentityPrefix = 'local-pin:';
export const pinReady = env => !!env.DB && /^[a-f0-9]{64}$/.test(env.PIN_PEPPER || '');

const currentVersion = 'pbkdf2-sha256-v2';
const legacyVersion = 'pbkdf2-sha256-v1';
const knownVersion = version => version === currentVersion || version === legacyVersion;

function derive(pin, salt, pepper, version = currentVersion) {
  return new Promise((resolve, reject) => {
    pbkdf2(pin + pepper, salt, version === legacyVersion ? 600_000 : 100_000, 32, 'sha256', (error, key) => {
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
  if (!result) {
    const minutes = Math.ceil((windowStart + windowMs - now) / 60_000);
    throw fail('요청 횟수를 초과했습니다. 약 ' + minutes + '분 후 다시 시도해 주세요.', 429);
  }
}

export async function handlePinAuth(request, env, action, auth) {
  const { body, fail, hash, random, reply, sameOrigin, startSession } = auth;
  if (!pinReady(env)) throw fail('PIN 계정 설정을 확인해 주세요.', 503);
  sameOrigin(request);
  const source = request.headers.get('CF-Connecting-IP');
  if (!source) throw fail('접속 정보를 확인할 수 없습니다.', 403);

  const now = Date.now();
  await env.DB.prepare('DELETE FROM lab_auth_attempts WHERE window_start < ?').bind(now - 2 * windowMs).run();
  const input = await body(request);
  const nickname = typeof input?.nickname === 'string' ? input.nickname.normalize('NFKC').trim() : '';
  if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname)) {
    throw fail('닉네임은 한글, 영문, 숫자, 밑줄로 2~16자여야 합니다.');
  }
  if (action !== 'nickname' && (typeof input.pin !== 'string' || !/^\d{4,8}$/.test(input.pin))) {
    throw fail('PIN은 숫자 4~8자리여야 합니다.');
  }
  if (action === 'register' && input.pin !== input.pinConfirmation) throw fail('PIN 재입력이 일치하지 않습니다.');
  await throttle(env.DB, action + ':source', source + env.PIN_PEPPER, action === 'register' ? 5 : 30, now, hash, fail);
  const normalized = nickname.toLowerCase();
  const existing = await env.DB.prepare(`
    SELECT u.id,u.nickname,c.pin_hash FROM lab_pin_credentials c
    JOIN lab_users u ON u.id=c.user_id WHERE c.nickname_normalized=?
  `).bind(normalized).first();
  if (action === 'nickname') return reply({ available: !existing });

  if (action === 'login') {
    await throttle(env.DB, 'login:nickname', normalized + env.PIN_PEPPER, 8, now, hash, fail);
    const [version, salt, expected] = (existing?.pin_hash || '').split('$');
    const key = await derive(input.pin, salt || '0'.repeat(64), env.PIN_PEPPER, version);
    if (!knownVersion(version) || !/^[a-f0-9]{64}$/.test(expected || '') || !timingSafeEqual(encoder.encode(key.toString('hex')), encoder.encode(expected))) {
      throw fail('닉네임 또는 PIN을 확인해 주세요.', 401);
    }
    return startSession(request, env, existing, [], 200, existing.pin_hash);
  }

  if (existing) throw fail('이미 사용 중인 닉네임입니다.', 409);
  const id = crypto.randomUUID();
  const salt = random();
  const key = await derive(input.pin, salt, env.PIN_PEPPER);
  const statements = [
    env.DB.prepare('INSERT INTO lab_users(id,naver_id,nickname,created_at) VALUES(?,?,?,?)')
      .bind(id, pinIdentityPrefix + id, nickname, now),
    env.DB.prepare('INSERT INTO lab_pin_credentials(user_id,nickname_normalized,pin_hash) VALUES(?,?,?)')
      .bind(id, normalized, currentVersion + '$' + salt + '$' + key.toString('hex'))
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

export async function changePin(request, env, user, auth) {
  const { body, fail, hash, random, reply } = auth;
  if (!pinReady(env)) throw fail('PIN 계정 설정을 확인해 주세요.', 503);
  const now = Date.now();
  await throttle(env.DB, 'change-pin:user', user.id, 8, now, hash, fail);
  const input = await body(request);
  if (typeof input?.pin !== 'string' || !/^\d{4,8}$/.test(input.pin) ||
      typeof input.newPin !== 'string' || !/^\d{4,8}$/.test(input.newPin) ||
      input.newPin !== input.pinConfirmation || input.newPin === input.pin) {
    throw fail('현재 PIN과 서로 다른 새 PIN 4~8자리 및 재입력을 확인해 주세요.');
  }
  const current = await env.DB.prepare('SELECT pin_hash FROM lab_pin_credentials WHERE user_id=?')
    .bind(user.id).first();
  if (!current) throw fail('PIN 계정이 필요합니다.', 403);
  const [version, salt, expected] = current.pin_hash.split('$');
  const key = await derive(input.pin, salt, env.PIN_PEPPER, version);
  if (!knownVersion(version) || !/^[a-f0-9]{64}$/.test(expected || '') ||
      !timingSafeEqual(encoder.encode(key.toString('hex')), encoder.encode(expected))) {
    throw fail('현재 PIN을 확인해 주세요.', 401);
  }
  const newSalt = random();
  const newKey = await derive(input.newPin, newSalt, env.PIN_PEPPER);
  const newHash = currentVersion + '$' + newSalt + '$' + newKey.toString('hex');
  const [updated] = await env.DB.batch([
    env.DB.prepare(`UPDATE lab_pin_credentials SET pin_hash=? WHERE user_id=? AND pin_hash=?
      AND EXISTS (SELECT 1 FROM lab_sessions WHERE token_hash=? AND expires_at>?)`)
      .bind(newHash, user.id, current.pin_hash, user.token_hash, Date.now()),
    env.DB.prepare(`DELETE FROM lab_sessions WHERE user_id=? AND token_hash<>?
      AND EXISTS (SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND pin_hash=?)`)
      .bind(user.id, user.token_hash, user.id, newHash),
    env.DB.prepare(`UPDATE lab_recovery_devices SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND pin_hash=?)`)
      .bind(now, user.id, user.id, newHash)
  ]);
  if (!(updated.meta?.changes ?? updated.changes)) throw fail('계정 정보가 변경되었습니다. 다시 로그인해 주세요.', 409);
  return reply({ ok: true });
}

const recoveryAge = 180 * 86400;
const recoveryCookie = '__Host-stack_recovery';

function recoveryResponse(response, cookie, token = '') {
  response.headers.append('Set-Cookie', cookie(recoveryCookie, token, token ? recoveryAge : 0));
  return response;
}

export async function manageRecovery(request, env, user, id, auth) {
  const { body, fail, hash, random, reply, cookie, cookies } = auth;
  if (!pinReady(env)) throw fail('PIN 계정 설정을 확인해 주세요.', 503);
  const now = Date.now();
  const db = env.DB;
  if (request.method === 'GET') {
    const rows = await db.prepare(`SELECT id,name,created_at,last_used_at,expires_at
      FROM lab_recovery_devices WHERE user_id=? AND revoked_at IS NULL AND expires_at>?
      ORDER BY created_at DESC`).bind(user.id, now).all();
    return reply({ devices: rows.results });
  }

  await throttle(db, 'recovery:user', user.id, 8, now, hash, fail);
  const input = await body(request);
  const current = await db.prepare('SELECT pin_hash FROM lab_pin_credentials WHERE user_id=?').bind(user.id).first();
  if (!current || typeof input?.pin !== 'string' || !/^\d{4,8}$/.test(input.pin)) {
    throw fail('현재 PIN을 확인해 주세요.', 401);
  }
  const [version, salt, expected] = current.pin_hash.split('$');
  const key = await derive(input.pin, salt, env.PIN_PEPPER, version);
  if (!knownVersion(version) || !/^[a-f0-9]{64}$/.test(expected || '') ||
      !timingSafeEqual(encoder.encode(key.toString('hex')), encoder.encode(expected))) {
    throw fail('현재 PIN을 확인해 주세요.', 401);
  }

  const validSession = `EXISTS (SELECT 1 FROM lab_pin_credentials c JOIN lab_sessions s ON s.user_id=c.user_id
    WHERE c.user_id=? AND c.pin_hash=? AND s.token_hash=? AND s.expires_at>?)`;
  const sessionValues = [user.id, current.pin_hash, user.token_hash, Date.now()];
  const oldToken = cookies(request)[recoveryCookie];
  const oldHash = /^[a-f0-9]{64}$/.test(oldToken || '') ? await hash(oldToken) : '';

  if (request.method === 'DELETE') {
    const revoked = await db.prepare(`UPDATE lab_recovery_devices SET revoked_at=?
      WHERE user_id=? AND id=? AND revoked_at IS NULL AND ${validSession} RETURNING token_hash`)
      .bind(now, user.id, id, ...sessionValues).first();
    if (!revoked) throw fail('등록된 복구 브라우저를 확인해 주세요.', 404);
    const response = reply({ ok: true });
    return revoked.token_hash === oldHash ? recoveryResponse(response, cookie) : response;
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw fail('복구 브라우저 이름을 1~50자로 입력해 주세요.');
  }
  const token = random();
  const deviceId = crypto.randomUUID();
  const [inserted] = await db.batch([
    db.prepare(`INSERT INTO lab_recovery_devices(id,user_id,name,token_hash,created_at,expires_at)
      SELECT ?,?,?,?,?,? WHERE ${validSession} AND
      (SELECT count(*) FROM lab_recovery_devices WHERE user_id=? AND revoked_at IS NULL
        AND expires_at>? AND token_hash<>?) < 3`)
      .bind(deviceId, user.id, name, await hash(token), now, now + recoveryAge * 1000,
        ...sessionValues, user.id, now, oldHash),
    db.prepare(`UPDATE lab_recovery_devices SET revoked_at=? WHERE user_id=? AND token_hash=?
      AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM lab_recovery_devices WHERE id=?)`)
      .bind(now, user.id, oldHash, deviceId)
  ]);
  if (!(inserted.meta?.changes ?? inserted.changes)) {
    throw fail('복구 브라우저는 최대 3개까지 등록할 수 있습니다. 등록 상태를 확인해 주세요.', 409);
  }
  return recoveryResponse(reply({ id: deviceId }, 201), cookie, token);
}

export async function resetPin(request, env, auth) {
  const { body, fail, hash, random, reply, cookie, cookies, sameOrigin } = auth;
  if (!pinReady(env)) throw fail('PIN 계정 설정을 확인해 주세요.', 503);
  sameOrigin(request);
  const source = request.headers.get('CF-Connecting-IP');
  if (!source) throw fail('접속 정보를 확인할 수 없습니다.', 403);
  const now = Date.now();
  const db = env.DB;
  await throttle(db, 'reset-pin:source', source + env.PIN_PEPPER, 8, now, hash, fail);
  const input = await body(request);
  const nickname = typeof input?.nickname === 'string' ? input.nickname.normalize('NFKC').trim().toLowerCase() : '';
  if (typeof input?.newPin !== 'string' || !/^\d{4,8}$/.test(input.newPin) || input.newPin !== input.pinConfirmation) {
    throw fail('새 PIN 숫자 4~8자리와 재입력을 확인해 주세요.');
  }
  const token = cookies(request)[recoveryCookie];
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw fail('등록한 복구 브라우저에서 시도해 주세요.', 401);
  const tokenHash = await hash(token);
  const device = await db.prepare(`SELECT d.id,d.user_id FROM lab_recovery_devices d
    JOIN lab_pin_credentials c ON c.user_id=d.user_id
    WHERE d.token_hash=? AND d.revoked_at IS NULL AND d.expires_at>? AND c.nickname_normalized=?`)
    .bind(tokenHash, now, nickname).first();
  if (!device) throw fail('등록한 복구 브라우저에서 시도해 주세요.', 401);

  const salt = random();
  const key = await derive(input.newPin, salt, env.PIN_PEPPER);
  const newHash = currentVersion + '$' + salt + '$' + key.toString('hex');
  const changedAt = Date.now();
  const [updated] = await db.batch([
    db.prepare(`UPDATE lab_pin_credentials SET pin_hash=? WHERE user_id=?
      AND EXISTS (SELECT 1 FROM lab_recovery_devices WHERE id=? AND token_hash=?
        AND revoked_at IS NULL AND expires_at>?)`)
      .bind(newHash, device.user_id, device.id, tokenHash, changedAt),
    db.prepare(`DELETE FROM lab_sessions WHERE user_id=? AND EXISTS
      (SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND pin_hash=?)`)
      .bind(device.user_id, device.user_id, newHash),
    db.prepare(`UPDATE lab_recovery_devices SET revoked_at=?,last_used_at=CASE WHEN id=? THEN ? ELSE last_used_at END
      WHERE user_id=? AND revoked_at IS NULL AND EXISTS
      (SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND pin_hash=?)`)
      .bind(changedAt, device.id, changedAt, device.user_id, device.user_id, newHash)
  ]);
  if (!(updated.meta?.changes ?? updated.changes)) throw fail('등록한 복구 브라우저에서 시도해 주세요.', 401);
  return recoveryResponse(reply({ ok: true }), cookie);
}
