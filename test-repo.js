const shell = require('shelljs')
const execa = require('execa')
const { existsSync } = require('fs')
const { join } = require('path')
const { getJsonFromGit } = require('commit-message-install')

shell.set('-v') // verbose
shell.set('-e') // any error is fatal

const cliArguments = process.argv.slice(2)

const args = require('minimist')(cliArguments, {
  alias: {
    repo: 'r',
    command: 'c'
  },
  string: ['repo', 'command'],
  default: {
    command: 'test:ci'
  }
})

if (!args.repo) {
  throw new Error('Missing repo name')
}

const url = `https://github.com/cypress-io/${args.repo}.git`
console.log('testing url', url)
console.log('using command', args.command)

const execOptions = { stdio: 'inherit' }

if (existsSync(args.repo)) {
  shell.rm('-rf', args.repo)
}
// now see if the commit message tells us a specific branch to test
getJsonFromGit()
.then((json) => {
  // need to clone entire repo so we get all branches
  // because we might be testing in a separate branch
  execa.shellSync(`git clone ${url}`, execOptions)
  shell.cd(args.repo)

  const branch = json && json.branch

  if (branch) {
    console.log('commit message specifies branch to test', branch)
    console.log('trying to switch to remote branch', branch)
    const cmd = `git checkout ${branch}`
    try {
      execa.shellSync(cmd, execOptions)
    } catch (e) {
      console.error('Caught error trying to do', cmd)
      console.error(e.message)
      console.error('assuming we can work in the default branch')
    }
  } else {
    console.log('there is no JSON / version in the commit message')
  }

  execa.shellSync('git log -1', execOptions)

  shell.rm('-rf', '.git')
  execa.shellSync('npm install', execOptions)
  const cmi = join('..', 'node_modules', '.bin', 'commit-message-install')
  execa.shellSync(cmi, execOptions)
  // show what commands are available
  execa.shellSync('npm run', execOptions)

  const cmd = `npm run ${args.command}`
  // TODO pass group id somehow
  // shell.exec breaks when trying to pass as env option
  // const execOptions = {}
  // if (json && json.commit) {
  //   execOptions.env = {
  //     CYPRESS_GROUP_ID: json.commit
  //   }
  // }
  console.log('full test command')
  console.log(cmd)

  execa.shellSync(cmd, execOptions)
})
.catch((e) => {
  console.error(e.message)
  process.exit(1)
})
