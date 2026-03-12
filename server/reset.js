import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetAllAccounts() {
  console.log('Fetching all users from auth...');

  // Get all users from auth.users
  const { data: { users }, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  console.log(`Found ${users.length} users. Deleting...`);

  for (const user of users) {
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`Failed to delete user ${user.id}:`, delError);
    } else {
      console.log(`Deleted user: ${user.email} (${user.id})`);
    }
  }

  // Clear the custom 'users' table
  console.log('Clearing custom public.users table...');
  const { error: truncError } = await supabaseAdmin
    .from('users')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
    
  if (truncError) {
    console.error('Failed to clear users table:', truncError);
  } else {
    console.log('Cleared custom users table.');
  }

  console.log('Reset complete!');
}

resetAllAccounts();
