-- Enable RLS on "chat"
ALTER TABLE chat ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for "chat" (example: allow access to CREATE POLICY "Allow chat creation during signup" ON profiles
CREATE POLICY "Allow chat creation during signup" ON chat
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = "userId"::uuid);