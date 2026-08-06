const admin = require('firebase-admin')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function readProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT
  const projectConfig = [
    path.resolve(process.cwd(), '.firebaserc'),
    path.resolve(process.cwd(), '..', '.firebaserc'),
  ].find((candidate) => fs.existsSync(candidate))
  if (!projectConfig) return null
  return JSON.parse(fs.readFileSync(projectConfig, 'utf8')).projects?.default || null
}

function readFirebaseCliTokens() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  if (!fs.existsSync(configPath)) return null
  const tokens = JSON.parse(fs.readFileSync(configPath, 'utf8')).tokens
  if (!tokens?.access_token || Number(tokens.expires_at || 0) <= Date.now()) return null
  return tokens
}

const apply = process.argv.includes('--apply')
const projectId = readProjectId()
const firebaseCliTokens = readFirebaseCliTokens()
if (!projectId) throw new Error('Unable to determine Firebase project ID.')

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId })
}
const db = admin.firestore()

function decodeFirestoreValue(value = {}) {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return value.timestampValue
  if ('stringValue' in value) return value.stringValue
  if ('referenceValue' in value) return value.referenceValue
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue)
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {})
  return undefined
}

function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  )
}

async function listDocumentsWithCliAuth(collectionName) {
  const documents = []
  let pageToken = ''
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`
    )
    url.searchParams.set('pageSize', '250')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    let response
    let lastError
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${firebaseCliTokens.access_token}` },
          signal: AbortSignal.timeout(30000),
        })
        break
      } catch (error) {
        lastError = error
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
    if (!response) throw lastError
    const payload = await response.json()
    if (!response.ok) throw new Error(`Firestore dry-run read failed: ${JSON.stringify(payload)}`)
    for (const document of payload.documents || []) {
      documents.push({
        id: document.name.split('/').pop(),
        data: decodeFirestoreFields(document.fields || {}),
      })
    }
    pageToken = payload.nextPageToken || ''
  } while (pageToken)
  return documents
}

async function runRestDryRun() {
  const users = await listDocumentsWithCliAuth('users')
  const passports = await listDocumentsWithCliAuth('creativePassports')
  const quests = await listDocumentsWithCliAuth('quests')
  const passportsById = new Map(passports.map((passport) => [passport.id, passport.data]))
  let adminsSeen = 0
  for (const user of users) {
    const passport = passportsById.get(user.id)
    const legacyPoints = Number(passport?.points || 0)
    if (user.data.role === 'admin') adminsSeen += 1
    console.log(`DRY-RUN ${user.id}: wallet=ensure xp=${legacyPoints} role=${user.data.role || 'user'}`)
  }
  for (const quest of quests) {
    const data = quest.data
    if (Array.isArray(data.eventTypes) && Array.isArray(data.rewards)) continue
    const rewardCount = Number(data.points || 0) > 0 ? 2 : 1
    console.log(`DRY-RUN quest ${quest.id}: quest.submitted -> ${rewardCount} rewards`)
  }
  console.log({
    apply: false,
    usersSeen: users.length,
    adminsSeen,
    passportsSeen: passports.length,
    questsSeen: quests.length,
  })
  console.log('No writes made. Re-run with --apply after reviewing this output and exporting Firestore.')
}

async function run() {
  let cursor = null
  let usersSeen = 0
  let adminsSeen = 0
  let passportsSeen = 0
  let questsSeen = 0

  do {
    let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(250)
    if (cursor) query = query.startAfter(cursor)
    const snapshot = await query.get()
    if (snapshot.empty) break

    for (const user of snapshot.docs) {
      usersSeen += 1
      const data = user.data()
      const passportRef = db.collection('creativePassports').doc(user.id)
      const passport = await passportRef.get()
      const legacyPoints = Number(passport.data()?.points || 0)
      if (passport.exists) passportsSeen += 1
      if (data.role === 'admin') adminsSeen += 1
      console.log(`${apply ? 'APPLY' : 'DRY-RUN'} ${user.id}: wallet=ensure xp=${legacyPoints} role=${data.role || 'user'}`)
      if (!apply) continue

      const batch = db.batch()
      batch.set(db.collection('wallets').doc(user.id), {
        userId: user.id, status: data.isActive === false ? 'frozen' : 'active',
        currency: 'POINT', version: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      const balanceRef = db.collection('balances').doc(user.id)
      const balance = await balanceRef.get()
      if (!balance.exists) batch.create(balanceRef, {
        walletId: user.id, available: 0, locked: 0, pending: 0, total: 0,
        ledgerSequence: 0, lifetimeEarned: 0, lifetimePurchased: 0,
        lifetimeSpent: 0, lifetimeTransferredIn: 0, lifetimeTransferredOut: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      if (passport.exists && passport.data()?.legacyPointsMigrated !== true) {
        batch.set(passportRef, {
          xp: legacyPoints,
          legacyPointsMigrated: true,
          points: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
      batch.set(db.collection('migrationState').doc(`economy_${user.id}`), {
        userId: user.id, legacyPoints, migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      await batch.commit()

      const authUser = await admin.auth().getUser(user.id)
      await admin.auth().setCustomUserClaims(user.id, {
        ...(authUser.customClaims || {}),
        admin: data.role === 'admin',
        curator: data.role === 'curator',
      })
    }
    cursor = snapshot.docs[snapshot.docs.length - 1].id
  } while (cursor)

  const quests = await db.collection('quests').get()
  for (const quest of quests.docs) {
    questsSeen += 1
    const data = quest.data()
    if (Array.isArray(data.eventTypes) && Array.isArray(data.rewards)) continue
    const rewards = []
    if (Number(data.points || 0) > 0) rewards.push({ type: 'points', amount: Number(data.points) })
    rewards.push({ type: 'xp', amount: Number(data.xp || data.points || 0) })
    console.log(`${apply ? 'APPLY' : 'DRY-RUN'} quest ${quest.id}: quest.submitted -> ${rewards.length} rewards`)
    if (apply) await quest.ref.set({
      eventTypes: ['quest.submitted'], criteria: { questId: quest.id },
      targetCount: 1, cadence: data.cadence || 'lifetime', rewards,
      status: data.isActive === false ? 'draft' : 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  console.log({ apply, usersSeen, adminsSeen, passportsSeen, questsSeen })
  if (!apply) console.log('No writes made. Re-run with --apply after reviewing this output and exporting Firestore.')
}

const migration = !apply && firebaseCliTokens ? runRestDryRun() : run()
migration.catch((error) => { console.error(error); process.exitCode = 1 })
