#!/usr/bin/env node

import * as path from 'path'
import * as fs from 'fs'
import * as tar from 'tar'
import * as tmp from 'tmp'
import meow = require('meow')
import Conf = require('conf')
import inquirer = require('inquirer')
import RegClient = require('npm-registry-client')

// CLI

const cli = meow(
  `
  Usage:
    reserve [name]

  Options:
    -l, --login: Reset saved session

  > You'll be asked about other things!
`,
  {
    flags: {
      login: {
        alias: 'l',
        type: 'boolean',
        default: false,
      },
    },
  },
)

const npmRegistryURI = `https://registry.npmjs.org`

const client = new RegClient()
const config = new Conf<UserCredentials>()

main(cli, client, config)

// MAIN

interface UserCredentials {
  token: string
}

interface PackagePromptResponse {
  name: string
}

interface CredentialsPromptResponse {
  token: string
}

async function main(
  cli: meow.Result,
  client: any,
  config: Conf<UserCredentials>,
): Promise<void> {
  let [name] = cli.input

  if (!name) {
    const answers = await inquirer.prompt<PackagePromptResponse>([
      {
        type: 'input',
        name: 'name',
        message: 'What is the package name that you want to reserve?',
      },
    ])

    name = answers.name
  }

  const packageRegistryURI = `${npmRegistryURI}/${name}`

  const available = await checkPackageNameAvailability({
    uri: packageRegistryURI,
  })

  if (!available) {
    console.error(`It seems like "${name}" is already taken...`)
    return
  }

  let user = config.get('user')

  if (user && !cli.flags.login) {
    console.log(`Found existing credentials...`)
  } else {
    const { token } = await inquirer.prompt<CredentialsPromptResponse>([
      {
        type: 'password',
        name: 'token',
        message: 'Please, enter your npm access token:',
      },
    ])

    config.set('user', { token })

    console.log('Credentials saved...')
  }

  user = config.get('user')

  try {
    const pkg = generateEmptyPackage(name)

    await publish(pkg, user)

    console.log(`Package "${name}" successfully reserved!`)
  } catch (err) {
    console.log(err)
    console.error(`Nah nah, we bumped into a problem...`)
  }
}

interface NpmPackage {
  uri: string
}

async function checkPackageNameAvailability(pkg: NpmPackage): Promise<boolean> {
  return new Promise<boolean>(resolve =>
    client.get(pkg.uri, { timeout: 1000 }, (err, data) => {
      if (err) {
        resolve(true)
      } else {
        resolve(false)
      }
    }),
  )
}

interface File {
  path: string
  content: any
}

interface Package {
  metadata: PackageMetadata
  files: File[]
}

interface PackageMetadata {
  name: string
  version: string
  [key: string]: any
}

async function publish(
  pkg: Package,
  credentials: UserCredentials,
): Promise<any> {
  const tar = await createTarballFromFiles(pkg.files)

  const params = {
    metadata: pkg.metadata,
    body: fs.createReadStream(tar),
    auth: {
      token: credentials.token,
    },
  }

  return new Promise<any>((resolve, reject) =>
    client.publish(npmRegistryURI, params, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    }),
  )
}

// Files

async function createTarballFromFiles(files: File[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const packageTmpPath = tmp.dirSync()
    const tarTmpPath = tmp.fileSync()

    const tmpFiles = files.map(file => {
      const tmpFilePath = path.resolve(packageTmpPath.name, file.path)
      fs.writeFileSync(tmpFilePath, file.content)
      return tmpFilePath
    })

    const stream = fs.createWriteStream(tarTmpPath.name)

    stream.on('close', () => {
      resolve(tarTmpPath.name)
    })

    tar.create({ gzip: true }, tmpFiles).pipe(stream)
  })
}

// Package

function generateEmptyPackage(name: string): Package {
  const metadata = {
    name: name,
    version: '0.0.0',
  }

  const readme: File = {
    path: 'readme.md',
    content: readmeFile({ package: name }),
  }

  const packageJSON: File = {
    path: 'package.json',
    content: packageJsonFile({ package: name }),
  }

  return {
    metadata,
    files: [readme, packageJSON],
  }
}

// Files Generator

interface ReadmeOptions {
  package: string
}

const readmeFile = (options: ReadmeOptions) => `
# ${options.package}

> Hello ✌

You jealous, aye?
`

interface PackageJsonOptions {
  package: string
}

const packageJsonFile = (options: PackageJsonOptions) => `
{
  "name": "${options.package}",
  "version": "0.0.0",
  "main": "index.js",
  "license": "MIT"
}
`
