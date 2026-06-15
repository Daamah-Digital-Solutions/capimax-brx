
-- Restrict realtime.messages so users can only receive broadcasts on topics they own.
-- Topic convention: topic must equal the authenticated user's UUID for private channels.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own topic" ON realtime.messages;
CREATE POLICY "Authenticated users can read own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated users can broadcast own topic" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = (SELECT auth.uid()::text)
);
