# Shared database compatibility verification

Canonical storage remains aion_shared_memories; memory_vectors is a security_invoker compatibility view, not a copied dataset. JWT authenticated access only; anon has no access. Client uses exact BAAI/bge-m3 1024 vectors and explicit project/user/character bindings.

Implemented: refresh coalescing, account/project scoped bindings, role-specific consolidation/compression/delete, legacy remote interface routing, transactionally written revisions/events, canonical timestamp preservation, repeated identical-write guards.

Revision semantics: client looks up current revision immediately before upsert and server rejects changed/missing expected revisions for existing rows. This detects races between lookup and write, NOT stale local edits against cloud changes that occurred before lookup. Full offline version tracking and conflict resolution remains a limitation; do not claim complete cross-device conflict protection. Patch/delete have server serialization and idempotent state guards, not optimistic base revisions.

Evidence: build and helper tests pass locally. Database rollback tests verify preserved millisecond timestamps and rejection of stale expected revisions. These SQL tests used administrative execution with auth claim and do NOT establish real browser JWT/RLS end-to-end success. User login and actual recall/write verification still required before production readiness. No frontend production deployment yet.
