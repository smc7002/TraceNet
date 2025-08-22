# TraceNet — 네트워크 모니터링/경로추적 시스템

제조/사내망 환경의 네트워크 장비를 **시각화·모니터링(Ping)·경로추적(Trace)** 하는 웹 애플리케이션.  
**React (TypeScript, Vite) + ASP.NET Core 6 + EF Core**.

- 검증 규모: **300~500 노드**(스위치/서버/PC)  
- 렌더링 전략: **방사형(Radial) 레이아웃 + 줌 기반 PC 가시성 제어**

---

## TL;DR (운영자 5단계)

1. **DB 마이그레이션**
   ```bash
   cd server
   dotnet ef database update
   ```
2. **백엔드 실행(테스트) / 배포**
   ```bash
   dotnet run
   # 또는
   dotnet publish -c Release -o ./publish
   ```
3. **프론트엔드 빌드** (동일 도메인 배포 권장)
   ```bash
   cd client
   echo VITE_API_BASE=/api > .env.production
   npm ci
   npm run build
   ```
4. **역프록시 구성**  
   - `/api` → **Kestrel(백엔드 5285)**  
   - 그 외 → **client/dist** 정적 서빙
5. **헬스체크 & 스케줄링**  
   - 헬스: `GET /api/device` 200 확인  
   - Ping 배치: `POST /api/device/ping/all` **5~10분 간격** 실행

---

## 시스템 요구사항

- **개발**: VS 2022 또는 VS Code, .NET 6 SDK, Node.js 18+, SQL Server/SQLite
- **운영**: Windows Server 2019+ 또는 Ubuntu 20.04+, IIS/Nginx
- **클라이언트**: Chrome/Edge/Firefox 최신, 1280×720+(권장 1920×1080)

---

## 아키텍처

```
server/
├─ Controllers/   # REST API (Device/Trace/Cable/…)
├─ Services/      # DeviceService, PingService, TraceService
├─ Models/        # EF Core 엔티티
├─ DTOs/          # API DTO
└─ Data/          # TraceNetDbContext (EF Core)
client/
└─ src/
   ├─ components/ # NetworkDiagram, ControlBar, SidePanel
   ├─ utils/      # layout.ts, nodeCenterCalculator.ts …
   ├─ api/        # axios 호출
   └─ types/      # TS 타입
```

**핵심 동작**
- 프론트: React Flow로 토폴로지 렌더링. **줌 < 0.7**에서 PC 숨김, 중앙 근처 스위치에 **스마트 PC 공개**.
- 백엔드: `DeviceService`가 **장비/포트/케이블** 일관성 유지. Ping은 **동시성 제한 + 타임아웃**.

---

## 로컬 실행

### Visual Studio (권장)
1) `TraceNet.sln` 열고 서버 **F5** 실행 (기본: `http://localhost:5285`)  
2) 새 터미널:
   ```bash
   cd client
   npm install
   npm run dev  # http://localhost:5173
   ```

### CLI
```bash
# 백엔드
cd server
dotnet restore
dotnet run

# 프론트엔드
cd client
npm install
npm run dev
```

---

## 프로덕션 배포

### 프론트엔드 환경변수
`client/.env.production`
```
VITE_API_BASE=/api
```

