const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupCertificates() {
  console.log('🎓 Setting up certificates table and storage...');

  try {
    // Create the certificates table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create certificates table for storing registration certificates
        CREATE TABLE IF NOT EXISTS certificates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          certificate_number VARCHAR(20) UNIQUE NOT NULL,
          track_id UUID REFERENCES ip_tracks(id) ON DELETE CASCADE,
          wallet_address TEXT NOT NULL,
          pdf_url TEXT NOT NULL,
          stacks_tx_id TEXT,
          block_height INTEGER,
          verification_hash TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_certificates_wallet ON certificates(wallet_address);
        CREATE INDEX IF NOT EXISTS idx_certificates_track ON certificates(track_id);
        CREATE INDEX IF NOT EXISTS idx_certificates_created ON certificates(created_at DESC);

        -- Add RLS policies
        ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

        -- Allow anyone to read certificates (they have unique IDs anyway)
        CREATE POLICY "Certificates are viewable by everyone"
          ON certificates FOR SELECT
          USING (true);

        -- Allow authenticated users to insert their own certificates
        CREATE POLICY "Users can create their own certificates"
          ON certificates FOR INSERT
          WITH CHECK (wallet_address = auth.jwt() ->> 'sub');

        -- Allow users to update their own certificates
        CREATE POLICY "Users can update their own certificates"
          ON certificates FOR UPDATE
          USING (wallet_address = auth.jwt() ->> 'sub');

        -- Allow users to delete their own certificates
        CREATE POLICY "Users can delete their own certificates"
          ON certificates FOR DELETE
          USING (wallet_address = auth.jwt() ->> 'sub');
      `
    });

    if (tableError) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠️  exec_sql RPC not available, trying alternative approach...');
      
      // Check if table exists
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'certificates')
        .single();

      if (!tables) {
        console.log('📋 Creating certificates table...');
        // Table doesn't exist, we need to create it
        // Note: This might fail if we don't have CREATE permissions
        console.log('⚠️  Please run the SQL script in scripts/create-certificates-table.sql directly in your Supabase dashboard');
        console.log('   Go to: SQL Editor → New Query → Paste the SQL → Run');
      } else {
        console.log('✅ Certificates table already exists');
      }
    } else {
      console.log('✅ Certificates table created/verified');
    }

    // Create storage bucket for certificates
    const { data: buckets } = await supabase.storage.listBuckets();
    const certificateBucket = buckets?.find(b => b.name === 'certificates');

    if (!certificateBucket) {
      console.log('📦 Creating certificates storage bucket...');
      const { error: bucketError } = await supabase.storage.createBucket('certificates', {
        public: true,
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (bucketError) {
        console.error('❌ Failed to create storage bucket:', bucketError);
        console.log('   You may need to create it manually in Supabase dashboard:');
        console.log('   1. Go to Storage → New bucket');
        console.log('   2. Name: certificates');
        console.log('   3. Public bucket: YES');
        console.log('   4. Allowed MIME types: application/pdf');
        console.log('   5. Max file size: 10MB');
      } else {
        console.log('✅ Certificates storage bucket created');
      }
    } else {
      console.log('✅ Certificates storage bucket already exists');
      
      // Check if bucket is public
      if (!certificateBucket.public) {
        console.log('⚠️  Warning: Certificates bucket is not public. PDFs may not be accessible.');
        console.log('   Please make the bucket public in Supabase dashboard.');
      }
    }

    // Test the setup by checking if we can query the table
    const { data, error: queryError } = await supabase
      .from('certificates')
      .select('count')
      .limit(1);

    if (queryError) {
      console.error('⚠️  Warning: Could not query certificates table:', queryError.message);
      console.log('   You may need to run the SQL migration manually in Supabase dashboard');
    } else {
      console.log('✅ Certificates table is accessible');
    }

    // Check for any existing certificates
    const { data: existingCerts, error: countError } = await supabase
      .from('certificates')
      .select('id', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Found ${existingCerts?.length || 0} existing certificates`);
    }

    console.log('\n🎉 Certificate system setup complete!');
    console.log('\nNext steps:');
    console.log('1. If the table creation failed, run scripts/create-certificates-table.sql in Supabase SQL editor');
    console.log('2. If the storage bucket creation failed, create it manually in Supabase dashboard');
    console.log('3. Test by registering a new track - a certificate should be generated automatically');
    console.log('4. Check the Vault page (/certificates) to see generated certificates');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupCertificates();