-- Run this script in your Supabase SQL Editor to initialize the database for the Kahoot clone.

-- 1. Create quiz_state table (Only holds 1 row for the global state)
CREATE TABLE quiz_state (
  id integer PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting', -- 'waiting', 'running', 'ended'
  current_question_index integer NOT NULL DEFAULT 0,
  timer_ends_at timestamptz,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the initial state
INSERT INTO quiz_state (id, status, current_question_index) VALUES (1, 'waiting', 0);

-- 2. Create players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  out_tabbed boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

-- 3. Create questions table (Stored securely in DB)
CREATE TABLE questions (
  id serial PRIMARY KEY,
  question_text text NOT NULL,
  options jsonb NOT NULL, -- Example: ["Paris", "London", "Berlin"]
  correct_answer text NOT NULL -- Hidden from frontend clients
);

-- Insert Sample questions
INSERT INTO questions (question_text, options, correct_answer) VALUES
('What is the capital of France?', '["Paris", "London", "Berlin", "Madrid"]', 'Paris'),
('What is 2 + 2?', '["3", "4", "5", "6"]', '4'),
('Which planet is known as the Red Planet?', '["Earth", "Mars", "Jupiter", "Saturn"]', 'Mars');

-- 4. Enable Row Level Security (RLS)
ALTER TABLE quiz_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- quiz_state: Everyone can read the live state. Mutations (like Next Question) are handled by server API routes.
CREATE POLICY "Public read access for quiz_state" ON quiz_state FOR SELECT USING (true);

-- players: Everyone can read the live leaderboard.
CREATE POLICY "Public read access for players" ON players FOR SELECT USING (true);
-- Players can insert themselves when they join.
CREATE POLICY "Public insert access for players" ON players FOR INSERT WITH CHECK (true);

-- questions: We DO NOT provide public read access. 
-- The Next.js API routes will securely fetch questions (bypassing RLS with a Service Role key) 
-- and strip the `correct_answer` before sending it to the client to prevent F12 cheating.

-- 6. Enable Supabase Realtime for live updates
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_state;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
