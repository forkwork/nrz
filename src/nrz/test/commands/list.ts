import {
  Graph,
  humanReadableOutput,
  jsonOutput,
  mermaidOutput,
} from '@nrz/graph'
import { PackageJson } from '@nrz/package-json'
import { Spec, type SpecOptions } from '@nrz/spec'
import { Monorepo } from '@nrz/workspaces'
import { PathScurry } from 'path-scurry'
import t, { type Test } from 'tap'
import { type LoadedConfig } from '../../src/types.ts'
import { type StartGUIOptions } from '../../src/start-gui.ts'
import {
  commandView,
  type CommandResultOptions,
} from '../fixtures/run.ts'

t.cleanSnapshot = s =>
  s.replace(
    /^(\s+)"projectRoot": ".*"/gm,
    '$1"projectRoot": "{ROOT}"',
  )

const specOptions = {
  registry: 'https://registry.npmjs.org/',
  registries: {
    npm: 'https://registry.npmjs.org/',
    custom: 'https://example.com',
  },
} satisfies SpecOptions

const sharedOptions = {
  scurry: new PathScurry(),
  packageJson: new PackageJson(),
}

const graph = new Graph({
  projectRoot: t.testdirName,
  ...specOptions,
  mainManifest: {
    name: 'my-project',
    version: '1.0.0',
    dependencies: {
      '@foo/bazz': '^1.0.0',
      bar: '^1.0.0',
      missing: '^1.0.0',
    },
  },
})
graph.placePackage(
  graph.mainImporter,
  'prod',
  Spec.parse('@foo/bazz', '^1.0.0', specOptions),
  {
    name: '@foo/bazz',
    version: '1.0.0',
  },
)
const bar = graph.placePackage(
  graph.mainImporter,
  'prod',
  Spec.parse('bar', '^1.0.0', specOptions),
  {
    name: 'bar',
    version: '1.0.0',
    dependencies: {
      baz: '^1.0.0',
    },
  },
)!
const baz = graph.placePackage(
  bar,
  'prod',
  Spec.parse('baz', 'custom:baz@^1.0.0', specOptions),
  {
    name: 'baz',
    version: '1.0.0',
    dist: {
      tarball: 'https://registry.khulnasoft.com/baz',
    },
  },
)!
graph.placePackage(
  graph.mainImporter,
  'prod',
  Spec.parse('missing', '^1.0.0', specOptions),
)
graph.placePackage(
  baz,
  'prod',
  Spec.parse('@foo/bazz', '^1.0.0', specOptions),
  {
    name: '@foo/bazz',
    version: '1.0.0',
  },
)

const mockList = async (
  t: Test,
  { graph: g = graph, ...mocks }: Record<string, any> = {},
) =>
  t.mockImport<typeof import('../../src/commands/list.ts')>(
    '../../src/commands/list.ts',
    {
      '@nrz/graph': {
        actual: {
          load: () => g,
        },
        humanReadableOutput,
        jsonOutput,
        mermaidOutput,
      },
      ...mocks,
    },
  )

const Command = await mockList(t)

const runCommand = async (
  t: Test,
  o: CommandResultOptions,
  cmd = Command,
) => commandView(t, cmd, o)

t.test('list', async t => {
  t.matchSnapshot(Command.usage().usage(), 'should have usage')

  sharedOptions.packageJson.read = () => graph.mainImporter.manifest!
  const options = {
    ...sharedOptions,
    projectRoot: t.testdirName,
  }

  t.matchSnapshot(
    await runCommand(t, {
      values: { view: 'human' },
      options,
    }),
    'should list pkgs in human readable format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      values: { view: 'json' },
      options,
    }),
    'should list pkgs in json format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      values: { view: 'mermaid' },
      options,
    }),
    'should list mermaid in json format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      positionals: ['*'],
      values: { view: 'human' },
      options,
    }),
    'should list all pkgs in human readable format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      positionals: ['*'],
      values: { view: 'json' },
      options,
    }),
    'should list all pkgs in json format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      positionals: ['*'],
      values: { view: 'mermaid' },
      options,
    }),
    'should list all pkgs in mermaid format',
  )

  t.matchSnapshot(
    await runCommand(t, {
      positionals: ['@foo/bazz', 'bar'],
      values: { view: 'human' },
      options,
    }),
    'should list all pkgs in human format',
  )

  await t.test('workspaces', async t => {
    const mainManifest = {
      name: 'my-project',
      version: '1.0.0',
    }
    const dir = t.testdir({
      'package.json': JSON.stringify(mainManifest),
      'nrz-workspaces.json': JSON.stringify({
        packages: ['./packages/*'],
      }),
      packages: {
        a: {
          'package.json': JSON.stringify({
            name: 'a',
            version: '1.0.0',
          }),
        },
        b: {
          'package.json': JSON.stringify({
            name: 'b',
            version: '1.0.0',
          }),
        },
      },
    })

    const monorepo = Monorepo.load(dir)
    const graph = new Graph({
      ...specOptions,
      projectRoot: dir,
      mainManifest,
      monorepo,
    })

    sharedOptions.packageJson.read = () => mainManifest
    const options = {
      ...sharedOptions,
      projectRoot: dir,
      monorepo,
    }

    const C = await mockList(t, { graph })

    t.matchSnapshot(
      await runCommand(
        t,
        {
          values: {
            view: 'human',
          },
          options,
        },
        C,
      ),
      'should list workspaces in human readable format',
    )

    t.matchSnapshot(
      await runCommand(
        t,
        {
          values: {
            view: 'json',
          },
          options,
        },
        C,
      ),
      'should list workspaces in json format',
    )

    t.matchSnapshot(
      await runCommand(
        t,
        {
          values: {
            workspace: ['a'],
            view: 'human',
          },
          options,
        },
        C,
      ),
      'should list single workspace',
    )
  })

  t.test('view=gui', async t => {
    sharedOptions.packageJson.read = () =>
      graph.mainImporter.manifest!
    const options = {
      ...sharedOptions,
      projectRoot: t.testdirName,
    }

    let startGUIOptions: StartGUIOptions | undefined
    const { command } = await mockList(t, {
      '../../src/start-gui.js': {
        startGUI: async (options: StartGUIOptions) => {
          startGUIOptions = options
        },
      },
    })

    await command({
      positionals: [],
      values: {
        workspace: [],
        view: 'gui',
      },
      options,
    } as unknown as LoadedConfig)

    t.matchStrict(
      startGUIOptions,
      {
        conf: { options: { projectRoot: t.testdirName } },
      },
      'should call startGUI with expected options',
    )
  })

  await t.test('colors', async t => {
    t.intercept(process, 'env', {
      value: { ...process.env, FORCE_COLOR: '1' },
    })
    const C = await mockList(t)

    t.matchSnapshot(
      await runCommand(
        t,
        {
          positionals: ['*'],
          values: {
            color: true,
            view: 'human',
          },
          options,
        },
        C,
      ),
      'should use colors when set in human readable format',
    )
  })
})
