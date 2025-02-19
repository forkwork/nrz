/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/edge.ts > TAP > Edge > must match snapshot 1`] = `
@nrz/graph.Edge {
  from: '··root@1.0.0',
  type: 'prod',
  spec: 'child@^1.0.0',
  to: '··child@1.0.0'
}
`

exports[`test/edge.ts > TAP > Edge > must match snapshot 2`] = `
@nrz/graph.Edge {
  from: '··child@1.0.0',
  type: 'prod',
  spec: 'missing@latest',
  to: undefined
}
`
