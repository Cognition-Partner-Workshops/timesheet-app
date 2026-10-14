# Security Backlog — Consolidated Findings

> Generated: 2026-06-26  
> Scan tools: `npm audit` (timesheet-app backend/frontend), `grype` (uc-cve-remediation-regulatory-compliance)  
> ESLint security rules: no violations found in timesheet-app

---

## CRITICAL

| # | Repo | Dependency | Version | Vulnerability | CVSS | Fix Version |
|---|------|-----------|---------|---------------|------|-------------|
| 1 | uc-cve-remediation | spring-beans | 5.3.15 | GHSA-36p3-wjmg-h94x (CVE-2022-22965 Spring4Shell) | 9.8 | 5.3.18 |
| 2 | uc-cve-remediation | spring-webmvc | 5.3.15 | GHSA-36p3-wjmg-h94x (Spring4Shell) | 9.8 | 5.3.18 |
| 3 | uc-cve-remediation | tomcat-embed-core | 9.0.56 | GHSA-83qj-6fr2-vhqg | 9.8 | 9.0.99 |
| 4 | uc-cve-remediation | spring-web | 5.3.15 | GHSA-4wrc-f8pq-fpqp | 9.8 | 6.0.0 |
| 5 | uc-cve-remediation | spring-security-core | 5.6.1 | GHSA-hh32-7344-cg2f | 9.8 | 5.6.4 |
| 6 | uc-cve-remediation | spring-security-web | 5.6.1 | GHSA-hh32-7344-cg2f | 9.8 | 5.6.4 |
| 7 | uc-cve-remediation | spring-security-core | 5.6.1 | GHSA-mmmh-wcxm-2wr4 | 9.8 | 5.6.9 |
| 8 | uc-cve-remediation | spring-webmvc | 5.3.15 | GHSA-7phw-cxx7-q9vq | 9.1 | 5.3.26 |
| 9 | uc-cve-remediation | spring-security-config | 5.6.1 | GHSA-3h6f-g5f3-gc4w | 9.1 | 5.6.12 |
| 10 | uc-cve-remediation | spring-security-web | 5.6.1 | GHSA-c4q5-6c82-3qpw | 9.3 | 5.7.13 |
| 11 | uc-cve-remediation | tomcat-embed-core | 9.0.56 | GHSA-r29c-68gh-xp6x | 9.8 | 9.0.118 |
| 12 | uc-cve-remediation | tomcat-embed-core | 9.0.56 | GHSA-h6fc-48rj-7qqh | 9.8 | 9.0.118 |
| 13 | uc-cve-remediation | tomcat-embed-core | 9.0.56 | GHSA-5m62-pw8w-7w9f | 9.1 | 9.0.118 |
| 14 | uc-cve-remediation | spring-security-web | 5.6.1 | GHSA-mf92-479x-3373 | 9.1 | No fix available |
| 15 | uc-cve-remediation | minimist (frontend) | 1.2.5 | GHSA-xvch-5gv4-984h (Prototype Pollution) | 9.8 | 1.2.6 |
| 16 | uc-cve-remediation | shell-quote (frontend) | 1.7.2 | GHSA-g4rg-993r-mgx7 | 9.8 | 1.7.3 |
| 17 | uc-cve-remediation | shell-quote (frontend) | 1.7.2 | GHSA-w7jw-789q-3m8p | 9.2 | 1.8.4 |
| 18 | uc-cve-remediation | loader-utils (frontend) | 1.2.3 | GHSA-76p3-8jx3-jpfq | 9.8 | 1.4.1 |
| 19 | uc-cve-remediation | @babel/traverse (frontend) | 7.11.0 | GHSA-67hx-6x53-jw92 | 9.3 | 7.23.2 |
| 20 | uc-cve-remediation | cipher-base (frontend) | 1.0.4 | GHSA-cpq7-6gpm-g9rc | 9.1 | 1.0.5 |
| 21 | uc-cve-remediation | pbkdf2 (frontend) | 3.1.1 | GHSA-v62p-rq8g-8h59 | 9.1 | 3.1.3 |
| 22 | uc-cve-remediation | pbkdf2 (frontend) | 3.1.1 | GHSA-h7cp-r72f-jxh6 | 9.1 | 3.1.3 |
| 23 | uc-cve-remediation | elliptic (frontend) | 6.5.3 | GHSA-vjh7-7g9h-fjfh | 9.0 | 6.6.1 |
| 24 | uc-cve-remediation | sha.js (frontend) | 2.4.11 | GHSA-95m3-7q98-8xr5 | 9.1 | 2.4.12 |

---

## HIGH

### timesheet-app — Backend (`npm audit`)

| # | Dependency | Installed | Vulnerability | CVSS | Fix |
|---|-----------|-----------|---------------|------|-----|
| 1 | sqlite3 | 5.1.7 | Multiple (native addon chain: cacache, tar, node-gyp, make-fetch-happen) | 8.8 | ≥6.0.1 |
| 2 | path-to-regexp | 0.1.12 | GHSA-37ch-88jc-xwx2 (ReDoS) | 7.5 | ≥0.1.13 |
| 3 | form-data | 4.0.5 | GHSA-hmw2-7cc7-3qxx (CRLF injection) | 7.5 | ≥4.0.6 |
| 4 | minimatch | ≤3.1.3 | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS) | 7.5 | ≥3.1.4 |
| 5 | picomatch | ≤2.3.1 | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj (ReDoS/Method Injection) | 7.5 | ≥2.3.2 |
| 6 | tar | ≤7.5.15 | GHSA-34x7-hfp2-rc4v + 6 others (path traversal, symlink attacks) | 8.8 | ≥7.5.16 |
| 7 | jws | <3.2.3 | GHSA-869p-cjfg-cm3x (Signature verification bypass) | 7.5 | ≥3.2.3 |

