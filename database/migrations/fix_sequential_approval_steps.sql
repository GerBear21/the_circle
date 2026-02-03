-- Fix sequential approval steps: Only the first step (step_index = 1) should be 'pending'
-- All subsequent steps should be 'waiting' until the previous step is approved

-- First, update all steps that are NOT the first step (step_index > 1) 
-- and are currently 'pending' to 'waiting'
-- But only for requests that are still in 'pending' status (not yet fully approved/rejected)

UPDATE request_steps
SET status = 'waiting'
WHERE step_index > 1
  AND status = 'pending'
  AND request_id IN (
    SELECT id FROM requests WHERE status = 'pending'
  );

-- Also handle cases where step_index starts at 0
UPDATE request_steps
SET status = 'waiting'
WHERE step_index > 0
  AND status = 'pending'
  AND request_id IN (
    SELECT r.id 
    FROM requests r
    WHERE r.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM request_steps rs 
      WHERE rs.request_id = r.id 
      AND rs.step_index = 0
    )
  )
  AND step_index != (
    SELECT MIN(rs2.step_index) 
    FROM request_steps rs2 
    WHERE rs2.request_id = request_steps.request_id
  );
