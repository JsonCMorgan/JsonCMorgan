/** Boundry cafe drill bank — from Jason's co-pilot prompt. No dumps. */
window.CAFE_QUIZ = {
  flashcards: [
    {
      id: "f1",
      cat: "Boundry",
      front: "Boundry one-liner",
      back: "Boundry is my private offline-first SOC training gym and command center. I practice the desk on Practice clients, and I keep Live ops honest so Practice never pretends to be Real.",
      say: "I’m building Boundry.AI, a private SOC-style command center I use to train like an L1."
    },
    {
      id: "f2",
      cat: "Boundry",
      front: "What is Control Room?",
      back: "HQ of Boundry: Attention rail, KPIs, and tools entry point.",
      say: "Control Room is my HQ view for attention, KPIs, and jumping into tools."
    },
    {
      id: "f3",
      cat: "Boundry",
      front: "What is /soc (SOC Floor)?",
      back: "Real + Practice queues, Boundry Tickets (BT-…), SLA, work notes, Arrived/Away presence.",
      say: "SOC Floor is where I work tickets with Real and Practice lanes kept labeled."
    },
    {
      id: "f4",
      cat: "Boundry",
      front: "Privacy rule for Boundry AI",
      back: "Ollama local first for client/ops AI. Anthropic only as fallback. Client/ops data stays on-machine.",
      say: "For client and ops prompts I keep AI local with Ollama so data stays on my machine."
    },
    {
      id: "f5",
      cat: "Boundry",
      front: "Boundry vs Security Onion",
      back: "Boundry is a custom Flask stack on Windows (SIEM lite, tickets, Career labs). Security Onion is a separate Linux SOC/NSM distro. Jason has not claimed hands-on Onion yet.",
      say: "I know Security Onion is a Linux SOC/NSM platform, but I haven’t run it hands-on yet. My practice stack is custom on Windows."
    },
    {
      id: "f6",
      cat: "Desk",
      front: "SOC",
      back: "Security Operations Center: people watching alerts and responding.",
      say: "SOC is the team that monitors alerts and responds when something looks off."
    },
    {
      id: "f7",
      cat: "Desk",
      front: "L1 / Tier-1",
      back: "Front line: triage, document, escalate. Not architecture or deep IR lead work.",
      say: "Tier-1 is front-line triage, clean tickets, and knowing when to escalate."
    },
    {
      id: "f8",
      cat: "Desk",
      front: "TP / FP",
      back: "True positive = real badness. False positive = noise that looked like an alert but wasn’t.",
      say: "I’m trying to separate true positives from false positives before I burn senior time."
    },
    {
      id: "f9",
      cat: "Desk",
      front: "Triage",
      back: "Sort and decide what matters first.",
      say: "Triage is sorting urgency and impact so the right things get eyes first."
    },
    {
      id: "f10",
      cat: "Desk",
      front: "Escalate",
      back: "Hand to more senior / IR with a clear reason, evidence, and what you already checked.",
      say: "If I’m escalating, I’ll say why, what I checked, and what I need from the next level."
    },
    {
      id: "f11",
      cat: "Desk",
      front: "Playbook",
      back: "Step-by-step response for a known alert type.",
      say: "A playbook is the checklist we follow for a known alert pattern."
    },
    {
      id: "f12",
      cat: "Desk",
      front: "Ticket / case",
      back: "The record of what happened, evidence, actions, and next step.",
      say: "I treat the ticket as the handoff artifact: what, evidence, actions, next."
    },
    {
      id: "f13",
      cat: "Desk",
      front: "SLA",
      back: "Service level agreement: how fast you must respond by priority.",
      say: "SLA is the clock on how fast we acknowledge or resolve by priority."
    },
    {
      id: "f14",
      cat: "Desk",
      front: "Handoff",
      back: "End-of-shift note so the next analyst can continue without redoing your work.",
      say: "A good handoff means the next person can pick up without guessing."
    },
    {
      id: "f15",
      cat: "Tools",
      front: "SIEM",
      back: "Security Information and Event Management: collect and correlate logs/alerts.",
      say: "SIEM is where logs land and get correlated into alerts you can hunt."
    },
    {
      id: "f16",
      cat: "Tools",
      front: "EDR",
      back: "Endpoint Detection and Response: host process/timeline, often isolate a host.",
      say: "EDR is the endpoint timeline tool, process tree and isolate when needed."
    },
    {
      id: "f17",
      cat: "Tools",
      front: "SOAR",
      back: "Security Orchestration, Automation, Response: automate steps with human gates.",
      say: "SOAR automates repeatable steps, but humans still approve the risky ones."
    },
    {
      id: "f18",
      cat: "Tools",
      front: "XDR",
      back: "Broader detection across email/identity/endpoint/cloud. Marketing-heavy. Ask what they mean.",
      say: "When someone says XDR I ask which signals they actually correlate."
    },
    {
      id: "f19",
      cat: "Tools",
      front: "IDS / IPS",
      back: "Intrusion detection / prevention on network traffic. IDS alerts, IPS can block.",
      say: "IDS watches network traffic for bad patterns. IPS can block them."
    },
    {
      id: "f20",
      cat: "Tools",
      front: "Sentinel",
      back: "Microsoft’s cloud SIEM. Often paired with KQL hunting.",
      say: "Sentinel is Microsoft’s cloud SIEM, and I’m building KQL literacy for MSSP work."
    },
    {
      id: "f21",
      cat: "Tools",
      front: "Splunk / SPL",
      back: "Common SIEM / search platform. SPL is its query language. Boundry uses SPL-lite for practice, not Splunk Enterprise.",
      say: "I practice SPL-style search in my own stack. I’m not claiming Splunk Enterprise customer time."
    },
    {
      id: "f22",
      cat: "Tools",
      front: "KQL",
      back: "Kusto Query Language. Used in Microsoft Sentinel hunting.",
      say: "KQL is the query language for hunting in Sentinel."
    },
    {
      id: "f23",
      cat: "Identity",
      front: "MFA",
      back: "Multi-factor authentication: password plus another factor.",
      say: "MFA is the second factor that stops a lot of spray and phish from becoming a full takeover."
    },
    {
      id: "f24",
      cat: "Identity",
      front: "IdP / Entra ID",
      back: "Identity provider. Entra ID is Microsoft cloud identity (old name Azure AD).",
      say: "Entra ID is Microsoft’s cloud identity. Old name was Azure AD."
    },
    {
      id: "f25",
      cat: "Identity",
      front: "BEC",
      back: "Business email compromise: attackers abuse email to steal money or access.",
      say: "BEC is when email gets abused to move money or access, often with almost no malware."
    },
    {
      id: "f26",
      cat: "Identity",
      front: "SPF / DKIM / DMARC",
      back: "Email authentication checks for who is allowed to send as this domain.",
      say: "SPF, DKIM, and DMARC are how we check whether mail claiming a domain is allowed to."
    },
    {
      id: "f27",
      cat: "Identity",
      front: "Password spray",
      back: "Few passwords tried across many accounts (opposite of blasting one account with many passwords).",
      say: "Spray is a few common passwords across lots of accounts so lockouts stay quiet."
    },
    {
      id: "f28",
      cat: "Identity",
      front: "Impossible travel",
      back: "Logons from distant places too quickly to be realistic for one human.",
      say: "Impossible travel is a sign the same account showed up in two places too fast."
    },
    {
      id: "f29",
      cat: "Vuln",
      front: "CVE",
      back: "Catalog ID for a known vulnerability.",
      say: "CVE is the public ID for a known vuln, then we still need asset context."
    },
    {
      id: "f30",
      cat: "Vuln",
      front: "CVSS",
      back: "Severity score. Context still matters: exploitability plus how important the asset is.",
      say: "CVSS is a severity score, but I still ask about exploitability and the asset."
    },
    {
      id: "f31",
      cat: "Vuln",
      front: "IOC",
      back: "Indicator of compromise: IP, hash, domain, etc.",
      say: "IOCs are the breadcrumbs like IPs, hashes, and domains we can search for."
    },
    {
      id: "f32",
      cat: "Vuln",
      front: "MITRE ATT&CK",
      back: "Library of attacker techniques (example: T1110 brute force).",
      say: "MITRE ATT&CK is the shared language for attacker techniques."
    },
    {
      id: "f33",
      cat: "Metrics",
      front: "MTTA",
      back: "Mean time to acknowledge: how fast someone picked the alert up.",
      say: "MTTA is how long until an analyst actually owns the alert."
    },
    {
      id: "f34",
      cat: "Metrics",
      front: "MTTR",
      back: "Mean time to resolve/respond. Confirm what they mean. Pipeline speed metric.",
      say: "MTTR is how long to resolve or respond. I ask which definition they use."
    },
    {
      id: "f35",
      cat: "Metrics",
      front: "FP rate",
      back: "How often alerts are noise.",
      say: "FP rate tells you how much of the queue is noise versus signal."
    },
    {
      id: "f36",
      cat: "Privacy",
      front: "Offline-first / on-prem",
      back: "Data stays on your machines instead of defaulting to cloud SaaS.",
      say: "Offline-first for me means client and ops data stay on my box by default."
    },
    {
      id: "f37",
      cat: "Privacy",
      front: "Ollama",
      back: "Local LLM runner Jason uses so client data need not go to the cloud.",
      say: "Ollama is how I run local models so practice and ops prompts stay private."
    },
    {
      id: "f38",
      cat: "Career",
      front: "Jason’s cert path (honest)",
      back: "Holds CompTIA CC. Primary focus now is Security+ (SY0-801; people still say SY0-701). No dumps.",
      say: "I’ve got CompTIA CC, and Security+ is the main gate I’m studying for right now."
    },
    {
      id: "f39",
      cat: "Career",
      front: "Honest Boundry gaps",
      back: "Not commercial 24×7 MDR. Not Security Onion / Splunk Enterprise customer. Client isolation / first paying client hardening still in progress. Linux-for-SOC is a known gap.",
      say: "I’m early-career and pre-revenue. Boundry is practice plus real tooling on my machine, not a 24×7 MDR yet."
    },
    {
      id: "f40",
      cat: "Career",
      front: "Job hunt opener",
      back: "Sec+ is the main gate, then interviews. Optimize for proving triage, tickets, and clear escalate/close judgment.",
      say: "Sec+ is the main gate right now, then interviews. I’m optimizing for triage, tickets, and escalate vs close judgment."
    }
  ],

  mc: [
    {
      id: "m1",
      cat: "Desk",
      q: "What does L1 / Tier-1 mainly do?",
      choices: [
        "Design enterprise architecture",
        "Triage alerts, document, escalate when needed",
        "Lead full malware reverse engineering engagements",
        "Own NetScaler and VPN fleet changes"
      ],
      answer: 1,
      why: "Tier-1 is front-line triage and clean escalation, not senior IR or deep vendor admin."
    },
    {
      id: "m2",
      cat: "Desk",
      q: "A false positive (FP) means:",
      choices: [
        "Confirmed attacker activity",
        "An alert that looked bad but was not real badness",
        "A vulnerability with a CVE",
        "A missed detection"
      ],
      answer: 1,
      why: "FP = noise. TP = real badness."
    },
    {
      id: "m3",
      cat: "Tools",
      q: "SIEM stands for:",
      choices: [
        "Secure Internal Endpoint Monitor",
        "Security Information and Event Management",
        "System Intrusion Enforcement Module",
        "Sentinel Identity Enforcement Manager"
      ],
      answer: 1,
      why: "SIEM collects and correlates logs/alerts."
    },
    {
      id: "m4",
      cat: "Tools",
      q: "EDR is best described as:",
      choices: [
        "Email Domain Reputation",
        "Endpoint Detection and Response on hosts",
        "Enterprise Data Retention",
        "External DNS Resolver"
      ],
      answer: 1,
      why: "EDR gives host process/timeline and often isolate."
    },
    {
      id: "m5",
      cat: "Tools",
      q: "SOAR is mainly about:",
      choices: [
        "Replacing all analysts permanently",
        "Automating response steps, often with human approve-gates",
        "Only network packet capture",
        "Only password resets"
      ],
      answer: 1,
      why: "SOAR orchestrates/automates steps. Humans still gate risky actions."
    },
    {
      id: "m6",
      cat: "Tools",
      q: "Security Onion is:",
      choices: [
        "Jason’s Boundry product name",
        "A Linux SOC/NSM distro with sensors and hunt tooling",
        "Microsoft’s cloud SIEM",
        "A CompTIA exam domain"
      ],
      answer: 1,
      why: "Onion ≠ Boundry. Boundry is custom on Windows."
    },
    {
      id: "m7",
      cat: "Tools",
      q: "KQL is primarily used with:",
      choices: [
        "Splunk Enterprise only",
        "Microsoft Sentinel hunting",
        "NordVPN monitoring only",
        "CompTIA exam dumps"
      ],
      answer: 1,
      why: "KQL = Kusto Query Language for Sentinel-style hunting."
    },
    {
      id: "m8",
      cat: "Identity",
      q: "Password spray usually means:",
      choices: [
        "Many passwords against one account",
        "A few passwords tried across many accounts",
        "Resetting MFA for all users",
        "Blocking SPF records"
      ],
      answer: 1,
      why: "Spray stays quiet by spreading guesses across lots of accounts."
    },
    {
      id: "m9",
      cat: "Identity",
      q: "BEC stands for:",
      choices: [
        "Binary Execution Control",
        "Business email compromise",
        "Backup Encryption Certificate",
        "Boundry Event Console"
      ],
      answer: 1,
      why: "BEC abuses email to steal money or access."
    },
    {
      id: "m10",
      cat: "Identity",
      q: "Entra ID is:",
      choices: [
        "An EDR agent",
        "Microsoft cloud identity (formerly Azure AD)",
        "A SIEM query language",
        "A CVE catalog"
      ],
      answer: 1,
      why: "IdP = identity provider. Entra ID is Microsoft’s."
    },
    {
      id: "m11",
      cat: "Identity",
      q: "SPF, DKIM, and DMARC help with:",
      choices: [
        "Endpoint isolation",
        "Email authentication for a domain",
        "CVSS scoring",
        "SOAR playbook approvals"
      ],
      answer: 1,
      why: "They check who is allowed to send as that domain."
    },
    {
      id: "m12",
      cat: "Vuln",
      q: "An IOC is typically:",
      choices: [
        "A severity score from 0 to 10",
        "An indicator like IP, hash, or domain",
        "A CompTIA practice exam",
        "A VIP party badge"
      ],
      answer: 1,
      why: "IOC = indicator of compromise."
    },
    {
      id: "m13",
      cat: "Vuln",
      q: "CVSS is useful because:",
      choices: [
        "It replaces asset context entirely",
        "It gives a severity score, while exploitability and asset still matter",
        "It proves an alert is a true positive",
        "It is Boundry’s ticket ID format"
      ],
      answer: 1,
      why: "Score + context. Don’t treat CVSS as the whole decision."
    },
    {
      id: "m14",
      cat: "Metrics",
      q: "MTTA measures:",
      choices: [
        "Mean time to acknowledge an alert",
        "Mean tickets to archive",
        "Malware transfer to attacker",
        "Maximum ticket text allowed"
      ],
      answer: 0,
      why: "MTTA = how fast someone picked it up."
    },
    {
      id: "m15",
      cat: "Boundry",
      q: "Jason’s honest Boundry AI default is:",
      choices: [
        "Send all client data to Anthropic first",
        "Local Ollama first, Anthropic only as fallback",
        "Only cloud models for Live ops",
        "No AI anywhere in the stack"
      ],
      answer: 1,
      why: "Privacy: Ollama local for client/ops AI."
    },
    {
      id: "m16",
      cat: "Boundry",
      q: "Real vs Practice in Boundry means:",
      choices: [
        "They are interchangeable labels",
        "Lanes stay labeled so Practice never pretends to be Real",
        "Practice tickets are billed to clients",
        "Real means Security Onion only"
      ],
      answer: 1,
      why: "Honesty rule: always label Real vs Practice."
    },
    {
      id: "m17",
      cat: "Boundry",
      q: "Which is an honest gap Jason can say?",
      choices: [
        "He runs a commercial 24×7 MDR for paying clients",
        "Linux-for-SOC is still a known roadmap gap",
        "He has years of senior IR seats",
        "Boundry is the same product as Security Onion"
      ],
      answer: 1,
      why: "Stay honest. Linux-for-SOC (G10) is on the list."
    },
    {
      id: "m18",
      cat: "Career",
      q: "Best cafe answer for “What’s your stack?”",
      choices: [
        "I’ve administered Splunk Enterprise for five years in production MSSPs",
        "Mostly what I built for practice: log ingest, SPL-lite, ticket floor with Real vs Practice, Career labs. Microsoft-curious for Sentinel/KQL.",
        "I’m a senior NetScaler admin first",
        "I study dumps for Sec+"
      ],
      answer: 1,
      why: "Honest practice stack beats fake vendor years."
    },
    {
      id: "m19",
      cat: "Career",
      q: "Best reply if someone asks if you know Security Onion:",
      choices: [
        "Yeah, Boundry is basically Security Onion.",
        "I know what it is, a Linux SOC/NSM platform, but I haven’t run it hands-on yet. My practice stack is custom on Windows. Linux-for-SOC is on my list.",
        "I deployed it for three enterprise clients.",
        "Security Onion is Microsoft Sentinel."
      ],
      answer: 1,
      why: "Gentle correction. No invented Onion time."
    },
    {
      id: "m20",
      cat: "Desk",
      q: "When should you escalate as L1?",
      choices: [
        "Whenever an alert exists, with no notes",
        "When scope/impact needs senior eyes, after documenting what you checked and why",
        "Only after closing the ticket",
        "Never. L1 resolves everything alone"
      ],
      answer: 1,
      why: "Escalate with reason + evidence + what you already did."
    },
    {
      id: "m21",
      cat: "Identity",
      q: "Impossible travel suggests:",
      choices: [
        "A CVSS score above 9",
        "Logons from distant places too quickly for one person",
        "A DKIM pass",
        "A SOAR approve-gate"
      ],
      answer: 1,
      why: "Classic identity anomaly pattern."
    },
    {
      id: "m22",
      cat: "Tools",
      q: "XDR is a word you should treat as:",
      choices: [
        "A precise IETF standard identical everywhere",
        "Marketing-heavy. Ask which signals they correlate.",
        "Exactly the same as CompTIA CC",
        "Only related to physical badge access"
      ],
      answer: 1,
      why: "Ask what they mean in their stack."
    },
    {
      id: "m23",
      cat: "Boundry",
      q: "Ticket Field Console is meant to practice:",
      choices: [
        "Exam dump memorization",
        "ITSM-style fielded notes: client, priority, disposition, what/evidence/actions/next",
        "Only firewall ACL pushes",
        "NetScaler gateway farms"
      ],
      answer: 1,
      why: "Hire-aligned ticket hygiene."
    },
    {
      id: "m24",
      cat: "Career",
      q: "Jason’s primary cert focus right now is:",
      choices: [
        "CISSP with dumps",
        "CompTIA Security+ (SY0-801 / people may say SY0-701)",
        "Skipping certs entirely",
        "Only AWS Solutions Architect"
      ],
      answer: 1,
      why: "Sec+ first, objectives-aligned, no dumps."
    },
    {
      id: "m25",
      cat: "Desk",
      q: "A playbook is:",
      choices: [
        "A marketing one-pager",
        "Step-by-step response for a known alert type",
        "A CVE catalog",
        "An MFA hardware key"
      ],
      answer: 1,
      why: "Known pattern → known steps."
    },
    {
      id: "m26",
      cat: "Interview",
      q: "MFA fatigue attacks usually try to:",
      choices: [
        "Patch CVEs automatically",
        "Spam push approvals until a user accepts one",
        "Improve DMARC policy",
        "Lower MTTR by closing tickets early"
      ],
      answer: 1,
      why: "User accepts a push they didn’t start. Escalate / follow identity playbook."
    },
    {
      id: "m27",
      cat: "Interview",
      q: "Best L1 instinct on a likely BEC wire-change email:",
      choices: [
        "Ignore it if no malware hash is present",
        "Treat as high-touch fraud risk: verify out-of-band, preserve evidence, escalate per playbook",
        "Close as FP because SPF passed",
        "Wipe the user’s laptop immediately with no ticket"
      ],
      answer: 1,
      why: "BEC often has little malware. Process and verification matter."
    },
    {
      id: "m28",
      cat: "Privacy",
      q: "Offline-first in Jason’s Boundry talk means:",
      choices: [
        "No internet ever on the Windows box",
        "Client/ops data stays on his machines by default",
        "Only cloud SIEM is allowed",
        "He refuses local AI"
      ],
      answer: 1,
      why: "Privacy posture, not “no network forever.”"
    }
  ]
};
