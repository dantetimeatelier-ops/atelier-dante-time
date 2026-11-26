-- Videa v galerii hodinek: položka galerie je fotografie, nebo video (MP4) s náhledovým obrázkem
ALTER TABLE product_images ADD COLUMN media TEXT NOT NULL DEFAULT 'image' CHECK (media IN ('image','video'));
ALTER TABLE product_images ADD COLUMN key_video TEXT;   -- klíč videa MP4 (u videa jsou key_large/key_small náhledové obrázky)
