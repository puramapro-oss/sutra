const { test } = require('node:test')
const assert = require('node:assert/strict')
const { planPuramaPromotion: plan, promotionIntentKey: key, parsePromotionIntent: parse,
  PROMOTION_POLICY_VERSION: version } = require(process.env.SUTRA_PROMOTION_MODULE)
const now = Date.UTC(2026, 9, 21, 12)
const ev = (evidenceId) => ({ evidenceId, reviewedAt: now - 1000, expiresAt: now + 3600000 })
function fixture() {
  const i = { tenantId:'tenant-a', ownerId:'owner-a', accountId:'account-a', platform:'youtube',
    mode:'personal', campaignId:'campaign-a', productId:'product-demo', productRevision:'rev-1',
    claimId:'claim-a', disclosurePolicyId:'policy-evidence', locale:'fr', country:'FR',
    cta:'discover', creativeDigest:'a'.repeat(64) }
  const c = { enabled:true, now, actor:{ userId:'owner-a', tenantId:'tenant-a', active:true }, personalOwnerId:'owner-a',
    account:{ id:'account-a', tenantId:'tenant-a', ownerId:'owner-a', platform:'youtube', connected:true,
      relationship:'own-brand', enrolledForPuramaPromotion:true, affiliationDisclosed:true,
      topics:['education'], locales:['fr'], countries:['FR'] },
    product:{ ...ev('catalog-evidence'), id:'product-demo', revision:'rev-1', brand:'PURAMA', name:'Produit fictif de test',
      locale:'fr', state:'available', category:'general', topics:['education'], countries:['FR'],
      claims:[{id:'claim-a',text:'Exemple de démonstration validée.',evidenceId:'claim-proof'}],
      availabilityNotice:'Disponibilité fictive : test hors ligne uniquement.',
      destinations:[{ action:'discover',url:'https://catalog.example/produit-demo',label:'Voir la démonstration' }] },
    policy:{ ...ev('policy-evidence'), version, platform:'youtube', country:'FR', locale:'fr',
      relationship:'own-brand', organicPromotionAllowed:true, nativeLabel:'not-required',
      nativeLabelSupported:false, disclosureText:'Publicité — notre produit PURAMA. Exemple de test.' },
    mandate:{ id:'mandate-a',ownerId:'owner-a',tenantId:'tenant-a',intentKey:key(i),policyVersion:version,
      approvedAt:now-1000,expiresAt:now+3600000,revoked:false },
    creativeReview:{ ...ev('creative-evidence'),intentKey:key(i),original:true,rightsCleared:true,
      claimMatchesCreative:true,disclosureRenderingVerified:true,audience:'adults',syntheticMedia:'none' },
    cadence:{ accountId:'account-a',campaignId:'campaign-a',checkedAt:now-1000,expiresAt:now+10000,
      windowStart:now-3600000,windowEnd:now+3600000,nextAllowedAt:now-1000,directPromotions:0,maxDirectPromotions:1 } }
  return { i, c }
}
const noRemote = r => { assert.equal(r.remoteExecutionAllowed,false); assert.equal(r.publicationAllowed,false); assert.equal(r.paidSpendAllowed,false) }
function check(label, mutate, reason) {
  test(label, () => { const {i,c}=fixture(); mutate(i,c); const r=plan(i,c); noRemote(r); assert.equal(r.reason,reason); assert.equal(r.draft,undefined) })
}
test('approved draft only; preserves approved claims and visible first-line disclosure',()=>{
  const {i,c}=fixture(), r=plan(i,c)
  assert.equal(r.status,'DRAFT_READY'); noRemote(r)
  assert.ok(r.draft.caption.startsWith(c.policy.disclosureText))
  assert.ok(r.draft.caption.includes(c.product.claims[0].text))
  assert.equal(r.draft.destinationUrl,c.product.destinations[0].url)
  assert.equal(r.draft.analyticsMode,'aggregate-only-proposed')
  assert.ok(!JSON.stringify(r.draft).includes('owner-a'))
})
const mutations = [
  ['off',(i,c)=>c.enabled=false,'FEATURE_DISABLED'],
  ['missing flag',(i,c)=>delete c.enabled,'FEATURE_DISABLED'],
  ['actor revoked',(i,c)=>c.actor.active=false,'IDENTITY_OR_TENANT_MISMATCH'],
  ['wrong actor',(i,c)=>c.actor.userId='other','IDENTITY_OR_TENANT_MISMATCH'],
  ['wrong tenant',(i,c)=>c.actor.tenantId='other','IDENTITY_OR_TENANT_MISMATCH'],
  ['personal worker owner mismatch',(i,c)=>c.personalOwnerId='other','PERSONAL_OWNER_REQUIRED'],
  ['wrong account',(i,c)=>c.account.id='other','ACCOUNT_SCOPE_OR_CONNECTION'],
  ['wrong account tenant',(i,c)=>c.account.tenantId='other','ACCOUNT_SCOPE_OR_CONNECTION'],
  ['wrong account owner',(i,c)=>c.account.ownerId='other','ACCOUNT_SCOPE_OR_CONNECTION'],
  ['wrong platform',(i,c)=>c.account.platform='x','ACCOUNT_SCOPE_OR_CONNECTION'],
  ['disconnected',(i,c)=>c.account.connected=false,'ACCOUNT_SCOPE_OR_CONNECTION'],
  ['no enrollment',(i,c)=>c.account.enrolledForPuramaPromotion=false,'PROMOTION_NOT_OPTED_IN'],
  ['hidden affiliation',(i,c)=>c.account.affiliationDisclosed=false,'BRAND_RELATIONSHIP_NOT_DISCLOSED'],
  ['unknown relation',(i,c)=>c.account.relationship='secret','BRAND_RELATIONSHIP_NOT_DISCLOSED'],
  ['wrong locale',(i,c)=>c.account.locales=['en'],'ACCOUNT_AUDIENCE_SCOPE'],
  ['wrong audience country',(i,c)=>c.account.countries=['US'],'ACCOUNT_AUDIENCE_SCOPE'],
  ['missing account topics',(i,c)=>c.account.topics=null,'ACCOUNT_AUDIENCE_SCOPE'],
  ['wrong catalog product',(i,c)=>c.product.id='other','CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['changed catalog revision',(i,c)=>c.product.revision='rev-2','CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['other brand',(i,c)=>c.product.brand='OTHER','CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['catalog stale',(i,c)=>c.product.reviewedAt=now-86400001,'CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['catalog expired',(i,c)=>c.product.expiresAt=now,'CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['catalog future',(i,c)=>c.product.reviewedAt=now+1,'CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['product wrong country',(i,c)=>c.product.countries=['US'],'CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['missing catalog proof',(i,c)=>delete c.product.evidenceId,'CATALOG_NOT_CURRENT_OR_MISMATCHED'],
  ['withdrawn',(i,c)=>c.product.state='withdrawn','PRODUCT_NOT_PROMOTABLE'],
  ['unknown product state',(i,c)=>c.product.state='unlimited','PRODUCT_NOT_PROMOTABLE'],
  ['irrelevant product',(i,c)=>c.product.topics=['gardening'],'NO_EDITORIAL_FIT'],
  ['planned presented available',(i,c)=>c.product.state='planned','PLANNED_PRODUCT_NOT_AVAILABLE'],
  ['missing availability',(i,c)=>c.product.availabilityNotice='','AVAILABILITY_DISCLOSURE_REQUIRED'],
  ['claim not in catalog',(i,c)=>c.product.claims=[],'CLAIM_EVIDENCE_REQUIRED'],
  ['claim without proof',(i,c)=>delete c.product.claims[0].evidenceId,'CLAIM_EVIDENCE_REQUIRED'],
  ['ambiguous claim',(i,c)=>c.product.claims.push({...c.product.claims[0]}),'CLAIM_EVIDENCE_REQUIRED'],
  ['empty claim',(i,c)=>c.product.claims[0].text='   ','CLAIM_EVIDENCE_REQUIRED'],
  ['null claim collection',(i,c)=>c.product.claims=null,'CLAIM_EVIDENCE_REQUIRED'],
  ['no destination',(i,c)=>c.product.destinations=[],'DESTINATION_NOT_APPROVED'],
  ['ambiguous destination',(i,c)=>c.product.destinations.push({...c.product.destinations[0]}),'DESTINATION_NOT_APPROVED'],
  ['empty CTA',(i,c)=>c.product.destinations[0].label='','DESTINATION_NOT_APPROVED'],
  ['policy missing',(i,c)=>delete c.policy,'COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy stale',(i,c)=>c.policy.reviewedAt=now-7*86400000-1,'COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy changed',(i,c)=>c.policy.evidenceId='other','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy version changed',(i,c)=>c.policy.version='v2','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy wrong platform',(i,c)=>c.policy.platform='other','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy wrong locale',(i,c)=>c.policy.locale='en','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy wrong country',(i,c)=>c.policy.country='US','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['policy wrong relationship',(i,c)=>c.policy.relationship='affiliate','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['no official permission',(i,c)=>c.policy.organicPromotionAllowed=false,'COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['unknown native label',(i,c)=>c.policy.nativeLabel='unknown','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['empty disclosure',(i,c)=>c.policy.disclosureText='','COMMERCIAL_POLICY_REVIEW_REQUIRED'],
  ['native disclosure unsupported',(i,c)=>c.policy.nativeLabel='required','NATIVE_DISCLOSURE_UNSUPPORTED'],
  ['mandate missing',(i,c)=>delete c.mandate,'CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate revoked',(i,c)=>c.mandate.revoked=true,'CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate other tenant',(i,c)=>c.mandate.tenantId='other','CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate other owner',(i,c)=>c.mandate.ownerId='other','CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate other key',(i,c)=>c.mandate.intentKey='other','CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate stale',(i,c)=>c.mandate.approvedAt=now-30*86400000-1,'CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate expired',(i,c)=>c.mandate.expiresAt=now,'CAMPAIGN_MANDATE_REQUIRED'],
  ['mandate future',(i,c)=>c.mandate.approvedAt=now+1,'CAMPAIGN_MANDATE_REQUIRED'],
  ['creative review missing',(i,c)=>delete c.creativeReview,'CREATIVE_REVIEW_REQUIRED'],
  ['creative mismatch',(i,c)=>c.creativeReview.intentKey='other','CREATIVE_REVIEW_REQUIRED'],
  ['copied creative',(i,c)=>c.creativeReview.original=false,'CREATIVE_REVIEW_REQUIRED'],
  ['no media rights',(i,c)=>c.creativeReview.rightsCleared=false,'CREATIVE_REVIEW_REQUIRED'],
  ['false creative claim',(i,c)=>c.creativeReview.claimMatchesCreative=false,'CREATIVE_REVIEW_REQUIRED'],
  ['labels absent from render',(i,c)=>c.creativeReview.disclosureRenderingVerified=false,'CREATIVE_REVIEW_REQUIRED'],
  ['children audience',(i,c)=>c.creativeReview.audience='children','CREATIVE_REVIEW_REQUIRED'],
  ['AI disclosure pending',(i,c)=>c.creativeReview.syntheticMedia='review-required','CREATIVE_REVIEW_REQUIRED'],
  ['unknown AI state',(i,c)=>c.creativeReview.syntheticMedia='yes','CREATIVE_REVIEW_REQUIRED'],
  ['creative review expired',(i,c)=>c.creativeReview.expiresAt=now,'CREATIVE_REVIEW_REQUIRED'],
  ['cadence missing',(i,c)=>delete c.cadence,'CADENCE_NOT_VERIFIED'],
  ['cadence wrong account',(i,c)=>c.cadence.accountId='other','CADENCE_NOT_VERIFIED'],
  ['cadence wrong campaign',(i,c)=>c.cadence.campaignId='other','CADENCE_NOT_VERIFIED'],
  ['cadence stale',(i,c)=>c.cadence.checkedAt=now-60001,'CADENCE_NOT_VERIFIED'],
  ['cadence expired',(i,c)=>c.cadence.expiresAt=now,'CADENCE_NOT_VERIFIED'],
  ['window expired',(i,c)=>c.cadence.windowEnd=now,'CADENCE_NOT_VERIFIED'],
  ['window not started',(i,c)=>c.cadence.windowStart=now+1,'CADENCE_NOT_VERIFIED'],
  ['cadence negative',(i,c)=>c.cadence.directPromotions=-1,'CADENCE_NOT_VERIFIED'],
  ['cadence NaN',(i,c)=>c.cadence.maxDirectPromotions=NaN,'CADENCE_NOT_VERIFIED'],
  ['cadence unlimited',(i,c)=>c.cadence.maxDirectPromotions=Infinity,'CADENCE_NOT_VERIFIED'],
  ['cadence fractional',(i,c)=>c.cadence.maxDirectPromotions=1.5,'CADENCE_NOT_VERIFIED'],
  ['cadence quota reached',(i,c)=>c.cadence.directPromotions=1,'PROMOTIONAL_PRESSURE_LIMIT'],
  ['zero promotional allowance',(i,c)=>c.cadence.maxDirectPromotions=0,'PROMOTIONAL_PRESSURE_LIMIT'],
  ['next slot later',(i,c)=>c.cadence.nextAllowedAt=now+1,'PROMOTIONAL_PRESSURE_LIMIT'],
]
for(const [n,fn,r] of mutations) check(n,fn,r)
for(const category of ['health','finance','children','funded-training','unknown','anything'])
  check('specialist review: '+category,(i,c)=>c.product.category=category,'SPECIALIST_REVIEW_REQUIRED')
for(const url of ['http://catalog.example/p','https://user:pass@catalog.example/p','https://catalog.example:8443/p',
  'https://catalog.example/p?email=private','https://catalog.example/p#tracking','javascript:alert(1)',
  'https://127.0.0.1/p','https://[::1]/p','https://service.local/p','https://service.internal/p','https://localhost/p',
  'https://catalog.example/a/../b']) check('unsafe/unreviewed URL '+url,(i,c)=>c.product.destinations[0].url=url,'DESTINATION_NOT_APPROVED')
for(const state of ['in-flight','unknown','confirmed'])
  check('previous attempt '+state,(i,c)=>c.previousAttempt={intentKey:key(i),operationId:'op-1',state},
    state==='confirmed'?'REUSE_CONFIRMED_RESULT':'NO_BLIND_RETRY')
check('malformed attempt',(i,c)=>c.previousAttempt={intentKey:'wrong',operationId:'op',state:'unknown'},'ATTEMPT_SCOPE_INVALID')
for(const extra of ['password','accessToken','budget','publicationAllowed','caption','price','commission','bonus'])
  check('reject client-supplied '+extra,(i,c)=>i[extra]='injected','INVALID_INPUT')
for(const field of Object.keys(fixture().i)) {
  test('reject missing '+field,()=>{const {i,c}=fixture(); delete i[field]; const r=plan(i,c); assert.equal(r.reason,'INVALID_INPUT');noRemote(r)})
  test('key binds '+field,()=>{const {i}=fixture();const original=key(i)
    i[field]=field==='mode'?'client':field==='cta'?'waitlist':field==='country'?'DE':field==='locale'?'en'
      :field==='creativeDigest'?'b'.repeat(64):i[field]+'x'
    assert.notEqual(key(i),original)
  })
}
for(const input of [null,undefined,[],123,'x',{},true]) test('malformed input '+String(input),()=>{
  const {c}=fixture();assert.equal(plan(input,c).reason,'INVALID_INPUT');assert.throws(()=>parse(input))
})
for(const context of [null,undefined,[],{}, {enabled:true,now:NaN}]) test('malformed context '+JSON.stringify(context),()=>{
  const {i}=fixture();const r=plan(i,context);assert.equal(r.reason,'INVALID_CONTEXT');noRemote(r)
})
test('client account is never enrolled implicitly',()=>{
  const {i,c}=fixture();i.mode='client';c.account.enrolledForPuramaPromotion=false
  assert.equal(plan(i,c).reason,'PROMOTION_NOT_OPTED_IN')
})
test('client cannot reuse personal mandate',()=>{
  const {i,c}=fixture();i.mode='client';assert.equal(plan(i,c).reason,'CAMPAIGN_MANDATE_REQUIRED')
})
test('client explicit mandate and matching review permit only an offline draft',()=>{
  const {i,c}=fixture();i.mode='client';c.mandate.intentKey=key(i);c.creativeReview.intentKey=key(i)
  const r=plan(i,c);assert.equal(r.status,'DRAFT_READY');noRemote(r)
})
test('planned product: waitlist wording and destination, not sale',()=>{
  const {i,c}=fixture();i.cta='waitlist';c.product.state='planned';c.product.availabilityNotice='En préparation.'
  c.product.destinations=[{action:'waitlist',url:'https://catalog.example/liste',label:'Suivre le projet'}]
  c.mandate.intentKey=key(i);c.creativeReview.intentKey=key(i)
  const r=plan(i,c);assert.equal(r.status,'DRAFT_READY');assert.ok(r.draft.caption.includes('En préparation.'));noRemote(r)
})
for(const relation of ['affiliate','partner'])test(relation+' disclosure retained; no commission calculation',()=>{
  const {i,c}=fixture();c.account.relationship=relation;c.policy.relationship=relation
  c.policy.disclosureText='Publicité — relation '+relation+' avec PURAMA.'
  const r=plan(i,c);assert.equal(r.status,'DRAFT_READY');assert.equal(r.draft.relationship,relation);noRemote(r)
  assert.equal(r.draft.commission,undefined)
})
test('required native label remains explicit; renderer must implement it',()=>{
  const {i,c}=fixture();c.policy.nativeLabel='required';c.policy.nativeLabelSupported=true
  const r=plan(i,c);assert.equal(r.status,'DRAFT_READY');assert.equal(r.draft.nativeLabelRequired,true);noRemote(r)
})
test('planner is deterministic and does not mutate source data',()=>{
  const {i,c}=fixture();const before=JSON.stringify({i,c});const a=plan(i,c),b=plan(i,c)
  assert.deepEqual(a,b);assert.equal(JSON.stringify({i,c}),before)
})
test('1000 synthetic accounts: distinct keys, no remote permission or real accounts',()=>{
  const keys=new Set()
  for(let n=0;n<1000;n++) {
    const {i,c}=fixture();i.accountId='synthetic-'+n;c.account.id=i.accountId;c.cadence.accountId=i.accountId
    c.mandate.intentKey=key(i);c.creativeReview.intentKey=key(i)
    const r=plan(i,c);assert.equal(r.status,'DRAFT_READY');noRemote(r);keys.add(r.intentKey)
  }
  assert.equal(keys.size,1000)
})
