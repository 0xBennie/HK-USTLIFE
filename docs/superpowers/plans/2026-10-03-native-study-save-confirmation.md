# Study editor save confirmation and completion audit

Observed: StudySaveController treats any fulfilled request as saved. It does not verify record identity/version/content or reject a backwards/nonfinite clock before replaying an expiring creation receipt. This can dismiss a form after an invalid acknowledgement or recreate content after receipt expiry.

1. Validate the existing course/item/occurrence response contracts against the submitted request. Keep unconfirmed payload and key; reuse the existing shared replay-window policy.
2. Preserve normal validation correction and version conflict behavior. Surface a return-to-records action when replay requires review; do not keep offering a guaranteed-failing retry.
3. Add real backend tests for malformed acknowledgements, normalized values, record/version/occurrence mismatches and clock anomalies. Run the relevant suite, full regression, native typecheck/export.
4. Save a current V01–V10 / MV01–MV12 evidence matrix that separates implementation from actual iOS runtime. Update the stale handoff summary. No new scope, deployment or Xcode installation.
