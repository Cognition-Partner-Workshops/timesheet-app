-- Sample synchronous booking transaction.
-- Use this in the application service after Client Manager and Delivery Manager approvals are complete.
-- No background jobs or refresh workers are required.

BEGIN;

-- 1. Lock the candidate capacity row to avoid double booking.
SELECT *
FROM employee_capacity
WHERE employee_id = :employee_id
FOR UPDATE;

-- 2. Insert confirmed allocation.
INSERT INTO allocations (
    source_key,
    employee_id,
    project_id,
    role_id,
    allocated_fte,
    start_date,
    end_date,
    allocation_status,
    source,
    raw_payload
)
VALUES (
    'BOOKING:' || :proposal_candidate_id,
    :employee_id,
    :project_id,
    :role_id,
    :allocated_fte,
    :start_date,
    :end_date,
    'CONFIRMED',
    'APP_EWA_BOOKING',
    jsonb_build_object('proposal_candidate_id', :proposal_candidate_id)
)
ON CONFLICT (source_key) DO NOTHING;

-- 3. Update proposal candidate/EWA status.
UPDATE proposal_candidates
SET
    candidate_workflow_status = 'BOOKED',
    ewa_status = 'BOOKED',
    updated_at = now()
WHERE proposal_candidate_id = :proposal_candidate_id;

-- 4. Move FTE from reserved to allocated where possible.
UPDATE employee_capacity
SET
    allocated_fte = allocated_fte + :allocated_fte,
    reserved_fte = GREATEST(reserved_fte - :allocated_fte, 0),
    available_fte = GREATEST(total_fte - (allocated_fte + :allocated_fte) - GREATEST(reserved_fte - :allocated_fte, 0), 0),
    capacity_status = CASE
        WHEN GREATEST(total_fte - (allocated_fte + :allocated_fte) - GREATEST(reserved_fte - :allocated_fte, 0), 0) = 0 THEN 'NOT_AVAILABLE'
        WHEN GREATEST(total_fte - (allocated_fte + :allocated_fte) - GREATEST(reserved_fte - :allocated_fte, 0), 0) < total_fte THEN 'PARTIALLY_AVAILABLE'
        ELSE 'AVAILABLE'
    END,
    updated_at = now()
WHERE employee_id = :employee_id;

-- 5. Mark proposal booked only when all proposal candidates are booked or closed.
UPDATE staffing_proposals
SET
    proposal_status = 'BOOKED',
    updated_at = now()
WHERE proposal_id = :proposal_id
AND NOT EXISTS (
    SELECT 1
    FROM proposal_candidates pc
    WHERE pc.proposal_id = :proposal_id
      AND COALESCE(pc.candidate_workflow_status, '') NOT IN ('BOOKED', 'REJECTED', 'CANCELLED')
);

-- 6. Audit event.
INSERT INTO audit_events (
    entity_type,
    entity_id,
    actor_user_id,
    actor_role,
    action,
    old_value,
    new_value
)
VALUES (
    'PROPOSAL_CANDIDATE',
    :proposal_candidate_id,
    :actor_user_id,
    :actor_role,
    'CANDIDATE_BOOKED',
    NULL,
    jsonb_build_object(
        'employee_id', :employee_id,
        'project_id', :project_id,
        'role_id', :role_id,
        'allocated_fte', :allocated_fte,
        'start_date', :start_date,
        'end_date', :end_date
    )
);

COMMIT;
