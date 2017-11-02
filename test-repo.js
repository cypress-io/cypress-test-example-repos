const shell = require('shelljs')
const {existsSync} = require('fs')
const {join} = require('path')

shell.set('-v') // verbose
shell.set('-e') // any error is fatal

const repoName = process.argv[2]
if (!repoName) {
  throw new Error('Missing repo name')
}
const testCommand = process.argv[3] || 'test:ci'

const url = `https://github.com/cypress-io/${repoName}.git`
console.log('testing url', url)
console.log('using command', testCommand)

if (existsSync(repoName)) {
  shell.rm('-rf', repoName)
}
shell.exec(`git clone --depth 1 ${url}`)
shell.cd(repoName)
shell.exec('git log -1')
shell.rm('-rf', '.git')
shell.exec('npm install')
const cmi = join('..', 'node_modules', '.bin', 'commit-message-install')
shell.exec(cmi)
// show what commands are available
shell.exec('npm run')
shell.exec(`npm run ${testCommand}`)
