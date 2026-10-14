-- Sample routing query.
-- After Sarah creates a staffing proposal, insert review rows for the managers linked to that project.

INSERT INTO proposal_reviews (
    proposal_id,
    stakeholder_id,
    reviewer_user_id,
    reviewer_role,
    decision
)
SELECT
    :proposal_id,
    ps.stakeholder_id,
    ps.user_id,
    ps.stakeholder_role,
    'PENDING'
FROM project_stakeholders ps
WHERE ps.project_id = :project_id
  AND ps.approval_required = true
  AND ps.active = true
ON CONFLICT (proposal_id, stakeholder_id) DO NOTHING;
