-- Lookbook display shape for the Pinterest-style wall: auto (natural ratio), tall (2:3),
-- portrait (3:4), square (1:1) or wide (16:9). The photo is cropped around object_position.
ALTER TABLE photos ADD COLUMN shape TEXT NOT NULL DEFAULT 'auto' CHECK (shape IN ('auto', 'tall', 'portrait', 'square', 'wide'));
UPDATE photos SET shape = 'tall' WHERE r2_key IN ('static/advocate', 'static/fashion', 'static/model', 'static/red-twirl');
UPDATE photos SET shape = 'portrait' WHERE r2_key IN ('static/lecturer', 'static/reflection');
UPDATE photos SET object_position = '50% 35%' WHERE r2_key = 'static/red-twirl';
