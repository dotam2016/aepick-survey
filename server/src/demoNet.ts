/**
 * 시연 환경 지원 — LAN 접속 주소 감지 + 자체 서명 HTTPS 인증서.
 *
 * 태블릿·휴대폰에서 카메라(getUserMedia)를 쓰려면 보안 컨텍스트(HTTPS)가 필요하다.
 * localhost는 예외지만 LAN IP 접속은 HTTP에서 카메라가 차단되므로,
 * 시연 시에는 HTTPS=1 로 실행해 자체 서명 인증서를 사용한다.
 */
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DATA_DIR } from './db.js';

const require = createRequire(import.meta.url);

/** 유선/무선 LAN IPv4 주소 목록 (가상 어댑터는 뒤로) */
export function detectLanIps(): string[] {
  const out: { ip: string; rank: number }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // VirtualBox/VMware/WSL/Docker 가상 어댑터는 우선순위를 낮춘다
      const virtual = /virtual|vmware|vbox|wsl|docker|loopback|hyper-v/i.test(name);
      out.push({ ip: a.address, rank: virtual ? 1 : 0 });
    }
  }
  return out.sort((x, y) => x.rank - y.rank).map((x) => x.ip);
}

export interface Cert { key: string; cert: string }

/**
 * 자체 서명 인증서를 준비한다(없으면 생성).
 * SAN에 localhost와 현재 LAN IP를 모두 넣어야 태블릿이 주소 불일치 경고를 덜 낸다.
 * IP가 바뀌면 인증서를 다시 만든다.
 */
export async function ensureCert(ips: string[]): Promise<Cert> {
  const dir = path.join(DATA_DIR, 'certs');
  mkdirSync(dir, { recursive: true });
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  const metaFile = path.join(dir, 'san.json');
  const san = JSON.stringify(ips.sort());

  if (existsSync(keyFile) && existsSync(certFile) && existsSync(metaFile)) {
    if (readFileSync(metaFile, 'utf-8') === san) {
      return { key: readFileSync(keyFile, 'utf-8'), cert: readFileSync(certFile, 'utf-8') };
    }
  }

  // 지연 로드 — HTTPS를 쓰지 않는 실행에서는 forge를 로드하지 않는다
  // selfsigned v5부터 generate()는 Promise를 반환한다
  const selfsigned = require('selfsigned') as {
    generate: (attrs: unknown[], opts: unknown) => Promise<{ private: string; cert: string }>;
  };
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'AEPICK Demo' }], {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          ...ips.map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });
  writeFileSync(keyFile, pems.private);
  writeFileSync(certFile, pems.cert);
  writeFileSync(metaFile, san);
  return { key: pems.private, cert: pems.cert };
}
