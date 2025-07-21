-- Enable RLS on "profile"
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for "profile" (example: allow access to CREATE POLICY "Allow profile creation during signup" ON profiles
CREATE POLICY "Allow profile creation during signup" ON profile
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id::uuid);