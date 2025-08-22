#네트워크 모니터링 시스템

React (TypeScript) + ASP.NET Core 6.0 + Entity Framework Core

🏆 **검증 규모**: 300개 PC + 15개 스위치 + 1개 서버 = **316개 노드**  
⚡ **성능 최적화**: 방사형 레이아웃 + 줌 기반 LOD 렌더링으로 **55-60fps 유지**  
🔍 **핵심 기능**: 실시간 Ping 모니터링 + 네트워크 경로 추적 + 직관적 시각화

---

## 배포 가이드

```bash
# 1. 데이터베이스 준비
cd server
dotnet ef database update

# 2. 백엔드 실행
dotnet run  # 개발: http://localhost:5285
# 또는 배포: dotnet publish -c Release -o ./publish

# 3. 프론트엔드 빌드
cd client
echo "VITE_API_BASE=/api" > .env.production
npm ci && npm run build

# 4. 역프록시 설정 (/api → 백엔드, 나머지 → client/dist)
# 5. Ping 스케줄링 (5-10분 간격 권장)
```

---

## 📋 시스템 개요

### 핵심 비즈니스 목적

- **실무 IT 관리**: 전체 PC 관리를 위한 디지털 솔루션
- **네트워크 장애 대응**: "제 컴퓨터 인터넷이 안 돼요" 문제의 신속한 해결
- **물리적 케이블 추적 대체**: 기존 수작업 케이블 추적을 디지털 시스템으로 전환

### 주요 기능

- **네트워크 토폴로지 시각화**: 방사형 클러스터 레이아웃으로 직관적 구조 파악
- **실시간 장비 상태 모니터링**: ICMP Ping 기반 5가지 상태 분류
- **스마트 경로 추적**: PC → 스위치 → 서버 경로 자동 탐지
- **대용량 성능 최적화**: 줌 레벨 기반 LOD 렌더링 (PC 노드 동적 표시/숨김)
- **일괄 데이터 관리**: JSON 업로드로 대용량 장비 정보 처리

---

## 🛠️ 시스템 요구사항

### 개발 환경

- **IDE**: Visual Studio 2022 (권장) 또는 VS Code
- **런타임**: .NET 6.0 SDK, Node.js 18.x+
- **데이터베이스**: SQL Server 또는 SQLite
- **기타**: Git

### 운영 환경

- **서버**: Windows Server 2019+ 또는 Ubuntu 20.04+
- **웹서버**: IIS 10.0+ 또는 Nginx
- **하드웨어**: 최소 4GB RAM, 10GB 디스크
- **권한**: ICMP Ping을 위한 관리자 권한 필요

### 클라이언트 요구사항

- **브라우저**: Chrome 90+, Edge 90+, Firefox 88+ (IE 지원 안함)
- **해상도**: 최소 1280x720, 권장 1920x1080
- **네트워크**: 안정적인 LAN 연결

---

## 🏗️ 시스템 아키텍처

### 전체 구조

```
TraceNet/
├── server/                    # ASP.NET Core 백엔드
│   ├── Controllers/           # REST API 엔드포인트
│   │   ├── DeviceController.cs     # 장비 관리 (CRUD + Ping)
│   │   ├── TraceController.cs      # 경로 추적
│   │   ├── CableController.cs      # 케이블 관리
│   │   └── ImportController.cs     # 일괄 데이터 업로드
│   ├── Services/              # 비즈니스 로직
│   │   ├── DeviceService.cs        # 장비 CRUD, 일괄 Ping 처리
│   │   ├── PingService.cs          # ICMP 패킷 기반 네트워크 상태 확인
│   │   └── TraceService.cs         # BFS+DFS 알고리즘 기반 경로 추적
│   ├── Models/                # EF Core 엔티티
│   └── DTOs/                  # API 데이터 전송 객체
└── client/                    # React 프론트엔드
    └── src/
        ├── components/        # React 컴포넌트
        │   ├── NetworkDiagram.tsx   # React Flow 기반 네트워크 시각화
        │   ├── ControlBar.tsx       # 상단 제어 패널 (검색, Ping, 필터)
        │   ├── SidePanel.tsx        # 장비 정보 및 관리 패널
        │   └── CustomNode.tsx       # 장비별 아이콘 및 상태 표시
        ├── utils/             # 유틸리티 함수
        │   ├── layout.ts           # 방사형 레이아웃 알고리즘
        │   └── nodeCenterCalculator.ts # 좌표 계산 엔진
        ├── api/               # API 통신 레이어
        └── types/             # TypeScript 타입 정의
```

### 데이터베이스 설계

