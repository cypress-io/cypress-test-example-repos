const shell = require('shelljs')
const { existsSync } = require('fs')
const { join } = require('path')
const { getJsonFromGit } = require('commit-message-install')

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
// need to clone entire repo so we get all branches
// because we might be testing in a separate branch
shell.exec(`git clone ${url}`)
shell.cd(repoName)

// now see if the commit message tells us a specific branch to test
getJsonFromGit().then((json) => {
  if (json && json.branch) {
    console.log('commit message specifies branch to test', json.branch)
    console.log('trying to switch to remote branch', json.branch)
    const cmd = `git checkout ${json.branch}`
    try {
      shell.exec(cmd)
    } catch (e) {
      console.error('Caught error trying to do', cmd)
      console.error(e.message)
      console.error('assuming we can work in the default branch')
    }
  } else {
    console.log('there is no JSON / version in the commit message')
  }

  shell.exec('git log -1')
  shell.rm('-rf', '.git')
  shell.exec('npm install')
  const cmi = join('..', 'node_modules', '.bin', 'commit-message-install')
  shell.exec(cmi)
  // show what commands are available
  shell.exec('npm run')
  shell.exec(`npm run ${testCommand}`)
})
