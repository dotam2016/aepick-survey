import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AXES, type Axis, type PersonaId, type Scores } from '@aepick/shared';
import { db, now, RESULT_DIR } from './db.js';
import { generateTemplateResult, type ComposeInput } from './imageEngine.js';
import { generateWithGemini, isGenAiConfigured } from './genai.js';

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'template';
const GEN_TIMEOUT_MS = 20_000;

interface JobInput {
  sessionId: string;
  token: string;
  persona: PersonaId;
  scores: Scores;
  nickname: string;
  avatarId: string | null;
}

/** 인메모리 순차 큐 (프로토타입; 배포 시 Redis 큐로 교체) */
const queue: JobInput[] = [];
let running = false;

export function enqueueImageJob(input: JobInput) {
  db.prepare(
    `INSERT INTO image_jobs (session_id, status) VALUES (?, 'queued')
     ON CONFLICT(session_id) DO UPDATE SET status='queued', attempts=attempts+1`,
  ).run(input.sessionId);
  queue.push(input);
  void pump();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    await runJob(job).catch((e) => console.error('[imageJob] fatal:', e));
  }
  running = false;
}

async function runJob(job: JobInput) {
  const mark = (status: string, extra: { generator?: string | null; error?: string | null } = {}) => {
    const t = now();
    db.prepare(
      `UPDATE image_jobs SET status=?, generator=COALESCE(?, generator), error=?,
       started_at=COALESCE(started_at, ?), finished_at=CASE WHEN ? IN ('completed','failed_fallback') THEN ? ELSE finished_at END
       WHERE session_id=?`,
    ).run(status, extra.generator ?? null, extra.error ?? null, t, status, t, job.sessionId);
  };

  mark('processing', { generator: AI_PROVIDER });

  const photo = db.prepare(`SELECT * FROM photos WHERE session_id=? AND status='stored' ORDER BY id DESC`).get(job.sessionId) as
    | { file_path: string } | undefined;

  const input: ComposeInput = {
    photoPath: photo?.file_path ?? null,
    avatarId: job.avatarId,
    persona: job.persona,
    scores: job.scores,
    nickname: job.nickname,
    token: job.token,
  };

  let generator = 'template';
  let failedFallback = false;

  /*
   * Phase B: 생성형 AI로 베이스 이미지를 만든다.
   * 실패·타임아웃이면 aiBasePath 없이 진행 → 템플릿 합성으로 자동 폴백 (기획안 11장).
   * 아바타 모드(사진 없음)는 AI 입력이 없으므로 건너뛴다.
   */
  if (AI_PROVIDER !== 'template' && input.photoPath && isGenAiConfigured()) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), GEN_TIMEOUT_MS);
    try {
      const topAxes = ([...AXES].sort((a, b) => job.scores[b] - job.scores[a]).slice(0, 2)) as [Axis, Axis];
      const buf = await generateWithGemini(
        { photoPath: input.photoPath, persona: job.persona, mood: 'soft', topAxes },
        ac.signal,
      );
      const dir = path.join(RESULT_DIR, job.token);
      mkdirSync(dir, { recursive: true });
      const aiPath = path.join(dir, 'ai-base.png');
      await writeFile(aiPath, buf);
      input.aiBasePath = aiPath;
      generator = AI_PROVIDER;
      console.log(`[imageJob] genai ok (${buf.length} bytes) — ${job.token}`);
    } catch (e) {
      console.warn('[imageJob] genai failed, fallback to template:', (e as Error).message);
      failedFallback = true;
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    const images = await generateTemplateResult(input);
    db.prepare(`UPDATE results SET image_paths=? WHERE token=?`).run(JSON.stringify(images), job.token);
    mark(failedFallback ? 'failed_fallback' : 'completed', { generator });
    db.prepare(`INSERT INTO events (session_id, type, payload, ts) VALUES (?, ?, ?, ?)`).run(
      job.sessionId, failedFallback ? 'image.fallback' : 'image.completed', JSON.stringify({ generator }), now());
  } catch (e) {
    mark('failed_fallback', { error: (e as Error).message });
    console.error('[imageJob] template compose failed:', e);
  } finally {
    // 원본 사진 즉시 삭제 (기획안 12.2)
    if (photo) void deleteWithRetry(photo.file_path);
    db.prepare(`UPDATE photos SET status='deleted', deleted_at=? WHERE session_id=?`).run(now(), job.sessionId);
  }
}

/**
 * 파일 삭제 재시도 — Windows에서 동기화 프로세스(Dropbox 등)나 안티바이러스가
 * 방금 쓴 파일을 잠시 잠글 수 있어 최대 5회 백오프 재시도한다.
 * 최종 실패분은 uploads 스위퍼(routes.startExpiryScheduler)가 정리한다.
 */
export async function deleteWithRetry(filePath: string, attempts = 5): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (!existsSync(filePath)) return true;
      await unlink(filePath);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  console.warn('[imageJob] photo delete deferred to sweeper:', filePath);
  return false;
}