```sql
-- 핵심 테이블 구조
Devices(DeviceId, Name, Type, IPAddress, Status, RackId, EnablePing, LatencyMs, LastCheckedAt)
Ports(PortId, DeviceId, Name, IsActive)
Cables(CableId, Type, Description)
CableConnections(CableId, FromPortId, ToPortId)
Racks(RackId, Name, Location)
```

### 데이터 모델 규칙 (중요)

- **Rack은 '장비'가 아님** (별도 테이블로 관리)
- **Switch만 RackId 보유 가능** — PC/Server는 저장 시 RackId 무시
- **삭제 정책**: 장비 삭제 시 포트 → 연결 → 케이블 순서로 안전 정리
- **Ping 정책**: `EnablePing=false`면 Ping 스킵, 상태/시간만 갱신

---

## ⚡ 로컬 개발 환경 구성

### Visual Studio 실행 (권장)

1. TraceNet.sln 파일을 Visual Studio로 열기
2. F5 키로 백엔드 서버 실행
   ⚠️ 콘솔에서 "Now listening on: http://localhost:XXXX" 포트 번호 확인!
3. 새 터미널에서 프론트엔드 실행:
   cd client
   npm install
   # 위에서 확인한 포트 번호로 설정 (예: 7240)
   echo "VITE_API_BASE=http://localhost:7240" > .env.local
   npm run dev # http://localhost:5173
4. 브라우저에서 http://localhost:5173 접속

💡 포트 고정하려면: server/Properties/launchSettings.json 파일에서
"applicationUrl": "http://localhost:5285" 설정

### 커맨드라인 실행

```bash
# 백엔드 (터미널 1)
cd server
dotnet restore
dotnet run

# 프론트엔드 (터미널 2)
cd client
npm install
npm run dev
```

### 데이터베이스 초기화

```bash
cd server
dotnet ef database update
```

---

## 🚀 프로덕션 배포

### 백엔드 빌드 및 배포

```bash
cd server
dotnet publish -c Release -o ./publish
```

### 프론트엔드 빌드

```bash
cd client
echo "VITE_API_BASE=/api" > .env.production
npm ci
npm run build
```

### Nginx 설정 예시 (Linux)

