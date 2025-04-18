import t from 'tap'
import { joinDepIDTuple } from '@nrz/dep-id'
import {
  asDependency,
  type Dependency,
  type BuildIdealOptions,
  type AddImportersDependenciesMap,
} from '@nrz/graph'
import { type LoadedConfig } from '../src/config/index.ts'
import { Spec } from '@nrz/spec'

t.cleanSnapshot = s =>
  s.replace(/^(\s+)"?projectRoot"?: .*$/gm, '$1projectRoot: #')

class PackageJson {
  read() {
    return { name: 'my-project', version: '1.0.0' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class PathScurry {}

t.test('install', async t => {
  const options = {
    projectRoot: t.testdirName,
    scurry: new PathScurry(),
    packageJson: new PackageJson(),
  }
  let log = ''

  const rootDepID = joinDepIDTuple(['file', '.'])

  const { install } = await t.mockImport<
    typeof import('../src/install.ts')
  >('../src/install.ts', {
    '@nrz/graph': {
      ideal: {
        build: async ({ add }: BuildIdealOptions) => {
          log += `buildideal result adds ${add?.get(rootDepID)?.size || 0} new package(s)\n`
        },
      },
      actual: {
        load: () => {
          log += 'actual.load\n'
        },
      },
      reify: async () => {
        log += 'reify\n'
      },
    },
    '@nrz/package-json': {
      PackageJson,
    },
    'path-scurry': {
      PathScurry,
      PathScurryDarwin: PathScurry,
      PathScurryLinux: PathScurry,
      PathScurryPosix: PathScurry,
      PathScurryWin32: PathScurry,
    },
  })

  await install({
    add: new Map() as AddImportersDependenciesMap,
    conf: {
      options,
    } as unknown as LoadedConfig,
  })

  t.matchSnapshot(log, 'should call build -> actual.load -> reify')

  // adding a new dependency
  log = ''
  await install({
    add: new Map([
      [
        rootDepID,
        new Map<string, Dependency>([
          [
            'abbrev',
            asDependency({
              spec: Spec.parse('abbrev', 'latest'),
              type: 'dev',
            }),
          ],
        ]),
      ],
    ]) as AddImportersDependenciesMap,
    conf: {
      options,
    } as unknown as LoadedConfig,
  })

  t.matchSnapshot(log, 'should call build adding new dependency')
})
