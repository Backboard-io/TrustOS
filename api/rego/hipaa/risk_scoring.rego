package hipaa.risk_scoring

# ─────────────────────────────────────────────────────────────────────────────
# HIPAA Risk Scoring — NIST SP 800-30 inspired
# Input: { "likelihood": 1-5, "impact": 1-5 }
# ─────────────────────────────────────────────────────────────────────────────

# Composite risk score: simple multiplication (1–25)
risk_score := input.likelihood * input.impact

# Risk level bands aligned with HIPAA risk analysis guidance
risk_level := "critical" {
    risk_score >= 20
}

risk_level := "high" {
    risk_score >= 12
    risk_score < 20
}

risk_level := "medium" {
    risk_score >= 6
    risk_score < 12
}

risk_level := "low" {
    risk_score < 6
}

# Recommended action based on risk level
recommended_action := "Immediate remediation required; notify Security Officer" {
    risk_level == "critical"
}

recommended_action := "Remediate within 30 days; document in risk register" {
    risk_level == "high"
}

recommended_action := "Remediate within 90 days or document acceptance" {
    risk_level == "medium"
}

recommended_action := "Document and monitor; review at next evaluation cycle" {
    risk_level == "low"
}

# Whether this risk requires escalation to the Privacy Officer per §164.308(a)(1)
requires_escalation {
    risk_level == "critical"
}

requires_escalation {
    risk_level == "high"
}

# Breach notification trigger: critical risk + PHI involved
breach_notification_likely {
    risk_level == "critical"
    input.phi_involved == true
}
