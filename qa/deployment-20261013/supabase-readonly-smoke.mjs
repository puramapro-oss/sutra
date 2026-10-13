/* eslint-disable no-console -- CLI proof emits only status assertions. */
// Read-only live Supabase access check; never returns rows or prints credentials.
const cases=[["sutra", "profiles"], ["sutra", "videos"], ["sutra", "sutra_auto_videos"], ["sutra", "video_jobs"], ["sutra", "video_quota_counters"], ["sutra", "social_publication_journals"], ["sutra", "media_ownership"], ["sutra", "achievements"], ["sutra", "buddies"], ["sutra", "buddy_checkins"], ["sutra", "circle_members"], ["sutra", "contest_results"], ["sutra", "daily_gifts"], ["sutra", "email_sequences"], ["sutra", "gratitude_entries"], ["sutra", "lottery_draws"], ["sutra", "lottery_tickets"], ["sutra", "lottery_winners"], ["sutra", "love_circles"], ["sutra", "love_reactions"], ["sutra", "love_wall_posts"], ["sutra", "point_purchases"], ["sutra", "point_shop_items"], ["sutra", "point_transactions"], ["sutra", "pool_balances"], ["sutra", "pool_transactions"], ["sutra", "purama_points"], ["sutra", "share_conversions"], ["sutra", "social_shares"], ["sutra", "user_achievements"], ["sutra", "user_coupons"], ["sutra", "user_feedback"], ["public", "social_accounts"], ["public", "social_posts"], ["public", "social_autopilot_config"]];
const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw Error('MISSING_RUNTIME_CONFIGURATION');
const results=[];
for(const [schema,table] of cases){
 const response=await fetch(base+'/rest/v1/'+table+'?select=*&limit=0',{
  headers:{apikey:key,Authorization:'Bearer '+key,'Accept-Profile':schema},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 results.push({schema,table,status:response.status,expected:200});
 await response.arrayBuffer();
}
console.log(JSON.stringify({checks:results,paidCalls:0,rowsReturned:0}));
if(results.some(r=>r.status!==r.expected))process.exitCode=1;
