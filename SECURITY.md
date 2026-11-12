# Security policy

## Supported versions

| Project                                | Supported                   |
| -------------------------------------- | --------------------------- |
| PenTrace, latest `pentrace-v*` release | Yes                         |
| PenTrace, `main` branch                | Yes (fixes land here first) |
| Older PenTrace releases                | No, please update           |
| `cafe-quiz/`                           | Best effort                 |

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Report privately through GitHub: go to the **Security** tab of this repository and choose **Report a vulnerability** ([direct link](https://github.com/JsonCMorgan/JsonCMorgan/security/advisories/new)). If that is unavailable, email json.c.morgan@gmail.com with the subject `SECURITY: PenTrace`.

Include what you found, how to reproduce it, the version or commit, and the impact you think it has.

What to expect:

- An acknowledgement within 5 days.
- An assessment and plan within 14 days.
- Credit in the release notes once a fix ships, unless you prefer to stay anonymous.

## Scope

PenTrace is a game. Every "hack" in it is simulated in memory and never touches a real network, so in-game exploits against fictional hosts are features, not vulnerabilities.

In scope:

- The desktop app (Tauri shell in `pentrace/src-tauri/`): anything that lets game content or a save file run code or read files outside the app's sandbox.
- Player scripting (when it ships): escaping the Pyodide or Bash sandbox.
- Release artifacts and the build pipeline in `.github/workflows/`.
- Vulnerable dependencies with a realistic attack path.

Out of scope: editing your own save file to cheat, and findings that need an already compromised machine.
