// Isolated Functions source prevents local emulators from loading functions/.env
// or unrelated scheduled jobs. This configuration must never be deployed.
const { mkdtemp, mkdir, writeFile, symlink, copyFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
async function main() {
  const root = path.resolve(__dirname, '..')
  const work = await mkdtemp(path.join(tmpdir(), 'clubbzr-store-demo-'))
  const runtime = path.join(work, 'runtime')
  await mkdir(runtime)
  await symlink(path.join(root, 'functions/node_modules'), path.join(runtime, 'node_modules'), 'dir')
  await writeFile(path.join(runtime, 'package.json'), JSON.stringify({ name: 'store-demo-emulator-only', private: true, main: 'index.cjs', engines: { node: '22' } }))
  const resolve = (file) => JSON.stringify(path.join(root, 'functions/lib', file))
  await writeFile(path.join(runtime, 'index.cjs'), `
process.env.ENFORCE_APP_CHECK = 'false';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.LENCO_MARKETPLACE_APPROVED = 'false';
process.env.LENCO_SECRET_KEY = 'emulator-only-no-provider-access';
const store = require(${resolve('store/callables.js')});
delete store.recoverStoreOrders;
module.exports = { ...store, ...require(${resolve('wallet/callables.js')}), recordUserActivity: require(${resolve('admin/callables.js')}).recordUserActivity };
`)
  await Promise.all(['firestore.rules', 'firestore.indexes.json'].map((file) => copyFile(path.join(root, 'firebase', file), path.join(work, file))))
  await copyFile(path.join(root, 'storage.rules'), path.join(work, 'storage.rules'))
  const config = {
    functions: { source: 'runtime' },
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    storage: { rules: 'storage.rules' },
    emulators: { functions: { host: '127.0.0.1', port: 5001 }, auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: '127.0.0.1', port: 8080 }, storage: { host: '127.0.0.1', port: 9199 }, ui: { enabled: true, port: 4000 }, singleProjectMode: true },
  }
  const configPath = path.join(work, 'firebase.json')
  await writeFile(configPath, JSON.stringify(config, null, 2))
  const child = spawn('firebase', ['emulators:start', '--only', 'functions,firestore,storage,auth', '--project', 'demo-clubbzr-store', '--config', configPath], { cwd: work, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('error', (error) => { console.error(error); process.exitCode = 1 })
  child.on('exit', (code) => { process.exitCode = code || 0 })
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
