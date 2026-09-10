import bcrypt from 'bcryptjs';
import { UserDB } from './userDb.js';

// Waits a bit for migrations to finish (userDb runs async serialize)
await new Promise(r => setTimeout(r, 800));

console.log('Seeding SecureConvert DB...');

async function seed() {
  const users = [
    { email: 'ada@example.com', password: 'correct horse battery staple' },
    { email: 'lin@example.com', password: 'correct horse battery staple' },
    { email: 'grace@example.com', password: 'correct horse battery staple' }
  ];

  for (const u of users) {
    const existing = await UserDB.findByEmail(u.email);
    if (existing) {
      console.log(` - skip ${u.email} already exists`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    const created = await UserDB.createUser(u.email, hash);
    await UserDB.updateUser(u.email, { mfaSecret: 'JBSWY3DPEHPK3PXP', mfaEnabled: 1 });
    console.log(` + user ${u.email} -> id=${created.id}`);

    // 2-3 jobs per user
    await UserDB.createConversionJob(created.id, 'sample.md', 'txt', 'html', 'completed');
    await UserDB.createConversionJob(created.id, 'report.md', 'txt', 'pdf', 'completed');
    if (u.email === 'ada@example.com') {
      await UserDB.createConversionJob(created.id, 'data.json', 'json', 'csv', 'completed');
      await UserDB.createConversionJob(created.id, 'image.png', 'png', 'webp', 'completed');
    }
    await UserDB.createAuditLog(created.id, 'register_success', '127.0.0.1');
    await UserDB.createAuditLog(created.id, 'login_success', '127.0.0.1');
  }

  console.log('\nCurrent DB snapshot:');
  const db = UserDB._db;
  const all = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r)));
  console.log('users:', await all('SELECT id,email,mfaEnabled FROM users'));
  console.log('jobs (5 newest):', await all('SELECT userId,originalFilename,sourceType,targetType,createdAt FROM conversion_jobs ORDER BY createdAt DESC LIMIT 5'));
  console.log('audit (5 newest):', await all('SELECT userId,action,ipAddress FROM audit_logs ORDER BY createdAt DESC LIMIT 5'));

  // Professor demo queries from docs/db-schema.md
  console.log('\nDemo JOIN — conversions per user:');
  console.log(await all(`
    SELECT u.email, COUNT(j.id) AS conversions
    FROM users u LEFT JOIN conversion_jobs j ON j.userId = u.id
    GROUP BY u.id ORDER BY conversions DESC
  `));
  console.log('\nDemo GROUP BY targetType:');
  console.log(await all('SELECT targetType, COUNT(*) as cnt FROM conversion_jobs GROUP BY targetType'));

  console.log('\nSeed done. Try: npm run seed  (or) node --inspect seed.js');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
