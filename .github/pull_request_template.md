## What and why
<!-- One or two sentences: what changed, and why. -->

## How it was tested
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`
- [ ] Security suite (`python3 supabase/tests/security/run_all.py`) if I touched migrations or policies
- [ ] I tried it in the browser (describe)

## Checklist
- [ ] Tests added or updated; docs updated if behaviour changed
- [ ] No secrets, `.env*` files or generated patch/build files committed
- [ ] New tables have RLS; new privileged functions are revoked from `anon`/`authenticated`
