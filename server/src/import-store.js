import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, transaction } from './db.js';

const inputPath = path.resolve(process.argv[2] || 'data/store.json');
const raw = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const stats = { users: 0, messes: 0, members: 0, cycles: 0, cycleMembers: 0, meals: 0, bazar: 0, bazarItems: 0, deposits: 0, costs: 0, notifications: 0 };

const requiredArrays = ['users','messes','members','cycles','cycleMembers','meals','bazar','deposits','costs'];
for (const key of requiredArrays) {
  if (!Array.isArray(raw[key])) throw new Error(`store.json is missing the ${key} array`);
}

const one = async (conn, sql, values) => (await conn.execute(sql, values))[0][0];

await transaction(async (conn) => {
  const userMap = new Map();
  const memberMap = new Map();
  const messMap = new Map();
  const cycleMap = new Map();

  // Every member needs a users row. Store users retain their supplied password;
  // member-only accounts get an unguessable placeholder and must reset it before login.
  const storeUsersByEmail = new Map(raw.users.map((u) => [u.email.toLowerCase(), u]));
  const people = new Map();
  for (const user of raw.users) people.set(user.email.toLowerCase(), { ...user, sourceUserId: user.id });
  for (const member of raw.members) if (!people.has(member.email.toLowerCase())) people.set(member.email.toLowerCase(), member);

  for (const person of people.values()) {
    const email = person.email.toLowerCase();
    let dbUser = await one(conn, 'SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (!dbUser) {
      const sourceUser = storeUsersByEmail.get(email);
      const password = sourceUser?.password || crypto.randomUUID();
      const hash = await bcrypt.hash(password, 12);
      const [result] = await conn.execute('INSERT INTO users(name,email,password_hash,is_active) VALUES(?,?,?,1)', [person.name, email, hash]);
      dbUser = { id: result.insertId };
      stats.users++;
    } else {
      // Keep existing passwords, but synchronize names from the import.
      await conn.execute('UPDATE users SET name=?,is_active=1 WHERE id=?', [person.name, dbUser.id]);
    }
    userMap.set(email, dbUser.id);
    if (person.sourceUserId != null) userMap.set(`source:${person.sourceUserId}`, dbUser.id);
  }

  for (const source of raw.messes) {
    const creatorId = userMap.get(`source:${source.createdBy}`);
    if (!creatorId) throw new Error(`Mess ${source.id} references unknown creator ${source.createdBy}`);
    let mess = await one(conn, 'SELECT id FROM messes WHERE name=? AND created_by=? LIMIT 1', [source.name, creatorId]);
    if (!mess) {
      const [result] = await conn.execute('INSERT INTO messes(name,address,currency,created_by,is_active) VALUES(?,?,?,?,1)', [source.name, source.address || null, source.currency || 'BDT', creatorId]);
      mess = { id: result.insertId }; stats.messes++;
    } else {
      await conn.execute('UPDATE messes SET address=?,currency=?,is_active=1 WHERE id=?', [source.address || null, source.currency || 'BDT', mess.id]);
    }
    messMap.set(source.id, mess.id);
  }

  for (const source of raw.members) {
    const messId = messMap.get(source.messId), userId = userMap.get(source.email.toLowerCase());
    if (!messId || !userId) throw new Error(`Member ${source.id} has an invalid mess or user reference`);
    let member = await one(conn, 'SELECT id FROM mess_members WHERE mess_id=? AND user_id=? LIMIT 1', [messId, userId]);
    if (!member) {
      const [result] = await conn.execute("INSERT INTO mess_members(mess_id,user_id,role,joined_at,status) VALUES(?,?,?,CURDATE(),?)", [messId, userId, source.role || 'member', source.active === false ? 'inactive' : 'active']);
      member = { id: result.insertId }; stats.members++;
    } else {
      await conn.execute('UPDATE mess_members SET role=?,status=?,left_at=NULL WHERE id=?', [source.role || 'member', source.active === false ? 'inactive' : 'active', member.id]);
    }
    memberMap.set(source.id, member.id);
  }

  for (const source of raw.cycles) {
    const messId = messMap.get(source.messId);
    let cycle = await one(conn, 'SELECT id,status FROM mess_cycles WHERE mess_id=? AND cycle_year=? AND cycle_month=? LIMIT 1', [messId, source.year, source.month]);
    if (!cycle) {
      const [result] = await conn.execute('INSERT INTO mess_cycles(mess_id,cycle_year,cycle_month,status) VALUES(?,?,?,?)', [messId, source.year, source.month, source.status || 'open']);
      cycle = { id: result.insertId }; stats.cycles++;
    }
    cycleMap.set(source.id, cycle.id);
  }

  for (const source of raw.cycleMembers) {
    const cycleId = cycleMap.get(source.cycleId), memberId = memberMap.get(source.memberId);
    await conn.execute(`INSERT INTO cycle_member_status(cycle_id,mess_member_id,is_active,opening_due)
      VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active),opening_due=VALUES(opening_due)`,
      [cycleId, memberId, source.active !== false, Number(source.openingDue || 0)]);
    stats.cycleMembers++;
  }

  for (const source of raw.meals) {
    await conn.execute(`INSERT INTO meals(cycle_id,mess_member_id,meal_date,breakfast,lunch,dinner,guest_meals)
      VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE breakfast=VALUES(breakfast),lunch=VALUES(lunch),dinner=VALUES(dinner),guest_meals=VALUES(guest_meals)`,
      [cycleMap.get(source.cycleId), memberMap.get(source.memberId), source.date, source.breakfast || 0, source.lunch || 0, source.dinner || 0, source.guest || 0]);
    stats.meals++;
  }

  for (const source of raw.bazar) {
    const cycleId = cycleMap.get(source.cycleId), memberId = memberMap.get(source.memberId);
    let entry = await one(conn, `SELECT id FROM bazar_entries WHERE cycle_id=? AND mess_member_id=? AND bazar_date=? AND COALESCE(note,'')=? AND total_amount=? LIMIT 1`, [cycleId, memberId, source.date, source.note || '', source.total]);
    if (!entry) {
      const [result] = await conn.execute('INSERT INTO bazar_entries(cycle_id,mess_member_id,bazar_date,total_amount,note) VALUES(?,?,?,?,?)', [cycleId, memberId, source.date, source.total, source.note || null]);
      entry = { id: result.insertId }; stats.bazar++;
      for (const item of source.items || []) {
        const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        await conn.execute('INSERT INTO bazar_items(bazar_entry_id,product_name,quantity,unit,unit_price,sub_total) VALUES(?,?,?,?,?,?)', [entry.id, item.product, item.quantity, item.unit || 'pcs', item.unitPrice, subtotal]);
        stats.bazarItems++;
      }
    }
  }

  for (const source of raw.deposits) {
    const values = [cycleMap.get(source.cycleId), memberMap.get(source.memberId), source.amount, source.date, source.method || 'cash'];
    const existing = await one(conn, 'SELECT id FROM deposits WHERE cycle_id=? AND mess_member_id=? AND amount=? AND deposit_date=? AND payment_method=? LIMIT 1', values);
    if (!existing) { await conn.execute('INSERT INTO deposits(cycle_id,mess_member_id,amount,deposit_date,payment_method) VALUES(?,?,?,?,?)', values); stats.deposits++; }
  }

  for (const source of raw.costs) {
    const values = [cycleMap.get(source.cycleId), source.category || 'other', source.title, source.amount, source.date, source.splitType || 'equal'];
    const existing = await one(conn, 'SELECT id FROM other_costs WHERE cycle_id=? AND category=? AND title=? AND amount=? AND cost_date=? AND split_type=? LIMIT 1', values);
    if (!existing) { await conn.execute('INSERT INTO other_costs(cycle_id,category,title,amount,cost_date,split_type) VALUES(?,?,?,?,?,?)', values); stats.costs++; }
  }

  for (const source of raw.notifications || []) {
    const userId = userMap.get(`source:${source.userId}`), messId = source.messId ? messMap.get(source.messId) : null;
    if (!userId) continue;
    const existing = await one(conn, 'SELECT id FROM notifications WHERE user_id=? AND title=? AND COALESCE(body,\'\')=? LIMIT 1', [userId, source.title, source.body || '']);
    if (!existing) { await conn.execute('INSERT INTO notifications(user_id,mess_id,title,body,type,is_read) VALUES(?,?,?,?,?,?)', [userId,messId,source.title,source.body||null,source.type||null,Boolean(source.read)]); stats.notifications++; }
  }
});

console.log(`Imported ${path.basename(inputPath)} successfully.`);
console.table(stats);
await pool.end();