### 백엔드 설정 (예: appsettings.Production.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=TraceNet;User Id=...;Password=...;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft": "Warning",
      "TraceNet": "Information"
    }
  },
  "AllowedHosts": "*"
}
```

### Nginx 예시 (Linux)
```nginx
server {
    listen 80;
    server_name tracenet.local;

    # Frontend
    root /var/www/tracenet/client/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5285/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

### IIS 요약 (Windows)
- 사이트 A: `client/dist` 서빙, URL Rewrite로 SPA 라우팅
- 애플리케이션/사이트 B: ASP.NET Core 백엔드
- **A의 `/api/*` → B로 프록시**
- 프론트 `.env.production`은 `VITE_API_BASE=/api`

### systemd (Linux)
```ini
# /etc/systemd/system/tracenet.service
[Unit]
Description=TraceNet Backend
After=network.target

[Service]
WorkingDirectory=/opt/tracenet/server/publish
ExecStart=/usr/bin/dotnet TraceNet.dll
Restart=always
Environment=ASPNETCORE_URLS=http://0.0.0.0:5285
# ICMP 권한 (필요 시)
# ExecStartPre=/sbin/setcap cap_net_raw=+ep /usr/bin/dotnet

[Install]
WantedBy=multi-user.target
```

---

## 데이터 모델/규칙 (실무 중요)

- **Rack은 ‘장비’가 아님**(별도 테이블)  
- **Switch만 RackId 보유 가능(선택)** — PC/Server는 저장 시 RackId 무시  
- **삭제 정책(서비스 레이어 보장)**  
  - 장비 삭제 시: **포트 → 연결(CableConnection) → 케이블**을 **안전하게 정리 후** 장비 삭제  
  - DB는 일부 FK `Restrict`로 직접 삭제가 막힐 수 있으나, API는 **서비스를 통해 안전삭제** 수행
- **Ping 정책**  
  - `EnablePing=false`면 Ping 스킵(상태/시간만 갱신)  
  - 타임아웃/동시성은 운영 환경에 맞춰 조정 권장

**주요 테이블(요약)**
```
Devices(DeviceId, Name, Type, IPAddress, Status, RackId, EnablePing, LatencyMs, LastCheckedAt, …)
Ports(PortId, DeviceId, Name, …)
Cables(CableId, Type, Description, …)
CableConnections(CableId, FromPortId, ToPortId)
Racks(RackId, Name, Location, …)
```

---

## API 요약

### 장비
| Method | Path                       | 설명 |
|---|---|---|
| GET  | `/api/device`               | 전체 장비 조회 |
| GET  | `/api/device/{id}`          | 단일 장비 + 상태 |
| PUT  | `/api/device/{id}/status`   | 상태 수동 변경 (+EnablePing 선택) |
| PUT  | `/api/device/status/bulk`   | 상태 일괄 변경 |
| POST | `/api/device`               | 장비 생성(포트 자동 생성) |
| DELETE | `/api/device/{id}`        | 장비 삭제(연결·케이블 안전정리 포함) |

### Ping
| Method | Path                          | 설명 |
|---|---|---|
| POST | `/api/device/{id}/ping`        | 단일 Ping |
| POST | `/api/device/ping/multi`       | 다중 Ping |
| POST | `/api/device/ping/all`         | 전체 Ping |

### Trace / Cable (구현 기준에 맞게)
| Method | Path                  | 설명 |
|---|---|---|
| GET  | `/api/trace/{deviceId}`| 경로 추적 |
| GET  | `/api/cable`           | 케이블/연결 조회 |
| POST | `/api/cable`           | 케이블 연결 생성 |
| DELETE | `/api/cable/{id}`    | 케이블 삭제 |

### Import (사용 중일 때)
| Method | Path                 | 설명 |
|---|---|---|
| POST | `/api/import/devices` | 장비 일괄 업로드(JSON) |
| POST | `/api/import/cables`  | 케이블 일괄 업로드(JSON) |

**JSON 예시**
```json
{
  "devices": [
    { "name": "SERVER-01", "type": "server", "ipAddress": "192.168.1.10", "rackId": 1, "enablePing": true },
    { "name": "SW-01", "type": "switch", "rackId": 1 }
  ],
  "cables": [
    { "type": "ethernet", "fromDevice": "SW-01", "toDevice": "SERVER-01" }
  ]
}
```

---

## 프론트엔드 사용법

- **확대/축소**: 휠 / 우측 상단 컨트롤  
- **이동**: 드래그  
- **검색 + 자동 Trace**: 상단 검색창에 장비명/IP 입력 → 매칭 시 경로 강조  
- **문제 장비만 보기**: Online 외 상태만 필터  
- **줌 성능 최적화**: 줌 **< 0.7** → PC 숨김, 중앙 근처 스위치의 **PC만 선택적 공개**

---

## 운영 런북

### 헬스체크
- `GET /api/device` 200이고 JSON 반환되면 OK

### Ping 스케줄링
- **Linux cron**
  ```
  */5 * * * * curl -s -X POST http://localhost/api/device/ping/all > /dev/null
  ```
- **Windows 작업 스케줄러**  
  - 프로그램: `curl`  
  - 인자: `-X POST http://localhost/api/device/ping/all`

> 동시성/타임아웃 기준(코드 기본):  
> `maxConcurrency=10`, `timeoutMs=2000` → 운영 권장: **동시성 5~20, 타임아웃 3000~5000**

### 백업/복구
- SQL Server: 표준 백업(일일 전체 + 로그)  
- SQLite: 서비스 중지 후 DB 파일 백업 또는 `.backup` 사용  
- 마이그레이션 스크립트: `dotnet ef migrations script`

### 로깅
- 기본 콘솔/파일. 운영은 **파일 롤링(예: Serilog)** 권장.  
- 이슈 분석 시에만 일시적으로 `TraceNet` 로거를 `Debug`로 상향.

### 보안
- 사내망 전제. 외부 노출 금지.  
- Linux ICMP: `sudo setcap cap_net_raw+ep /usr/bin/dotnet`  
- 인증/권한은 차기 과제(현재 전 API 공개).

---

## 성능/메모리 튜닝

- 권장 규모: **최대 500 노드(최적 200~300)**  
- 프론트: 가시성 제어(PC 숨김/스마트 공개)로 **55~60fps** 유지 목표  
- 서버: Ping 동시성/타임아웃 조절, DB 인덱스 점검  
- 브라우저: 하드웨어 가속 ON, 불필요 탭/콘솔로그 최소화

---

## 트러블슈팅

**프론트가 API 못 잡음**
- `client/.env.production`의 `VITE_API_BASE=/api` 확인  
- 역프록시에서 `/api` 프록시 여부 확인  
- CORS 오류면 **동일 도메인 배포** 권장(불가 시 백엔드에 CORS 허용 추가)

**Ping이 안 됨**
- 관리자 권한/ICMP 권한 확인  
- 장비 `EnablePing=1` 확인  
- 타임아웃/동시성 완화

**장비 삭제 실패**
- 연결 케이블로 인해 FK `Restrict`가 막을 수 있음 → **API를 통해 삭제**(서비스가 안전정리)  
- DB에 수동 삭제 시도 금지

**성능 저하**
- 브라우저 Performance 탭 프로파일  
- 장비 수 500↓, Ping 동시성 5~10, 타임아웃 3~5초  
- 크롬 사용 권장

---

## 체크리스트 (배포 전)

- [ ] `dotnet ef database update` 완료  
- [ ] 프론트 `.env.production` = `VITE_API_BASE=/api`  
- [ ] Nginx/IIS 역프록시 `/api` → 백엔드  
- [ ] Ping 스케줄 작업 등록(5~10분)  
- [ ] 로그 롤링/백업 정책 문서화

---

## 라이선스 / 버전

- 라이선스: **내부 사용 전용**
- 버전: **v1.0.0**
- 최종 업데이트: **2025-08-22**
- 담당: **IT개발팀**

---

### 부록) 운영 팁
- 초도 도입 시 **Ping 타임아웃 5000ms, 동시성 5**로 안전하게 시작 후 점진 튜닝
- 라벨링 규칙 정리(장비명/랙명)로 검색/Trace 품질 향상
- 대용량 업로드는 JSON Import API 사용 권장(분할 업로드)
