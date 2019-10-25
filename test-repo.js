const debug = require('debug')('cypress-test-example-repos')
const shell = require('shelljs')
const execa = require('execa')
const { existsSync } = require('fs')
const { join } = require('path')
const { terminalBanner } = require('terminal-banner')

debug('loading @cypress/commit-message-install')
const {
  getJsonFromGit,
  npmInstall
} = require('@cypress/commit-message-install')
const is = require('check-more-types')
const parseGitHubRepoUrl = require('parse-github-repo-url')
const fs = require('fs')
const os = require('os')

shell.set('-v') // verbose
shell.set('-e') // any error is fatal

/*
  Example: test repository cypress-io/foo-test
    node ./test-repo.js --repo foo-test
*/

const cliArguments = process.argv.slice(2)

const args = require('minimist')(cliArguments, {
  alias: {
    repo: 'r',
    command: 'c'
  },
  string: ['repo', 'command'],
  number: ['chunk', 'total-chunks'],
  default: {
    command: 'test:ci'
  }
})

if (!args.repo) {
  throw new Error('Missing repo name')
}

const hasOwnerAndName = (name) => name.split('/').length === 2

const formRepoUrl = (name) => {
  if (is.url(name)) {
    return name
  }
  if (hasOwnerAndName(name)) {
    return `https://github.com/${name}.git`
  } else {
    return `https://github.com/cypress-io/${name}.git`
  }
}

const nameFromUrl = (url) => parseGitHubRepoUrl(url)[1]

const url = formRepoUrl(args.repo)
console.log('testing url', url)
console.log('using command', args.command)

const hasChunks = () =>
  typeof args.chunk === 'number' && typeof args['total-chunks'] === 'number'

if (hasChunks()) {
  console.log('chunk %d of %d', args.chunk, args['total-chunks'])
} else {
  console.log('no chunking')
}

const repoName = nameFromUrl(url)
const tmpDir = os.tmpdir()
const localFolder = fs.mkdtempSync(join(tmpDir, repoName))
console.log('local folder', localFolder)

const execOptions = { stdio: 'inherit', shell: true }

if (existsSync(args.repo)) {
  shell.rm('-rf', args.repo)
}
// now see if the commit message tells us a specific branch to test
getJsonFromGit()
.then((json) => {
  // we need this tool, so save its path right now
  // const cmi = resolve(join('node_modules', '.bin', 'commit-message-install'))

  // need to clone entire repo so we get all branches
  // because we might be testing in a separate branch
  execa.sync(`git clone ${url} ${localFolder}`, execOptions)

  console.log('cloned into folder %s', localFolder)
  shell.cd(localFolder)

  const branch = json && json.branch

  if (branch) {
    console.log('commit message specifies branch to test', branch)
    console.log('trying to switch to remote branch', branch)
    const cmd = `git checkout ${branch}`
    try {
      execa.sync(cmd, execOptions)
    } catch (e) {
      console.error('Caught error trying to do', cmd)
      console.error(e.message)
      console.error('assuming we can work in the default branch')
    }
  } else {
    console.log('there is no JSON / version in the commit message')
  }

  // this could be dangerous if the subject message is very very long
  // TODO pipe output straight to STDOUT instead
  debug('git log -1')
  execa.sync('git log -1', execOptions)

  debug('removing .git folder')
  shell.rm('-rf', '.git')

  try {
    terminalBanner('npm install 1st attempt')
    execa.sync('npm install', execOptions)
  } catch (e) {
    console.error('Caught an error trying to install NPM dependencies')
    console.error(e.message)
    terminalBanner('Trying npm install 2nd time')
    execa.sync('npm install', execOptions)
  }

  return npmInstall(json).then(() => {
    // show what commands are available
    debug('npm run')
    execa.sync('npm run', execOptions)

    const commandArguments = ['run', args.command]
    if (hasChunks()) {
      console.log('adding chunk parameters')
      commandArguments.push(
        '--',
        '--chunk',
        args.chunk,
        '--total-chunks',
        args['total-chunks']
      )
    }
    const cmd = 'npm'
    console.log('full test command')
    console.log(cmd, commandArguments.join(' '))

    const runAsCommand = {
      stdio: execOptions.stdio,
      shell: false
    }
    execa.sync(cmd, commandArguments, runAsCommand)
  })
})
.catch((e) => {
  console.error(e.message)
  process.exit(1)
})