```nginx
server {
    listen 80;
    server_name tracenet.local;

    # 프론트엔드 정적 파일
    root /var/www/tracenet/client/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # 백엔드 API 프록시
    location /api/ {
        proxy_pass http://127.0.0.1:5285/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

### IIS 설정 (Windows)

- 사이트: `client/dist` 서빙, URL Rewrite로 SPA 라우팅
- 애플리케이션: ASP.NET Core 백엔드
- `/api/*` → 백엔드로 프록시 설정

### systemd 서비스 (Linux)

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

[Install]
WantedBy=multi-user.target
```

### 프로덕션 환경 설정

```json
// appsettings.Production.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=TraceNet;User Id=...;Password=...;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "TraceNet": "Information"
    }
  },
  "AllowedHosts": "*"
}
```

---

## 📡 API 엔드포인트

### 장비 관리 API

| Method | Endpoint                  | 설명                                   |
| ------ | ------------------------- | -------------------------------------- |
| GET    | `/api/device`             | 전체 장비 목록 조회                    |
| GET    | `/api/device/{id}`        | 특정 장비 상세 정보                    |
| POST   | `/api/device`             | 새 장비 생성 (포트 자동 생성)          |
| PUT    | `/api/device/{id}`        | 장비 정보 수정                         |
| DELETE | `/api/device/{id}`        | 장비 삭제 (연결 케이블 안전 정리 포함) |
| PUT    | `/api/device/{id}/status` | 장비 상태 수동 변경                    |
| PUT    | `/api/device/status/bulk` | 상태 일괄 변경                         |

### Ping 모니터링 API

| Method | Endpoint                 | 설명                       |
| ------ | ------------------------ | -------------------------- |
| POST   | `/api/device/{id}/ping`  | 단일 장비 Ping 테스트      |
| POST   | `/api/device/ping/multi` | 여러 장비 일괄 Ping        |
| POST   | `/api/device/ping/all`   | 전체 장비 Ping (운영 핵심) |

### 경로 추적 API

| Method | Endpoint                     | 설명                  |
| ------ | ---------------------------- | --------------------- |
| GET    | `/api/trace/{deviceId}`      | 네트워크 경로 추적    |
| GET    | `/api/trace/{deviceId}/ping` | 경로상 모든 장비 Ping |

### 케이블 관리 API

| Method | Endpoint          | 설명                     |
| ------ | ----------------- | ------------------------ |
| GET    | `/api/cable`      | 케이블 및 연결 정보 조회 |
| POST   | `/api/cable`      | 새 케이블 연결 생성      |
| DELETE | `/api/cable/{id}` | 케이블 연결 삭제         |

### 데이터 Import API

| Method | Endpoint              | 설명                              |
| ------ | --------------------- | --------------------------------- |
| POST   | `/api/import/devices` | JSON 형식 장비 데이터 일괄 업로드 |
| POST   | `/api/import/cables`  | 케이블 정보 일괄 업로드           |

### JSON Import 형식 예시

```json
{
  "devices": [
    {
      "name": "SERVER-01",
      "type": "server",
      "ipAddress": "192.168.1.254",
      "rackId": 1,
      "enablePing": true
    },
    {
      "name": "SW-01",
      "type": "switch",
      "ipAddress": "192.168.1.1",
      "rackId": 1,
      "portCount": 25
    }
  ],
  "cables": [
    {
      "type": "ethernet",
      "description": "SW-01 to SERVER-01",
      "fromDevice": "SW-01",
      "fromPort": "21",
      "toDevice": "SERVER-01",
      "toPort": "1"
    }
  ]
}
```

---

## 🎯 주요 기능 사용법

### 네트워크 시각화

- **확대/축소**: 마우스 휠 또는 우상단 확대/축소 버튼
- **이동**: 마우스 드래그로 뷰포트 이동
- **LOD 최적화**: 줌 < 0.7에서 PC 노드 자동 숨김, 중앙 근처 스위치 PC만 선택적 표시
- **미니맵**: 우하단 미니맵으로 전체 구조 파악

### 실시간 모니터링

1. **전체 Ping**: 상단 "전체 Ping" 버튼으로 모든 장비 상태 확인
2. **상태 분류**: Online(초록), Offline(빨강), Unstable(노랑), Unknown(회색), Unreachable(진빨강)
3. **자동 갱신**: 응답시간, 마지막 확인 시간 실시간 업데이트

### 장비 관리

1. **장비 추가**: 우측 패널 "장비 추가" 폼 작성
2. **정보 수정**: 장비 클릭 후 우측 패널에서 수정
3. **검색 + 자동 Trace**: 상단 검색창에 장비명/IP 입력 → 매칭 시 경로 강조
4. **필터링**: "문제 장비만" 토글로 Online 외 상태만 표시

### 케이블 연결 관리

1. **연결 생성**: "케이블 추가" 메뉴에서 시작/끝 장비 선택
2. **시각적 확인**: 장비 간 연결선으로 케이블 관계 표시
3. **연결 수정**: 기존 연결 클릭 후 정보 수정

---

## ⚙️ Ping 기능 활성화 및 최적화

### 권한 설정

#### Windows 환경

```bash
# Visual Studio를 관리자 권한으로 실행
# 또는 배포 시 IIS Application Pool에서 ICMP 권한 부여
```

#### Linux 환경

```bash
sudo setcap cap_net_raw+ep /usr/bin/dotnet
```

### 성능 튜닝 설정

```csharp
// PingService.cs - 운영 환경 권장 설정
int timeoutMs = 3000;        // 기본 2000 → 3000-5000 권장
int maxConcurrency = 10;     // 기본 10 → 5-20 범위에서 조정
```

### 운영 스케줄링

```bash
# Linux cron (5분 간격)
*/5 * * * * curl -s -X POST http://localhost/api/device/ping/all > /dev/null

# Windows 작업 스케줄러
# 프로그램: curl
# 인자: -X POST http://localhost/api/device/ping/all
# 간격: 5-10분
```

---

## 🔧 성능 최적화 및 튜닝

### 권장 운영 규모

- **최대 장비 수**: 500개 (최적 성능: 300개 이하)
- **동시 사용자**: 최대 10명
- **브라우저 메모리**: 500MB 이하 유지
- **렌더링 성능**: 55-60fps 목표

### React Flow 최적화 설정

```typescript
// NetworkDiagram.tsx
const optimizedSettings = {
  onlyRenderVisibleElements: true, // 뷰포트 최적화
  nodesDraggable: false, // 드래그 비활성화로 성능 향상
  nodesConnectable: false, // 연결 비활성화
  selectNodesOnDrag: false, // 선택 최적화
  minZoom: 0.3,
  maxZoom: 2.0,
};
```

### 메모리 최적화

```typescript
// React 메모이제이션 패턴
const allNodes = useMemo(
  () => filteredDevices.map((device) => createNode(device)),
  [filteredDevices, layoutMode]
);

