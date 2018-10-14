import * as path from 'path'
import * as fs from 'fs'
import meow = require('meow')
import Conf = require('conf')
import inquirer = require('inquirer')
import RegClient = require('npm-registry-client')

// CLI

const cli = meow(
  `
  Usage:
    reserve [name]

  > You'll be asked about other things!
`,
  {},
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

  const user = config.get('user')

  if (user) {
    console.log(`Using saved user credentials...`)
  } else {
    const { token } = await inquirer.prompt<CredentialsPromptResponse>([
      {
        type: 'password',
        name: 'token',
        message: 'Please, enter your npm access token:',
      },
    ])

    config.set('user', { token })

    console.log('OK!')
  }

  try {
    const pkg = generateEmptyPackage(name)

    const res = await publish(pkg, user)
    console.log(res)

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

interface Package {
  metadata: PackageMetadata
  files: any
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
  const params = {
    metadata: pkg.metadata,
    body: pkg.files,
    auth: {
      token: credentials.token,
    },
  }

  return await new Promise<any>((resolve, reject) =>
    client.publish(npmRegistryURI, params, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    }),
  )
}

function generateEmptyPackage(name: string): Package {
  const metadata = {
    name: name,
    version: '0.0.0',
  }

  const tar = fs.createReadStream('')

  return {
    metadata,
    files: tar,
  }
}

return cacache.tmp.withTmp(npm.tmp, { tmpPrefix: 'fromDir' }, tmpDir => {
  const target = path.join(tmpDir, 'package.tgz')
  return pack
    .packDirectory(pkg, arg, target, null, true)
    .tap(c => {
      contents = c
    })
    .then(c => !npm.config.get('json') && pack.logContents(c))
    .then(() => upload(arg, pkg, false, target))
})
