export async function isAdmin(db,user) {
 if(user?.nickname!=='스택')return false;
 const installed=await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lab_pin_credentials'").first();
 if(!installed)return false;
 return !!await db.prepare("SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND nickname_normalized='스택'").bind(user.id).first();
}