### timesheet-app — Frontend (`npm audit`)

| # | Dependency | Installed | Vulnerability | CVSS | Fix |
|---|-----------|-----------|---------------|------|-----|
| 1 | axios | 1.13.2 | 23 advisories (SSRF, Prototype Pollution, DoS, credential leak) | 8.7 | ≥1.16.0 |
| 2 | react-router / react-router-dom | 7.10.0 | GHSA-2w69-qvjg-hvjx + 8 others (XSS, RCE, DoS) | 8.2 | ≥7.15.0 |
| 3 | vite | 7.2.6 | GHSA-4w7w-66w2-5vf9 + 4 others (path traversal, file read) | 7.5 | ≥7.4.0 |
| 4 | rollup | 4.53.3 | GHSA-mw96-cpmx-2vgc (path traversal file write) | 7.5 | ≥4.59.0 |
| 5 | flatted | 3.3.3 | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh (DoS, prototype pollution) | 7.5 | ≥3.5.0 |
| 6 | form-data | 4.0.0–4.0.5 | GHSA-hmw2-7cc7-3qxx (CRLF injection) | 7.5 | ≥4.0.6 |
| 7 | minimatch | 3.1.2 | GHSA-3ppc-4f35-3m26 + 2 others (ReDoS) | 7.5 | ≥3.1.4 |
| 8 | picomatch | 4.0.3 | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj (ReDoS/Method Injection) | 7.5 | ≥4.0.4 |

### uc-cve-remediation-regulatory-compliance (`grype`)

| # | Dependency | Version | Vulnerability | CVSS | Fix |
|---|-----------|---------|---------------|------|-----|
| 1 | snakeyaml | 1.29 | GHSA-mjmj-j48q-9wg2 (DoS/Code execution) | 8.3 | 2.0 |
| 2 | tomcat-embed-core | 9.0.56 | GHSA-wmwf-9ccg-fff5 + 12 others | 8.7 | 9.0.118 |
| 3 | jackson-databind | 2.13.1 | GHSA-57j2-w4cx-62h2, GHSA-jjjh-jjxp-wpff, GHSA-rgv9-q543-rqg4, GHSA-j3rv-43j4-c7qm | 8.2 | 2.18.8 |
| 4 | jackson-core | 2.13.1 | GHSA-h46c-h94j-95f3 | 8.7 | 2.15.0 |
| 5 | spring-web | 5.3.15 | GHSA-ccgv-vj62-xf9h, GHSA-hgjh-9rj2-g67j | 8.1 | 5.3.33 |
| 6 | spring-context | 5.3.15 | GHSA-g5mm-vmx4-3rg7 | 7.5 | 5.3.19 |
| 7 | spring-beans | 5.3.15 | GHSA-hh26-6xwr-ggv7 | 7.5 | 5.3.20 |
| 8 | spring-security-core | 5.6.1 | GHSA-f3jh-qvm4-mg39 | 8.2 | 5.7.12 |
| 9 | spring-security-crypto | 5.6.1 | GHSA-mg83-c7gq-rv5c | 7.4 | 5.7.16 |
| 10 | protobuf-java | 3.9.0 | GHSA-735f-pc8j-v9w8 + 2 others | 8.7 | 3.25.5 |
| 11 | graphql-java | 17.3 | GHSA-v62j-cxhh-fq22 | 7.5 | 17.4 |
| 12 | axios (frontend) | 0.19.2 | Multiple (SSRF, credential leak, DoS) | 8.6 | 0.32.0 |
| 13 | follow-redirects (frontend) | 1.5.10 | GHSA-74fj-2j2h-c42q | 8.0 | 1.14.7 |
| 14 | node-fetch (frontend) | 2.6.0 | GHSA-r683-j2x4-v87g | 8.8 | 2.6.7 |
| 15 | serialize-javascript (frontend) | 3.1.0 | GHSA-5c6j-r48x-rmvq | 8.1 | 7.0.3 |
| 16 | glob-parent (frontend) | 5.1.1 | GHSA-ww39-953v-wcq6 | 7.5 | 5.1.2 |
| 17 | minimatch (frontend) | 3.0.4 | GHSA-3ppc-4f35-3m26 + 2 others | 8.7 | 3.1.3 |
| 18 | lodash (frontend) | 4.17.19 | GHSA-35jh-r3h4-6jhm (Command Injection) | 7.2 | 4.17.21 |

---

## MEDIUM (Summary)

### timesheet-app (26 findings)

- **Backend**: body-parser, express, jest (chain of 15+ transitive deps), joi, js-yaml, qs, brace-expansion, ip-address
- **Frontend**: ajv, brace-expansion, follow-redirects, js-yaml, postcss, yaml

### uc-cve-remediation-regulatory-compliance (90 findings)

Key affected packages: tomcat-embed-core (6), snakeyaml (4), spring-expression (2), spring-webmvc (1), axios (3), postcss (3), follow-redirects (3), next (3), jackson-databind (1), commons-lang3 (1), protobuf-java (1), and various frontend transitive deps.

---

## Notes

- **ESLint security scan** (timesheet-app): 0 violations for `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` in both backend and frontend.
- **OWASP Dependency-Check** could not complete on uc-cve-remediation-regulatory-compliance due to NVD feed deprecation (HTTP 403). `grype` was used as a fallback scanner with equivalent coverage.
- Findings with "No fix available" require upgrading the parent framework (e.g., Spring Boot 2.6.x → 3.x).
