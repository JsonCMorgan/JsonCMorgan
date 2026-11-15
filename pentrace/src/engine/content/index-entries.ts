export interface IndexEntry {
  id: string;
  title: string;
  category: 'Recon' | 'Access' | 'Web' | 'Network' | 'Forensics' | 'Blue Team';
  tier: number;
  mitre?: string;
  unlockHint: string;
  realWorld: string[];
  inGame: string[];
  defense: string[];
  /** "In an interview I'd say..." lines for the INTERVIEW side of the flip card. */
  interview: string[];
  related: string[];
}

export const INDEX_ENTRIES: IndexEntry[] = [
  {
    id: 'port-scanning',
    title: 'Port Scanning & Service Enumeration',
    category: 'Recon',
    tier: 4,
    mitre: 'T1046 Network Service Discovery',
    unlockHint: 'Run nmap for the first time.',
    realWorld: [
      'Every networked service listens on a port: SSH on 22, HTTP on 80, FTP on 21. A port scanner sends packets to a range of ports and reads the replies to learn which are open, closed or filtered.',
      'nmap is the standard tool. A SYN scan (-sS) sends half a TCP handshake and never completes it, which is fast and a bit quieter. A connect scan (-sT) finishes the handshake and gets logged by the service. Version detection (-sV) grabs banners like "OpenSSH 7.2p2", and that version string is what tells an attacker which known CVE might apply.',
      'Timing templates (-T0 to -T5) trade speed for stealth. -T5 finishes fast and lights up every IDS on the way.',
    ],
    inGame: [
      'nmap <host> lists open ports. nmap -sV <host> adds service versions and counts as a fingerprint for recon contracts.',
      'nmap -T4 is twice as fast but doubles the heat it generates. Costs 60 MB of RAM while running.',
      'Example: nmap -sV 10.20.0.5',
    ],
    defense: [
      'IDS tools like Snort and Suricata have signatures for scans: one source touching many ports in a short window is a classic alert.',
      'Firewalls log dropped probes, so a scan from outside shows up as a burst of FW-DROP lines in the SIEM.',
      'Hardening: close services you do not need, hide version banners, and put admin services behind a VPN so a scan finds nothing worth attacking.',
    ],
    interview: [
      "A port scan maps which services are listening on a host. nmap -sV also grabs version banners, and a version is what you match against known CVEs.",
      "On the defense side, a scan shows up as one source touching many ports in a short window, so an IDS or the firewall logs catch it.",
    ],
    related: ['the-trace', 'ssh-credential-attacks', 'web-enumeration'],
  },
  {
    id: 'ssh-credential-attacks',
    title: 'SSH Credential Attacks',
    category: 'Access',
    tier: 5,
    mitre: 'T1110 Brute Force',
    unlockHint: 'Crack an SSH port with sshbrute.',
    realWorld: [
      'SSH is how admins log in to Linux servers remotely, so its login prompt is one of the most attacked surfaces on the internet. A brute force attack tries every combination; a dictionary attack tries likely passwords from a wordlist instead, which is far faster.',
      'rockyou.txt is a real wordlist of 14 million passwords from a 2009 breach and still cracks a scary number of accounts. Tools like Hydra and Medusa automate the guessing.',
      'Credential stuffing reuses username/password pairs leaked from other sites, which works because people reuse passwords.',
    ],
    inGame: [
      'sshbrute <host> runs a Hydra-style dictionary attack against port 22. Uses 240 MB RAM and is loud while it runs.',
      'sshbrute -w rockyou-plus.txt <host> uses a better wordlist (shop) and finishes much faster.',
      'A success opens port 22 toward the number of ports getroot needs.',
    ],
    defense: [
      'Every failed attempt writes a "Failed password" line to /var/log/auth.log. Dozens per minute from one IP is the textbook brute force alert.',
      'fail2ban bans an IP after N failures. Account lockout stops repeated guesses against one user.',
      'The real fix: key-only SSH (PasswordAuthentication no), MFA, and never exposing SSH directly to the internet.',
    ],
    interview: [
      "Brute force tries many passwords against one account. Password spraying tries one common password across many accounts so it stays under lockout limits.",
      "In auth.log I look for a burst of Failed password lines from one IP, and the real red flag is an Accepted from that same IP right after.",
    ],
    related: ['weak-default-creds', 'log-analysis', 'privilege-escalation'],
  },
  {
    id: 'weak-default-creds',
    title: 'Weak & Default Credentials',
    category: 'Access',
    tier: 5,
    mitre: 'T1078 Valid Accounts',
    unlockHint: 'Crack an account that still uses a default password.',
    realWorld: [
      'Devices and apps ship with default logins like admin/admin or root/changeme. If nobody changes them, anyone who reads the manual can log in.',
      'The Mirai botnet (2016) took over hundreds of thousands of cameras and routers using a list of about 60 default credentials, then used them to knock major sites offline.',
    ],
    inGame: [
      'Some boxes fall to the first guess in the wordlist. sshbrute flags these as DEFAULT CREDENTIAL.',
      'Default creds crack instantly in real life, so treat them as a free foothold.',
    ],
    defense: [
      'Force a password change on first login and scan your own estate for default creds.',
      'Use a password manager or secrets vault for service accounts, rotate them, and alert on logins from new locations.',
    ],
    interview: [
      "Default credentials are one of the easiest ways in. Mirai built a huge botnet from about 60 factory logins on cameras and routers.",
      "The fix is forcing a password change on first login and scanning our own estate for defaults before an attacker does.",
    ],
    related: ['ssh-credential-attacks'],
  },
  {
    id: 'web-enumeration',
    title: 'Web Server Enumeration & Exploitation',
    category: 'Web',
    tier: 6,
    mitre: 'T1190 Exploit Public-Facing Application',
    unlockHint: 'Run webscan against an HTTP port.',
    realWorld: [
      'Web servers expose more than their home page. Directory brute forcing (gobuster, dirb, ffuf) requests thousands of common paths like /admin, /backup or /.git to find forgotten content.',
      'Outdated software is the big prize. Apache 2.4.49 had a path traversal bug (CVE-2021-41773) that let attackers read files outside the web root and sometimes run code. Log4Shell (CVE-2021-44228) showed how one vulnerable library can expose thousands of apps at once.',
    ],
    inGame: [
      'webscan <host> enumerates paths on port 80, matches the server version against known CVEs and exploits what it finds to open the port.',
      'Uses 200 MB RAM. Fits alongside sshbrute on a base rig, so run both at once.',
    ],
    defense: [
      'A burst of 404s from one IP in the web access log is a directory brute force. A WAF can rate-limit or block it.',
      'Patch quickly, remove default pages and backups from the web root, and hide version banners.',
    ],
    interview: [
      "Web enumeration is discovering hidden paths, files and versions on a web server before attacking it.",
      "As a defender I'd look for one IP generating a flood of 404s in the access log, which is what directory brute forcing looks like.",
    ],
    related: ['port-scanning', 'privilege-escalation'],
  },
  {
    id: 'privilege-escalation',
    title: 'Privilege Escalation (SUID & sudo)',
    category: 'Access',
    tier: 5,
    mitre: 'T1548 Abuse Elevation Control Mechanism',
    unlockHint: 'Get root on a box with getroot.',
    realWorld: [
      'Getting in usually gives you a normal user. Privilege escalation turns that into root (admin) by abusing a misconfiguration.',
      'Classic routes: a binary with the SUID bit set that runs as root (find / -perm -4000), a sudo rule that lets a user run something like vim or find as root (GTFOBins lists hundreds), or a writable cron script that root runs every minute.',
    ],
    inGame: [
      'getroot <host> needs enough open ports (shown as "ports required" on the target panel) and no active firewall.',
      'Uses 280 MB RAM, so you usually wait for your crackers to finish first. Root lets you ls, cat, rm and scp on the box.',
    ],
    defense: [
      'Least privilege: users get only the rights they need. Audit SUID binaries and sudo rules regularly.',
      'EDR and auditd can alert when a normal user suddenly spawns a root shell.',
    ],
    interview: [
      "Privilege escalation is going from a normal user to admin or root, usually through a misconfiguration or an unpatched local bug.",
      "Least privilege and fast patching are the main defenses, and a new root session from an odd account is worth an alert.",
    ],
    related: ['ssh-credential-attacks', 'covering-tracks'],
  },
  {
    id: 'covering-tracks',
    title: 'Covering Tracks & Anti-Forensics',
    category: 'Forensics',
    tier: 9,
    mitre: 'T1070 Indicator Removal',
    unlockHint: 'Delete a log file on a breached host.',
    realWorld: [
      'Attackers delete or edit logs to hide what they did. On Linux that usually means /var/log/auth.log, syslog and shell history.',
      'It rarely works as well as in movies. Real companies forward logs off the box to a SIEM in near real time, so the copy you delete is not the only copy, and a log file that suddenly shrinks is itself suspicious.',
    ],
    inGame: [
      'rm /var/log/* on a box you own clears its alert state and drops some heat, once per host.',
      'Pair it with dc: lingering on an alerted host keeps the trace climbing.',
    ],
    defense: [
      'Ship logs to a central SIEM or immutable storage. Use file integrity monitoring on /var/log.',
      'Alert on log deletion, cleared Windows event logs (event ID 1102) and gaps in log flow.',
    ],
    interview: [
      "Attackers delete or edit logs to hide what they did. That is why logs should be forwarded to a SIEM in real time.",
      "A sudden gap in a host's logging is a signal in itself, so I'd treat cleared logs as suspicious, not as quiet.",
    ],
    related: ['log-analysis', 'the-trace'],
  },
  {
    id: 'log-analysis',
    title: 'Log Analysis & Intrusion Detection',
    category: 'Blue Team',
    tier: 2,
    unlockHint: 'grep through an auth log.',
    realWorld: [
      'Logs are the core of a SOC analyst job. /var/log/auth.log records every SSH login attempt with time, user and source IP.',
      'The brute force pattern: many "Failed password" lines from one IP, then an "Accepted password" from the same IP. That last line is the compromise.',
      'Building a timeline (first seen, last failure, success, what happened after) is how an analyst turns log lines into an incident report.',
    ],
    inGame: [
      'grep Accepted /var/log/auth.log shows successful logins. grep -c Failed counts failures.',
      'Pipes work: cat /var/log/auth.log | grep Failed | sort | uniq -c',
      'Submit answers to log contracts with submit <contract> <answer>.',
    ],
    defense: [
      'This is the defense. A SIEM (Splunk, Elastic, Sentinel) runs the same searches automatically as correlation rules, like "5+ failures then a success from one IP within 10 minutes".',
      'Tier 1 analysts triage those alerts: confirm, scope, escalate. Knowing the raw log format makes you faster at it.',
    ],
    interview: [
      "When I triage an auth alert I separate noise from signal. Failed logins alone are background. A success after many failures from an outside IP is the IOC.",
      "I'd mention grep for quick checks on a box and SIEM queries like stats count by src_ip for the bigger picture.",
    ],
    related: ['ssh-credential-attacks', 'covering-tracks', 'the-trace'],
  },
  {
    id: 'the-trace',
    title: 'The Trace: How Attacks Get Detected',
    category: 'Blue Team',
    tier: 9,
    unlockHint: 'Let your trace climb past 50%.',
    realWorld: [
      'Defenders do not catch attackers by magic. Every scan, failed login and exploit attempt leaves log lines and network traffic, and detection tools add those signals up.',
      'Dwell time is how long an attacker stays undetected. Noisy, fast actions shorten it; slow and quiet ones stretch it. That is why real operators trade speed for stealth.',
    ],
    inGame: [
      'The TRACE meter is the SOC watching you. Tools add heat while they run, and staying connected to an alerted host keeps it rising.',
      'Disconnecting does not reset it. Heat only cools slowly while you are idle and offline from alerted hosts.',
      'At 50% an analyst starts correlating. At 75% your source is flagged and heat builds faster. At 100% you are traced and the run ends.',
    ],
    defense: [
      'Detection engineering: write rules that fire on the noisy steps (scans, brute force, new admin sessions).',
      'Rate-limit logins, alert on anomalies, and hunt for the quiet attackers the rules miss.',
    ],
    interview: [
      "A SOC correlates lots of small, low-confidence events into one alert. One failed login is nothing; fifty plus a scan plus a new admin session is an incident.",
      "That is why attackers try to stay slow and quiet, and why defenders tune correlation rules instead of alerting on every single event.",
    ],
    related: ['port-scanning', 'log-analysis', 'covering-tracks'],
  },
  {
    id: 'firewall-rules',
    title: 'Firewall Rules & Pivoting',
    category: 'Network',
    tier: 4,
    mitre: 'T1090 Proxy',
    unlockHint: 'Read a firewall ruleset with fwrules.',
    realWorld: [
      'A host firewall like iptables reads rules top to bottom and applies the first match. A default policy of DROP means anything not explicitly allowed is blocked.',
      'Rules often trust internal machines: "accept TCP from the gateway". If an attacker owns that gateway, they can pivot through it and the firewall waves them in.',
    ],
    inGame: [
      'fwrules <host> prints the ruleset. Look for the ACCEPT rule that allows TCP to the ports you need, and note its source (-s).',
      'fwbypass <host> --src <ip> routes your traffic through a box you own. It only works if that box matches the rule.',
    ],
    defense: [
      'Segment networks so one compromised box does not trust-unlock another. Log and alert on drops.',
      'Zero trust: authenticate every connection instead of trusting source IPs.',
    ],
    interview: [
      "Firewall rules are checked top-down and the first match wins, with a default deny at the end.",
      "A rule that trusts one source IP is only as safe as that host. If it gets compromised, it becomes a pivot past the firewall.",
    ],
    related: ['privilege-escalation', 'port-scanning'],
  },
  {
    id: 'ftp-anonymous',
    title: 'FTP: Anonymous Login & Cleartext',
    category: 'Access',
    tier: 5,
    mitre: 'T1078.001 Default Accounts',
    unlockHint: 'Open an FTP port with ftploot.',
    realWorld: [
      'FTP is a 1970s file transfer protocol that sends usernames and passwords in cleartext. Anyone sniffing the network can read them.',
      'Many servers still allow "anonymous" login, sometimes with write access or with sensitive files left in the public folder.',
    ],
    inGame: [
      'ftploot <host> tries anonymous login on port 21. It is quick, light on RAM and very quiet, so it is a great way to open a required port.',
    ],
    defense: [
      'Disable anonymous FTP and replace FTP with SFTP or HTTPS.',
      'Alert on anonymous logins and on cleartext protocols crossing the network.',
    ],
    interview: [
      "Anonymous FTP lets anyone log in without a password, and plain FTP sends credentials in cleartext.",
      "If I found it on an internet-facing box I'd flag it and recommend SFTP with real accounts instead.",
    ],
    related: ['ssh-credential-attacks', 'weak-default-creds'],
  },
  {
    id: 'soc-disposition',
    title: 'SOC Disposition & Case Closure',
    category: 'Blue Team',
    tier: 3,
    unlockHint: 'Set disposition tp on a training shift ticket.',
    realWorld: [
      'Tier 1 closes or escalates with a disposition: false positive, true positive, or escalate. TP requires documented evidence and often lead approval before containment.',
    ],
    inGame: [
      'disposition fp|tp|escalate then submit defense <ioc> on the preview shift.',
      'Closing a spray as FP when auth.log shows fail→accept is a training fail.',
    ],
    defense: [
      'Match the story to the data before you close. SLA clocks punish chasing INFO while CRITICAL waits.',
    ],
    interview: [
      "Every alert ends in a disposition: true positive, false positive, or escalate.",
      "I base the call on the evidence in the logs, not on the severity label the alert came with.",
    ],
    related: ['log-analysis', 'the-trace'],
  },
  {
    id: 'false-positive-tuning',
    title: 'False Positives & Alert Tuning',
    category: 'Blue Team',
    tier: 3,
    unlockHint: 'Close an expected-activity alert as a false positive.',
    realWorld: [
      'A false positive is an alert that fired on harmless activity. Approved vulnerability scanners, backup jobs and admin scripts trip detection rules every day.',
      'Analysts check context before deciding: an allowlist of approved scanner ranges, a change ticket (CHG-1234) that schedules the work, or the asset owner confirming it.',
      'Too many false positives cause alert fatigue: analysts start skimming and miss the real attack. Tuning a rule (suppress a known source during a known window) fixes the root cause.',
    ],
    inGame: [
      'Defense shift: the Harbor port-scan ticket. less ~/cases/scanner-allowlist.txt, confirm the IP is in the approved range and inside its window.',
      'disposition fp, note the evidence (IP, range, change ticket), then submit defense.',
    ],
    defense: [
      'Never suppress a whole alert type. Scope a tuning rule to the exact source range and time window, and review it when the change ticket expires.',
      'An attacker can hide inside expected noise, so confirm the source really is the approved scanner (range, timing, behavior).',
    ],
    interview: [
      "A false positive is an alert on harmless activity, like an approved vulnerability scanner. I'd confirm it against the allowlist or change ticket before closing.",
      "Then I'd suggest a tuning rule scoped to that source and time window, because too many false positives cause alert fatigue.",
    ],
    related: ['soc-disposition', 'port-scanning', 'analyst-notes'],
  },
  {
    id: 'soc-escalation',
    title: 'Escalation: L1 to L2',
    category: 'Blue Team',
    tier: 3,
    mitre: 'T1078.004 Cloud Accounts',
    unlockHint: 'Escalate a possible account takeover to L2.',
    realWorld: [
      'Tier 1 triages; Tier 2 investigates deeper and owns containment. Escalating is not failing: it is the correct move when a case needs authority or depth L1 does not have.',
      'Classic escalation trigger: a user signs in successfully right after failures, from a country or device never seen before, at odd hours. That pattern suggests account takeover (ATO).',
      'MFA fatigue: attackers spam push prompts until a tired user taps Approve. A new inbox forwarding rule right after login is a common next step.',
    ],
    inGame: [
      'Defense shift: the Contoso sign-in ticket. Compare contoso-signin.log against the user baseline, then disposition escalate.',
      'The note is the handoff. L2 should be able to act without re-investigating.',
    ],
    defense: [
      'L2 contains: revoke sessions and tokens, reset the password, remove malicious inbox rules, check what was accessed, and call the user on a known number.',
      'Prevent: phishing-resistant MFA (FIDO2), number matching on push, conditional access that blocks new countries.',
    ],
    interview: [
      "Escalating is not failing. A successful login after failures from a new country is a possible account takeover, and L2 owns containment.",
      "My escalation note would give L2 the user, source IP, country and time window so they can revoke sessions quickly.",
    ],
    related: ['soc-disposition', 'analyst-notes', 'weak-default-creds'],
  },
  {
    id: 'analyst-notes',
    title: 'Analyst Notes That Hold Up',
    category: 'Blue Team',
    tier: 2,
    unlockHint: 'Attach a note to a ticket on a defense shift.',
    realWorld: [
      'Every ticket you close is read later: by L2, by QA, by an auditor, maybe by a court. The note is your evidence trail.',
      'A good note answers who, what, when, where and why you decided: the user, the source IP, the time window, the log you checked, and the disposition reason.',
      'Bad note: "looks fine, closing". Good note: "192.0.2.25 in approved scanner range 192.0.2.16/28 (CHG-4471), activity 02:14-02:54 inside Tue window. FP."',
    ],
    inGame: [
      'note <text> attaches a note to the focused ticket. Scoring checks that it cites the key evidence (IPs, users, times); each item cited earns bonus XP.',
    ],
    defense: [
      'Write the note as if the next analyst has never seen the case. Use exact values and UTC times, not "the weird IP".',
    ],
    interview: [
      "My notes answer who, what, when and why: exact IPs, usernames and UTC times, plus the evidence I checked.",
      "The goal is that the next analyst, or an auditor, never has to redo my investigation.",
    ],
    related: ['soc-disposition', 'soc-escalation', 'false-positive-tuning'],
  },
];

export const INDEX_BY_ID = Object.fromEntries(INDEX_ENTRIES.map((e) => [e.id, e]));
