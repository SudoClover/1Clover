-- pgTAP smoke test: proves the database test harness runs in CI.
-- Real RLS tests (the two-user "can't see each other's data" tests + an
-- assertion that RLS is enabled on every table) arrive with the first tables
-- in Slice 1. See CLAUDE.md §6.
begin;
select plan(1);
select ok(true, 'pgTAP harness runs');
select * from finish();
rollback;
