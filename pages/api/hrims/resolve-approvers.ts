import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { findEmployeeByPositionTitle, hrimsClient, HrimsEmployee } from '@/lib/hrimsClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface ResolvedApprover {
  userId: string;
  displayName: string;
  email: string;
  positionTitle: string;
  source: 'organogram_chain' | 'position_title';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, formType } = req.query;
    const user = session.user as any;
    const organizationId = user.org_id;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Requestor email is required' });
    }

    if (!formType || typeof formType !== 'string') {
      return res.status(400).json({ error: 'Form type is required (travel, hotel-booking, voucher, capex, petty-cash)' });
    }

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    // Helper: find an app_user by their email within the organization
    async function findAppUserByEmail(empEmail: string): Promise<{ id: string; display_name: string; email: string } | null> {
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select('id, display_name, email')
        .eq('organization_id', organizationId)
        .ilike('email', empEmail)
        .limit(1)
        .single();

      if (error || !data) return null;
      return data;
    }

    // Helper: find the employee assigned to a position (via current_position_id or employee_id)
    async function findEmployeeForPosition(positionId: string, employeeIdOnPosition?: string | null): Promise<HrimsEmployee | null> {
      // Primary: find employee whose current_position_id matches this position
      const { data: empByPos } = await hrimsClient
        .from('employees')
        .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
        .eq('current_position_id', positionId)
        .eq('employment_status', 'active')
        .limit(1)
        .single();

      if (empByPos) return empByPos as HrimsEmployee;

      // Fallback: use the employee_id on the position
      if (employeeIdOnPosition) {
        const { data: empById } = await hrimsClient
          .from('employees')
          .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
          .eq('id', employeeIdOnPosition)
          .eq('employment_status', 'active')
          .single();

        if (empById) return empById as HrimsEmployee;
      }

      return null;
    }

    // Helper: resolve a role by position title
    async function resolveByPositionTitle(title: string): Promise<ResolvedApprover | null> {
      const result = await findEmployeeByPositionTitle(title);
      if (!result?.employee?.email) return null;

      const appUser = await findAppUserByEmail(result.employee.email);
      if (!appUser) return null;

      return {
        userId: appUser.id,
        displayName: appUser.display_name,
        email: appUser.email,
        positionTitle: result.position.position_title,
        source: 'position_title',
      };
    }

    // Helper: build a resolved approver from an HRIMS employee
    async function buildApprover(emp: HrimsEmployee, positionTitle: string, source: 'organogram_chain' | 'position_title'): Promise<ResolvedApprover | null> {
      const appUser = await findAppUserByEmail(emp.email);
      if (!appUser) return null;

      return {
        userId: appUser.id,
        displayName: appUser.display_name,
        email: appUser.email,
        positionTitle,
        source,
      };
    }

    const approvers: Record<string, ResolvedApprover | null> = {};
    const debug: string[] = [];

    if (!hrimsClient) {
      console.error('HRIMS client not configured - missing environment variables');
      return res.status(200).json({ approvers });
    }

    debug.push(`Resolving approvers for email="${email}", formType="${formType}"`);

    if (formType === 'travel' || formType === 'hotel-booking') {
      // Find the requestor's employee and position in HRIMS (case-insensitive email match)
      const { data: requestorEmp, error: reqError } = await hrimsClient
        .from('employees')
        .select('id, first_name, last_name, email, current_position_id')
        .ilike('email', email)
        .eq('employment_status', 'active')
        .single();

      if (reqError) {
        debug.push(`FAIL: requestor lookup error: ${reqError.message} (code: ${reqError.code})`);
        console.error('Failed to find requestor in HRIMS:', email, reqError.message, reqError.code);
      }

      if (requestorEmp) {
        debug.push(`OK: Found requestor: ${requestorEmp.first_name} ${requestorEmp.last_name} (${requestorEmp.email}), position_id=${requestorEmp.current_position_id}`);
      } else {
        debug.push(`FAIL: No employee found for email="${email}"`);
        // Try a broader search to see what emails exist
        const { data: similarEmps } = await hrimsClient
          .from('employees')
          .select('email, first_name, last_name')
          .eq('employment_status', 'active')
          .limit(20);
        if (similarEmps) {
          debug.push(`Available HRIMS emails: ${similarEmps.map(e => e.email).join(', ')}`);
        }
      }

      if (requestorEmp?.current_position_id) {
        // Get the requestor's position to find parent
        const { data: requestorPos, error: posError } = await hrimsClient
          .from('organogram_positions')
          .select('id, position_title, parent_position_id')
          .eq('id', requestorEmp.current_position_id)
          .single();

        if (posError) {
          debug.push(`FAIL: requestor position lookup error: ${posError.message}`);
        }
        if (requestorPos) {
          debug.push(`OK: Requestor position: "${requestorPos.position_title}" (id=${requestorPos.id}), parent=${requestorPos.parent_position_id}`);
        } else {
          debug.push(`FAIL: No position found for id=${requestorEmp.current_position_id}`);
        }

        if (requestorPos?.parent_position_id) {
          // Line Manager = immediate parent position (requestor's HOD)
          const { data: lineManagerPos, error: lmPosError } = await hrimsClient
            .from('organogram_positions')
            .select('id, position_title, parent_position_id, employee_id')
            .eq('id', requestorPos.parent_position_id)
            .eq('is_active', true)
            .single();

          if (lmPosError) {
            debug.push(`FAIL: line manager position lookup error: ${lmPosError.message}`);
          }
          if (lineManagerPos) {
            debug.push(`OK: Line Manager position: "${lineManagerPos.position_title}" (id=${lineManagerPos.id}), employee_id=${lineManagerPos.employee_id}`);
          } else {
            debug.push(`FAIL: No active position found for parent id=${requestorPos.parent_position_id}`);
          }

          if (lineManagerPos) {
            const lmEmp = await findEmployeeForPosition(lineManagerPos.id, lineManagerPos.employee_id);
            if (lmEmp) {
              debug.push(`OK: Line Manager employee: ${lmEmp.first_name} ${lmEmp.last_name} (${lmEmp.email}), current_position_id=${lmEmp.current_position_id}`);
              const lmApprover = await buildApprover(lmEmp, lineManagerPos.position_title, 'organogram_chain');
              approvers.line_manager = lmApprover;
              if (!lmApprover) {
                debug.push(`FAIL: Line Manager employee found in HRIMS but no matching app_user for email="${lmEmp.email}"`);
              } else {
                debug.push(`OK: Line Manager resolved to app_user: ${lmApprover.displayName} (${lmApprover.userId})`);
              }
            } else {
              debug.push(`FAIL: No employee found for Line Manager position id=${lineManagerPos.id}`);
              // Check what employees have current_position_id set
              const { data: allEmps } = await hrimsClient
                .from('employees')
                .select('id, first_name, last_name, email, current_position_id')
                .eq('employment_status', 'active')
                .not('current_position_id', 'is', null);
              if (allEmps) {
                debug.push(`Employees with positions: ${allEmps.map(e => `${e.first_name} ${e.last_name} -> pos:${e.current_position_id}`).join('; ')}`);
              }
            }

            // Functional Manager = the position the Line Manager reports to (one level above LM)
            if (lineManagerPos.parent_position_id) {
              const { data: funcManagerPos } = await hrimsClient
                .from('organogram_positions')
                .select('id, position_title, employee_id')
                .eq('id', lineManagerPos.parent_position_id)
                .eq('is_active', true)
                .single();

              if (funcManagerPos) {
                debug.push(`OK: Functional Manager position: "${funcManagerPos.position_title}" (id=${funcManagerPos.id})`);
                const fmEmp = await findEmployeeForPosition(funcManagerPos.id, funcManagerPos.employee_id);
                if (fmEmp) {
                  approvers.functional_head = await buildApprover(fmEmp, funcManagerPos.position_title, 'organogram_chain');
                  debug.push(`OK: Functional Manager resolved: ${fmEmp.first_name} ${fmEmp.last_name}`);
                } else {
                  debug.push(`FAIL: No employee for Functional Manager position (vacant)`);
                }
              }
            }
          }
        }
      }

      // HRD = find by position title
      approvers.hrd = await resolveByPositionTitle('Human Resources Director');

      // CEO = find by position title
      approvers.ceo = await resolveByPositionTitle('CEO');

      // Fallback title searches for HRD
      if (!approvers.hrd) {
        approvers.hrd = await resolveByPositionTitle('HR Director');
      }
      if (!approvers.hrd) {
        approvers.hrd = await resolveByPositionTitle('Director of Human Resources');
      }

      // Fallback title searches for CEO
      if (!approvers.ceo) {
        approvers.ceo = await resolveByPositionTitle('Chief Executive Officer');
      }

    } else if (formType === 'capex') {
      // Finance Manager
      approvers.finance_manager = await resolveByPositionTitle('Finance Manager');
      if (!approvers.finance_manager) {
        approvers.finance_manager = await resolveByPositionTitle('Accountant');
      }

      // Head of Department — resolve the head of the requestor's own department.
      // Resolution order:
      //   1. departments.department_head_id (authoritative HRIMS source)
      //   2. Organogram positions tagged with department_id whose title looks like a head
      //   3. Walk up the requestor's position chain for a head-like title (skipping direct line manager)
      {
        const { data: requestorEmp } = await hrimsClient
          .from('employees')
          .select('id, first_name, last_name, email, current_position_id, department_id')
          .ilike('email', email)
          .eq('employment_status', 'active')
          .single();

        let resolved: ResolvedApprover | null = null;

        // 1. Authoritative source: the department row itself names the head
        if (requestorEmp?.department_id) {
          const { data: dept } = await hrimsClient
            .from('departments')
            .select('id, name, code, department_head_id')
            .eq('id', requestorEmp.department_id)
            .single();

          if (dept?.department_head_id && dept.department_head_id !== requestorEmp.id) {
            const { data: headEmp } = await hrimsClient
              .from('employees')
              .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
              .eq('id', dept.department_head_id)
              .eq('employment_status', 'active')
              .single();

            if (headEmp) {
              const title = headEmp.job_title || `Head of ${dept.name}`;
              resolved = await buildApprover(headEmp as HrimsEmployee, title, 'organogram_chain');
            }
          }
        }

        // 2. Department-tagged organogram position with a head-like title
        if (!resolved && requestorEmp?.department_id) {
          const { data: deptPositions } = await hrimsClient
            .from('organogram_positions')
            .select('id, position_title, employee_id, department_id, is_active, level')
            .eq('department_id', requestorEmp.department_id)
            .eq('is_active', true)
            .order('level', { ascending: true });

          if (deptPositions && deptPositions.length > 0) {
            const headCandidate = deptPositions.find(p =>
              p.id !== requestorEmp.current_position_id &&
              /head\s+of|hod|director|general\s+manager/i.test(p.position_title || '')
            ) || deptPositions.find(p =>
              p.id !== requestorEmp.current_position_id &&
              /manager|chief/i.test(p.position_title || '')
            );

            if (headCandidate) {
              const headEmp = await findEmployeeForPosition(headCandidate.id, headCandidate.employee_id);
              if (headEmp && headEmp.id !== requestorEmp.id) {
                resolved = await buildApprover(headEmp, headCandidate.position_title, 'organogram_chain');
              }
            }
          }
        }

        // 3. Walk up the organogram chain as a last resort
        if (!resolved && requestorEmp?.current_position_id) {
          let currentPosId: string | null = requestorEmp.current_position_id;
          let safety = 0;

          while (currentPosId && safety < 10 && !resolved) {
            safety++;
            const { data: pos } = await hrimsClient
              .from('organogram_positions')
              .select('id, position_title, parent_position_id, employee_id, is_active')
              .eq('id', currentPosId)
              .single();

            if (!pos) break;

            if (pos.id !== requestorEmp.current_position_id && pos.is_active) {
              const title = (pos.position_title || '').toLowerCase();
              const looksLikeHead = /head\s+of|hod|director|general\s+manager|chief/i.test(title);
              if (looksLikeHead) {
                const headEmp = await findEmployeeForPosition(pos.id, pos.employee_id);
                if (headEmp && headEmp.id !== requestorEmp.id) {
                  resolved = await buildApprover(headEmp, pos.position_title, 'organogram_chain');
                  break;
                }
              }
            }

            currentPosId = pos.parent_position_id;
          }
        }

        approvers.general_manager = resolved;
      }

      // Procurement Manager
      approvers.procurement_manager = await resolveByPositionTitle('Procurement Manager');
      if (!approvers.procurement_manager) {
        approvers.procurement_manager = await resolveByPositionTitle('Head of Procurement');
      }

      // Corporate Head of Department
      approvers.corporate_hod = await resolveByPositionTitle('Corporate Head of Department');
      if (!approvers.corporate_hod) {
        approvers.corporate_hod = await resolveByPositionTitle('Head of Department');
      }

      // Projects Manager
      approvers.projects_manager = await resolveByPositionTitle('Projects Manager');
      if (!approvers.projects_manager) {
        approvers.projects_manager = await resolveByPositionTitle('Project Manager');
      }

      // Managing Director
      approvers.managing_director = await resolveByPositionTitle('Managing Director');
      if (!approvers.managing_director) {
        approvers.managing_director = await resolveByPositionTitle('MD');
      }

      // Finance Director
      approvers.finance_director = await resolveByPositionTitle('Finance Director');
      if (!approvers.finance_director) {
        approvers.finance_director = await resolveByPositionTitle('Director of Finance');
      }

      // CEO
      approvers.ceo = await resolveByPositionTitle('CEO');
      if (!approvers.ceo) {
        approvers.ceo = await resolveByPositionTitle('Chief Executive Officer');
      }

    } else if (formType === 'voucher') {
      // Commercial Director = find by position title
      approvers.commercial_director = await resolveByPositionTitle('Commercial Director');

      // CEO = find by position title
      approvers.ceo = await resolveByPositionTitle('CEO');

      // Fallback title searches
      if (!approvers.commercial_director) {
        approvers.commercial_director = await resolveByPositionTitle('Director of Commercial');
      }
      if (!approvers.ceo) {
        approvers.ceo = await resolveByPositionTitle('Chief Executive Officer');
      }
    } else if (formType === 'petty-cash') {
      // Petty cash workflow: Department Head -> Accountant -> Finance Manager (sequential)

      // Department Head — head of the requestor's own department.
      // Resolution mirrors the capex branch: departments.department_head_id is authoritative.
      {
        const { data: requestorEmp } = await hrimsClient
          .from('employees')
          .select('id, first_name, last_name, email, current_position_id, department_id')
          .ilike('email', email)
          .eq('employment_status', 'active')
          .single();

        let resolved: ResolvedApprover | null = null;

        if (requestorEmp?.department_id) {
          const { data: dept } = await hrimsClient
            .from('departments')
            .select('id, name, code, department_head_id')
            .eq('id', requestorEmp.department_id)
            .single();

          if (dept?.department_head_id && dept.department_head_id !== requestorEmp.id) {
            const { data: headEmp } = await hrimsClient
              .from('employees')
              .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
              .eq('id', dept.department_head_id)
              .eq('employment_status', 'active')
              .single();

            if (headEmp) {
              const title = headEmp.job_title || `Head of ${dept.name}`;
              resolved = await buildApprover(headEmp as HrimsEmployee, title, 'organogram_chain');
            }
          }
        }

        // Fallback: walk up the organogram chain looking for a head-like title
        if (!resolved && requestorEmp?.current_position_id) {
          let currentPosId: string | null = requestorEmp.current_position_id;
          let safety = 0;

          while (currentPosId && safety < 10 && !resolved) {
            safety++;
            const { data: pos } = await hrimsClient
              .from('organogram_positions')
              .select('id, position_title, parent_position_id, employee_id, is_active')
              .eq('id', currentPosId)
              .single();

            if (!pos) break;

            if (pos.id !== requestorEmp.current_position_id && pos.is_active) {
              const title = (pos.position_title || '').toLowerCase();
              const looksLikeHead = /head\s+of|hod|director|general\s+manager|chief/i.test(title);
              if (looksLikeHead) {
                const headEmp = await findEmployeeForPosition(pos.id, pos.employee_id);
                if (headEmp && headEmp.id !== requestorEmp.id) {
                  resolved = await buildApprover(headEmp, pos.position_title, 'organogram_chain');
                  break;
                }
              }
            }

            currentPosId = pos.parent_position_id;
          }
        }

        approvers.department_head = resolved;
      }

      // Accountant
      approvers.accountant = await resolveByPositionTitle('Accountant');
      if (!approvers.accountant) {
        approvers.accountant = await resolveByPositionTitle('Senior Accountant');
      }
      if (!approvers.accountant) {
        approvers.accountant = await resolveByPositionTitle('Group Accountant');
      }

      // Finance Manager
      approvers.finance_manager = await resolveByPositionTitle('Finance Manager');
      if (!approvers.finance_manager) {
        approvers.finance_manager = await resolveByPositionTitle('Head of Finance');
      }
      if (!approvers.finance_manager) {
        approvers.finance_manager = await resolveByPositionTitle('Finance Director');
      }
    } else {
      return res.status(400).json({ error: 'Invalid form type. Must be: travel, hotel-booking, voucher, capex, or petty-cash' });
    }

    console.log('[resolve-approvers] Debug trace:', debug.join(' | '));
    return res.status(200).json({ approvers, _debug: debug });
  } catch (error: any) {
    console.error('HRIMS Resolve Approvers API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to resolve approvers' });
  }
}
