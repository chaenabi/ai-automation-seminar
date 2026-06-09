# CLI Harness Lab

결제 장애를 분석하고 안전하게 수정하는 CLI agent용 하네스 예제입니다.

## 구성

- `AGENTS.md`: Codex가 읽는 저장소 지침
- `CLAUDE.md`: Claude Code가 읽는 저장소 지침
- `docs/`, `runbooks/`: 로컬 RAG와 2nd brain 자료
- `.agents/skills/incident-triage/`: 반복 가능한 장애 분석 Skill
- `config/codex-config.toml`: Codex sandbox/MCP 설정 예시
- `config/claude-settings.json`: Claude Code permissions/hooks 예시
- `agents/`: Codex와 Claude Code용 보안 리뷰 sub-agent 예시
- `hooks/pre_tool_guard.py`: 파괴적 명령을 차단하는 결정적 guard
- `a2a/agent-card.json`: 원격 장애 분석 agent의 A2A Agent Card 예시

## 실습 순서

1. `AGENTS.md` 또는 `CLAUDE.md`로 저장소의 기본 작업 방식을 설명합니다.
2. `docs/`와 `runbooks/`를 근거 자료로 사용하도록 지시합니다.
3. `incident-triage` Skill로 분석 절차를 재사용합니다.
4. permissions, sandbox, hooks로 금지 사항을 실제로 강제합니다.
5. read-only sub-agent에게 보안 검토를 병렬 위임합니다.
6. 외부 시스템은 MCP, 독립 원격 agent는 A2A로 연결합니다.

예제의 설정 파일은 설명용입니다. 사용하는 CLI 버전의 공식 문서와
`--help`, `/status`, `/permissions`, `/mcp` 결과를 확인한 뒤 적용하세요.
