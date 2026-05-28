-- Seed data for demo purposes
-- Creates 1 demo user and 3 sample assets

-- Insert demo user (password: demo123)
-- Password hash for 'demo123' using bcrypt
INSERT INTO users (id, email, password_hash, full_name, role)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo@dxaiot.com', '$2a$10$rQ3FqYvXVjQiVaJXv3h3PO7HKvqjC5L5Cp/k4pF.J3P3kP5L5N5N5', 'Demo User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert 3 sample assets
INSERT INTO assets (id, name, description, category, status, location, qr_code, ai_extracted_tags, created_by)
VALUES
  (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Dell Latitude 5520 Laptop',
    'Dell Latitude 5520 với Intel Core i7, 16GB RAM, 512GB SSD. Sử dụng cho phòng IT.',
    'electronics',
    'active',
    'IT Department - Floor 3, Room 301',
    'ASSET-LAPTOP-001',
    ARRAY['laptop', 'dell', 'electronics', 'it-equipment'],
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  ),
  (
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Epson L3150 Printer',
    'Máy in màu Epson L3150 EcoTank, hỗ trợ in, scan, copy. Đặt tại phòng hành chính.',
    'electronics',
    'active',
    'Administration - Floor 2, Room 205',
    'ASSET-PRINTER-002',
    ARRAY['printer', 'epson', 'office-equipment', 'electronics'],
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  ),
  (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Herman Miller Aeron Chair',
    'Ghế văn phòng ergonomic Herman Miller Aeron size B, đã sử dụng 2 năm. Tình trạng tốt.',
    'furniture',
    'active',
    'Office - Floor 4, Desk 12',
    'ASSET-CHAIR-003',
    ARRAY['furniture', 'chair', 'office', 'ergonomic'],
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  )
ON CONFLICT (qr_code) DO NOTHING;

-- Insert audit history for the created assets
INSERT INTO asset_history (asset_id, action, changed_by, changes)
SELECT
  id,
  'created',
  created_by,
  jsonb_build_object(
    'name', name,
    'category', category,
    'status', status,
    'location', location
  )
FROM assets
WHERE qr_code IN ('ASSET-LAPTOP-001', 'ASSET-PRINTER-002', 'ASSET-CHAIR-003')
ON CONFLICT DO NOTHING;

-- Verify seed data
SELECT
  'Users' as table_name,
  COUNT(*) as count
FROM users
UNION ALL
SELECT
  'Assets' as table_name,
  COUNT(*) as count
FROM assets
UNION ALL
SELECT
  'Asset History' as table_name,
  COUNT(*) as count
FROM asset_history;
