# 07 — Deploy Prepared notes

Status: ready-for-human
Type: HITL

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

Turn the feature on in production. HITL because it touches the cluster and
secrets, and the `/ship` and `/land-and-deploy` steps are user-triggered.

- Create a k8s Secret for `LOCAL_AI_API_KEY`; set `LOCAL_AI_BASE_URL` and
  `LOCAL_AI_MODEL` on the deployment.
- Confirm an **app pod** in the app's namespace can reach Strata's ClusterIP.
  It was reachable from the dev container; that hasn't been checked from the
  app pods.
- Apply migration `0006` out of band before rolling the image (the runner never
  migrates).
- After rollout, watch the generation log lines for the first full sweep:
  latency, outcomes, and that the two replicas never generate the same date.

## Acceptance criteria

- [ ] Secret and env vars in place; key not in any commit
- [ ] Strata reachable from an app pod
- [ ] Migration `0006` applied before the new image rolls
- [ ] First sweep completes for all eligible dates; latency and outcomes noted
      in Comments
- [ ] Tonight shows a brief and Prepared ranking in production

## Blocked by

- Issues 01–06
- All five issues in `.issues/architecture-deepening-2026-10-23/` (they fix
  freeze and staleness bugs in this feature and land on the same branch)

## Comments