const renderEdges = useMemo(
  () => [...baseEdges, ...traceEdges],
  [baseEdges, traceEdges]
);
```

### 대용량 환경 설정

```csharp
// DeviceService.cs - 서버 부하 감소
int maxConcurrency = 5;      // 동시 Ping 수 감소
int timeoutMs = 5000;        // 타임아웃 증가 (느린 네트워크 대응)
```

---

## 🛡️ 운영 런북

### 헬스체크

```bash
# API 상태 확인
curl -s http://localhost/api/device | jq '.[] | length'
# 200 응답 + JSON 반환 = 정상
```

### 로깅 및 모니터링

- **기본 로깅**: 콘솔/파일 (Serilog 권장)
- **이슈 분석**: `TraceNet` 로거를 일시적으로 `Debug`로 상향
- **성능 모니터링**: 브라우저 Performance 탭 활용

### 백업 및 복구

```bash
# SQL Server
sqlcmd -S server -d TraceNet -Q "BACKUP DATABASE TraceNet TO DISK='backup.bak'"

# SQLite
sqlite3 tracenet.db ".backup backup.db"

# 마이그레이션 스크립트 생성
dotnet ef migrations script > migration.sql
```

### 보안 정책

- **네트워크**: 사내망 전제, 외부 노출 금지
- **인증**: 현재 전 API 공개 (차기 과제: 인증/권한 시스템)
- **ICMP**: Linux에서 필요 시 CAP_NET_RAW 권한

---

## 🚨 트러블슈팅

### 애플리케이션 시작 실패

**증상**: dotnet run 실패

```bash
# 해결방법
dotnet --version    # .NET 6.0 확인
node --version      # Node.js 18+ 확인
dotnet restore      # 패키지 복원
```

### 프론트엔드가 API 연결 실패

**증상**: CORS 오류 또는 404

```bash
# 해결방법
1. client/.env.production에 VITE_API_BASE=/api 확인
2. 역프록시에서 /api 프록시 설정 확인
3. 동일 도메인 배포 권장 (CORS 회피)
```

### Ping 기능 동작 안함

**증상**: "전체 Ping" 버튼 눌러도 상태 변경 없음

```bash
# 해결방법
1. 관리자 권한으로 실행 확인
2. 방화벽에서 프로그램 허용 설정
3. IP 주소 정확성 확인
4. EnablePing=1 설정 확인
```

### 성능 저하 문제

**증상**: 화면 로딩 느림, 브라우저 멈춤

```bash
# 해결방법
1. 브라우저 Performance 탭에서 병목 확인
2. 장비 수 500개 이하로 제한
3. Chrome 브라우저 + 하드웨어 가속 활성화
4. Ping 동시성/타임아웃 조정
```

### 장비 삭제 실패

**증상**: "Request failed with status code 500"

```bash
# 해결방법
1. API를 통한 삭제 (서비스가 안전 정리 수행)
2. DB 직접 삭제 금지 (FK 제약 조건 위반)
3. 연결된 케이블 먼저 정리 후 재시도
```

---

## 📋 배포 전 체크리스트

- [ ] `dotnet ef database update` 완료
- [ ] 프론트엔드 `.env.production` = `VITE_API_BASE=/api` 설정
- [ ] Nginx/IIS 역프록시 `/api` → 백엔드 설정
- [ ] Ping 스케줄 작업 등록 (5-10분 간격)
- [ ] ICMP 권한 설정 (Windows: 관리자, Linux: CAP_NET_RAW)
- [ ] 로그 롤링 및 백업 정책 문서화
- [ ] 성능 기준 확인 (장비 수 ≤ 500, 메모리 ≤ 500MB)

---

## 🏷️ 프로젝트 정보

**기술 스택**

- **백엔드**: ASP.NET Core 6.0, Entity Framework Core, AutoMapper
- **프론트엔드**: React 18, TypeScript 4.9, React Flow, Tailwind CSS, Vite
- **데이터베이스**: SQL Server / SQLite
- **개발 도구**: Visual Studio 2022, VS Code, Git

**주요 제약사항**

- **권장 최대 규모**: 500개 장비 (최적 성능: 300개 이하)
- **Ping 제한**: 기본 동시성 10개, 타임아웃 2초 (운영 환경에서 조정 필요)
- **브라우저 지원**: Chrome, Edge, Firefox (IE 지원 안함)
- **네트워크 구조**: PC → Switch → Server 단방향 연결 구조

---

### 💡 운영 팁

- **초도 도입**: Ping 타임아웃 5000ms, 동시성 5로 안전하게 시작 후 점진 튜닝
- **라벨링 규칙**: 장비명/랙명 표준화로 검색/Trace 품질 향상
- **대용량 업로드**: JSON Import API 사용, 필요 시 분할 업로드
