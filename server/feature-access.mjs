import catalog from './feature-catalog.cjs';
import {requireAccountSession} from './accounts.mjs';
import {isAdmin} from './admin-role.mjs';
export const features=catalog.features;
export const featureIdsForRequest=catalog.forRequest;
const installed=new WeakMap();

async function ensure(db){
 if(!installed.has(db)){
  const setup=db.batch([
   db.prepare('CREATE TABLE IF NOT EXISTS lab_feature_access (id TEXT PRIMARY KEY, logged_in INTEGER NOT NULL, guest INTEGER NOT NULL)'),
   db.prepare('CREATE TABLE IF NOT EXISTS lab_feature_access_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, token TEXT NOT NULL)'),
   db.prepare("INSERT OR IGNORE INTO lab_feature_access_meta VALUES (1,0,'')")
  ]);
  installed.set(db,setup);
  setup.catch(()=>installed.delete(db));
 }
 return installed.get(db);
}
export async function accessSettings(db){
 if(!db)return {revision:0,features:features.map(feature=>({...feature,loggedIn:true,guest:!feature.requiresAccount}))};
 await ensure(db);
 const [rules,meta]=await db.batch([
  db.prepare('SELECT id,logged_in AS loggedIn,guest FROM lab_feature_access'),
  db.prepare('SELECT revision FROM lab_feature_access_meta WHERE id=1')
 ]);
 const stored=new Map(rules.results.map(rule=>[rule.id,rule]));
 return {revision:meta.results[0].revision,features:features.map(feature=>{
  const rule=stored.get(feature.id);
  return {...feature,loggedIn:rule?!!rule.loggedIn:true,guest:!feature.requiresAccount&&(rule?!!rule.guest:true)};
 })};
}
export async function saveAccess(db,input){
 if(!Number.isSafeInteger(input.revision)||input.revision<0||!Array.isArray(input.features)||input.features.length!==features.length)
  throw Object.assign(Error('접근 조건 형식을 확인하세요.'),{status:400});
 const incoming=new Map();
 for(const rule of input.features){
  const feature=features.find(feature=>feature.id===rule?.id);
  if(!feature||incoming.has(rule.id)||typeof rule.loggedIn!=='boolean'||typeof rule.guest!=='boolean'||feature.requiresAccount&&rule.guest)
   throw Object.assign(Error('기능별 접근 조건을 확인하세요.'),{status:400});
  incoming.set(rule.id,rule);
 }
 await ensure(db);
 const token=crypto.randomUUID();
 const changes=await db.batch([
  db.prepare('UPDATE lab_feature_access_meta SET revision=revision+1,token=? WHERE id=1 AND revision=?').bind(token,input.revision),
  ...[...incoming.values()].map(rule=>db.prepare(
   'INSERT INTO lab_feature_access(id,logged_in,guest) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM lab_feature_access_meta WHERE id=1 AND token=?) ON CONFLICT(id) DO UPDATE SET logged_in=excluded.logged_in,guest=excluded.guest'
  ).bind(rule.id,Number(rule.loggedIn),Number(rule.guest),token))
 ]);
 if(!changes[0].meta.changes)throw Object.assign(Error('다른 화면에서 조건이 변경되었습니다. 다시 불러온 뒤 저장하세요.'),{status:409});
 return {...await accessSettings(db),message:'기능별 접근 조건을 저장했습니다.'};
}
export async function optionalAccount(request,env){
 try{return await requireAccountSession(request,env);}
 catch(error){if(error.status===401)return null;throw error;}
}
export async function accessDecision(request,env,ids,user=undefined){
 const settings=await accessSettings(env.DB),rules=ids.map(id=>settings.features.find(feature=>feature.id===id));
 if(rules.some(rule=>!rule))throw Object.assign(Error('기능을 확인하세요.'),{status:400});
 if(rules.every(rule=>rule.loggedIn&&rule.guest))return {allowed:true,public:true};
 const account=user===undefined?await optionalAccount(request,env):user;
 if(await isAdmin(env.DB,account))return {allowed:true};
 const denied=rules.find(rule=>!(account?rule.loggedIn:rule.guest));
 return {allowed:!denied,feature:denied?.id,label:denied?.label,
  loginRequired:!account&&!!denied?.loggedIn,status:!account&&denied?.loggedIn?401:403};
}
export async function requireFeatureAccess(request,env,ids,user=undefined){
 const decision=await accessDecision(request,env,ids,user);
 if(!decision.allowed)throw Object.assign(Error(decision.loginRequired?'로그인 후 이용할 수 있는 기능입니다.':'현재 로그인 상태에서는 이 기능을 이용할 수 없습니다.'),{status:decision.status,feature:decision.feature});
 return decision;
}
export async function publicAccess(request,env,path='/'){
 const settings=await accessSettings(env.DB),user=await optionalAccount(request,env),admin=await isAdmin(env.DB,user);
 const result=settings.features.map(feature=>({id:feature.id,label:feature.label,allowed:admin||(user?feature.loggedIn:feature.guest),loginRequired:!user&&feature.loggedIn&&!feature.guest}));
 const ids=featureIdsForRequest(path);
 return {signedIn:!!user,admin,features:result,page:ids.length?result.find(feature=>feature.id===ids[0]):null};
}
