# Security Policy

Learners trust this platform with their accounts and personal details, so we take security
reports seriously and welcome responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue.** Email **dinfadashe@gmail.com** with the subject
"Security — Web3tribe University" and include:

- what you found and where (URL, endpoint, table or file);
- steps to reproduce, and the impact you believe it has;
- any proof-of-concept — but **please use your own test accounts and do not access, change or
  download other people's data**.

We aim to acknowledge reports within **3 working days** and to give a plan or fix timeline
within **14 days**. We will credit you if you wish. We will not take legal action against good-faith
research that follows this policy: no data destruction, no service disruption, no social
engineering, and no testing of other people's accounts.

## Supported versions

Only the current `main` branch is supported.

## What is in scope

The application in this repository and its Supabase database policies. Third-party services
(Supabase, Vercel, Paystack, Resend) should be reported to those providers.

## Our own testing

Security fixes are recorded in `docs/SECURITY_REMEDIATION_*.md`. The database policies are
protected by an automated attack-replay suite (`supabase/tests/security/`) and non-destructive live
retest scripts (`supabase/security/`). Pull requests must keep that suite green.
