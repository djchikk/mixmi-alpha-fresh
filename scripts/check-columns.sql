SELECT column_name FROM information_schema.columns WHERE table_name = 'ip_tracks' AND column_name LIKE '%creat%' OR column_name LIKE '%upload%' ORDER BY column_name;
