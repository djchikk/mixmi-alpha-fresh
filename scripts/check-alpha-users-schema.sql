-- Check the structure of alpha_users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'alpha_users'
ORDER BY ordinal_position;

-- Also show a sample row to understand the structure
SELECT *
FROM alpha_users
LIMIT 1;
