-- Seed departments for Rainbow Tourism Group
-- NOTE: This script will insert all departments from the RTG organizational structure

INSERT INTO departments (organization_id, name, code, description) VALUES
  -- Kitchen & Culinary
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Kitchen & Culinary', 'KITCHEN', 'Food preparation, menu planning, and kitchen operations'),
  
  -- Housekeeping
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Housekeeping', 'HK', 'Room cleaning, laundry, and facility maintenance'),
  
  -- Front Office
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Front Office', 'FO', 'Reception, reservations, guest services, and concierge'),
  
  -- Information Technology
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Information Technology', 'IT', 'IT infrastructure, systems, and technical support'),
  
  -- Sales & Marketing
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Sales & Marketing', 'SALES', 'Sales, marketing, revenue management, and promotions'),
  
  -- Human Resources
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Human Resources', 'HR', 'HR operations, recruitment, and employee relations'),
  
  -- Maintenance
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Maintenance', 'MAINT', 'Property maintenance and repairs'),
  
  -- Customer Service
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Customer Service', 'CS', 'Customer support and client relations'),
  
  -- Finance & Accounting
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Finance & Accounting', 'Finance', 'Financial operations, accounting, and cost control'),
  
  -- Events & Conferences
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Events & Conferences', 'EVENTS', 'Manage event planning, conferences, and banquet coordination'),
  
  -- Procurement
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Procurement', 'PROC', 'Group procurement, vendor management, and enterprise'),
  
  -- Food & Beverage
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Food & Beverage', 'FB', 'Restaurants, bars, room service, and banquets'),
  
  -- Engineering & Maintenance
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Engineering & Maintenance', 'ENG', 'Building maintenance, repairs, and technical services'),
  
  -- Revenue Management
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Revenue Management', 'RM', 'Strategic pricing, business development, and revenue optimization'),
  
  -- Security
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Security', 'SEC', 'Ensures guest and property safety, access control, and emergency response'),
  
  -- Transport & Fleet
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Transport & Fleet', 'FLEET', 'Vehicle fleet management and driver coordination'),
  
  -- Guest Relations
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Guest Relations', 'GR', 'Manage guest satisfaction, feedback, and special requests'),
  
  -- Administration
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Administration', 'Admin', 'Administrative support, HR, and finance'),
  
  -- Tour Guides
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Tour Guides', 'GUIDES', 'Professional tour guides and safari specialists'),
  
  -- Executive Management
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Executive Management', 'CEO', 'CEO, CIO and executive leadership team'),
  
  -- Operations
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Operations', 'OPS', 'Tour operations, logistics, and coordination'),
  
  -- Marketing & Communications
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Marketing & Communications', 'MKTG', 'Brand management, marketing campaigns, and corporate communications'),
  
  -- Legal & Compliance
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Legal & Compliance', 'LEGAL', 'Legal affairs, contracts, and regulatory compliance'),
  
  -- Quality Assurance
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Quality Assurance', 'QA', 'Ensure service quality standards and compliance'),
  
  -- Internal Audit
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Internal Audit', 'AUDIT', 'Internal controls, risk management, and audit functions'),
  
  -- Reservations
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Reservations', 'RES', 'Booking management and guest coordination'),
  
  -- Spa & Wellness
  ((SELECT id FROM organizations WHERE name = 'Rainbow Tourism Group' LIMIT 1), 'Spa & Wellness', 'SPA', 'Spa, fitness center, pool, and recreational activities')
  
ON CONFLICT (organization_id, code) DO NOTHING;
