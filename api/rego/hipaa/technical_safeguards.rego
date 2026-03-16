package hipaa.technical_safeguards

# ─────────────────────────────────────────────────────────────────────────────
# §164.312(a)(1) — Access Control
# Input: aws_iam data from CloudQuery / Prowler findings
# ─────────────────────────────────────────────────────────────────────────────

# Unique user identification: no shared user accounts should have console access
deny_shared_accounts[msg] {
    user := input.iam_users[_]
    user.shared == true
    user.console_access == true
    msg := sprintf("Shared account with console access detected: %v", [user.username])
}

# MFA must be enabled for all console users
deny_mfa_missing[msg] {
    user := input.iam_users[_]
    user.console_access == true
    not user.mfa_enabled
    msg := sprintf("MFA not enabled for console user: %v", [user.username])
}

# No root account should have active access keys
deny_root_access_keys[msg] {
    key := input.access_keys[_]
    key.user_name == "root"
    key.status == "Active"
    msg := "Root account has active access keys — violates §164.312(a)(1)"
}

# ─────────────────────────────────────────────────────────────────────────────
# §164.312(b) — Audit Controls
# ─────────────────────────────────────────────────────────────────────────────

# CloudTrail must be multi-region and log validation enabled
deny_cloudtrail[msg] {
    trail := input.cloudtrail_trails[_]
    not trail.is_multi_region_trail
    msg := sprintf("CloudTrail trail '%v' is not multi-region — required by §164.312(b)", [trail.name])
}

deny_cloudtrail_log_validation[msg] {
    trail := input.cloudtrail_trails[_]
    not trail.log_file_validation_enabled
    msg := sprintf("CloudTrail trail '%v' has log file validation disabled — required by §164.312(b)", [trail.name])
}

# CloudWatch log groups for PHI systems should have retention >= 365 days
deny_short_log_retention[msg] {
    group := input.cloudwatch_log_groups[_]
    group.retention_in_days < 365
    msg := sprintf("Log group '%v' has retention < 365 days — HIPAA requires minimum 6-year retention", [group.name])
}

# ─────────────────────────────────────────────────────────────────────────────
# §164.312(c)(1) — Integrity
# ─────────────────────────────────────────────────────────────────────────────

# S3 buckets holding PHI must have versioning enabled
deny_s3_no_versioning[msg] {
    bucket := input.s3_buckets[_]
    bucket.contains_phi == true
    not bucket.versioning_enabled
    msg := sprintf("S3 bucket '%v' contains PHI but versioning is disabled — violates §164.312(c)(1)", [bucket.name])
}

# S3 buckets holding PHI must not be publicly accessible
deny_s3_public_phi[msg] {
    bucket := input.s3_buckets[_]
    bucket.contains_phi == true
    bucket.public_access_block.block_public_acls == false
    msg := sprintf("S3 bucket '%v' contains PHI and has public ACLs allowed — violates §164.312(c)(1)", [bucket.name])
}

# RDS instances with PHI must have deletion protection enabled
deny_rds_no_deletion_protection[msg] {
    db := input.rds_instances[_]
    db.contains_phi == true
    not db.deletion_protection
    msg := sprintf("RDS instance '%v' contains PHI but deletion protection is off — violates §164.312(c)(1)", [db.identifier])
}

# ─────────────────────────────────────────────────────────────────────────────
# §164.312(d) — Person or Entity Authentication
# ─────────────────────────────────────────────────────────────────────────────

# Root account must have hardware MFA
deny_root_no_hardware_mfa[msg] {
    account := input.account_summary
    account.account_mfa_enabled == 0
    msg := "Root account MFA is not enabled — required by §164.312(d)"
}

# Cognito user pools with PHI access must enforce MFA
deny_cognito_no_mfa[msg] {
    pool := input.cognito_user_pools[_]
    pool.accesses_phi == true
    pool.mfa_configuration != "ON"
    msg := sprintf("Cognito user pool '%v' accesses PHI but MFA is not enforced — violates §164.312(d)", [pool.name])
}

# ─────────────────────────────────────────────────────────────────────────────
# §164.312(e)(1) — Transmission Security
# ─────────────────────────────────────────────────────────────────────────────

# ACM certificates expiring within 30 days
deny_expiring_certs[msg] {
    cert := input.acm_certificates[_]
    cert.days_until_expiry < 30
    msg := sprintf("ACM certificate '%v' expires in %v days — violates §164.312(e)(1) transmission security", [cert.domain_name, cert.days_until_expiry])
}

# ELB/ALB listeners must use HTTPS
deny_http_listeners[msg] {
    listener := input.elb_listeners[_]
    listener.protocol == "HTTP"
    not listener.redirect_to_https
    msg := sprintf("Load balancer listener '%v' is HTTP without redirect — violates §164.312(e)(1)", [listener.arn])
}

# S3 buckets must enforce TLS (secure transport policy)
deny_s3_no_tls[msg] {
    bucket := input.s3_buckets[_]
    bucket.contains_phi == true
    not bucket.tls_enforced
    msg := sprintf("S3 bucket '%v' does not enforce TLS — violates §164.312(e)(1)", [bucket.name])
}

# ─────────────────────────────────────────────────────────────────────────────
# Aggregate violations
# ─────────────────────────────────────────────────────────────────────────────

violations[msg] {
    msg := deny_shared_accounts[_]
}

violations[msg] {
    msg := deny_mfa_missing[_]
}

violations[msg] {
    msg := deny_root_access_keys[_]
}

violations[msg] {
    msg := deny_cloudtrail[_]
}

violations[msg] {
    msg := deny_cloudtrail_log_validation[_]
}

violations[msg] {
    msg := deny_short_log_retention[_]
}

violations[msg] {
    msg := deny_s3_no_versioning[_]
}

violations[msg] {
    msg := deny_s3_public_phi[_]
}

violations[msg] {
    msg := deny_rds_no_deletion_protection[_]
}

violations[msg] {
    msg := deny_root_no_hardware_mfa[_]
}

violations[msg] {
    msg := deny_cognito_no_mfa[_]
}

violations[msg] {
    msg := deny_expiring_certs[_]
}

violations[msg] {
    msg := deny_http_listeners[_]
}

violations[msg] {
    msg := deny_s3_no_tls[_]
}

allow {
    count(violations) == 0
}
