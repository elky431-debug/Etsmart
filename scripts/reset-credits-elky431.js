/**
 * Script pour remettre les crédits au maximum pour elky431@gmail.com
 * 
 * Usage: node scripts/reset-credits-elky431.js
 * 
 * Nécessite les variables d'environnement:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Pour les définir: export NEXT_PUBLIC_SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=...
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erreur: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resetCredits() {
  const email = 'elky431@gmail.com';
  
  console.log(`\n🔍 Recherche de l'utilisateur: ${email}...\n`);

  // 1. Trouver l'utilisateur
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month')
    .eq('email', email)
    .single();

  if (findError || !user) {
    console.error('❌ Utilisateur non trouvé:', findError?.message || 'Aucun utilisateur trouvé');
    process.exit(1);
  }

  console.log('📊 État actuel:');
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Plan: ${user.subscription_plan || 'N/A'}`);
  console.log(`   - Statut: ${user.subscription_status || 'N/A'}`);
  console.log(`   - Quota: ${user.analysis_quota || 0}`);
  console.log(`   - Utilisé: ${user.analysis_used_this_month || 0}`);
  console.log(`   - Restant: ${(user.analysis_quota || 0) - (user.analysis_used_this_month || 0)}\n`);

  // 2. Remettre les crédits utilisés à 0
  console.log('🔄 Remise des crédits à zéro...\n');

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      analysis_used_this_month: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month')
    .single();

  if (updateError) {
    console.error('❌ Erreur lors de la mise à jour:', updateError.message);
    process.exit(1);
  }

  const remainingCredits = (updatedUser.analysis_quota || 0) - (updatedUser.analysis_used_this_month || 0);

  console.log('✅ Crédits remis au maximum!\n');
  console.log('📊 Nouvel état:');
  console.log(`   - Email: ${updatedUser.email}`);
  console.log(`   - Plan: ${updatedUser.subscription_plan || 'N/A'}`);
  console.log(`   - Quota: ${updatedUser.analysis_quota || 0}`);
  console.log(`   - Utilisé: ${updatedUser.analysis_used_this_month || 0}`);
  console.log(`   - Restant: ${remainingCredits}\n`);

  if (remainingCredits > 0 || updatedUser.analysis_quota === -1) {
    console.log('🎉 Succès! Les crédits ont été remis au maximum.\n');
  } else {
    console.log('⚠️  Attention: Le quota est à 0. L\'utilisateur pourrait avoir besoin d\'un plan actif.\n');
  }
}

resetCredits().catch((error) => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});

