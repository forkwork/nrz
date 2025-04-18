import { splitDepID } from '@nrz/dep-id/browser'
import { error } from '@nrz/error-cause'
import { type EdgeLike, type NodeLike } from '@nrz/graph'
import { asManifest } from '@nrz/types'
import {
  attributeSelectorsMap,
  filterAttributes,
} from './attribute.ts'
import {
  asAttributeNode,
  asPostcssNodeWithChildren,
  asPseudoNode,
  asTagNode,
  isSelectorNode,
  type ParserFn,
  type ParserState,
  type PostcssNode,
} from './types.ts'

export type AttrInternals = {
  attribute: string
  insensitive: boolean
  operator?: string
  value?: string
  properties: string[]
}

const removeNode = (state: ParserState, node: NodeLike) => {
  for (const edge of node.edgesIn) {
    state.partial.edges.delete(edge)
  }
  state.partial.nodes.delete(node)
}

const removeDanglingEdges = (state: ParserState) => {
  for (const edge of state.partial.edges) {
    if (!edge.to) {
      state.partial.edges.delete(edge)
    }
  }
}

/**
 * Parses the internal / nested selectors of a `:attr` selector.
 */
const parseAttrInternals = (nodes: PostcssNode[]): AttrInternals => {
  // the last part is the attribute selector
  const attributeSelector = asAttributeNode(
    asPostcssNodeWithChildren(nodes.pop()).nodes[0],
  )
  // all preppending selectors are naming nested properties
  const properties: string[] = []
  for (const selector of nodes) {
    properties.push(
      asTagNode(asPostcssNodeWithChildren(selector).nodes[0]).value,
    )
  }
  // include the attribute selector as the last part of the property lookup
  properties.push(attributeSelector.attribute)

  return {
    attribute: attributeSelector.attribute,
    insensitive: attributeSelector.insensitive || false,
    operator: attributeSelector.operator,
    value: attributeSelector.value,
    properties,
  }
}

/**
 * :attr Pseudo-Selector, allows for retrieving nodes based on nested
 * properties of the `package.json` metadata.
 */
const attr = async (state: ParserState) => {
  // Parses and retrieves the values for the nested selectors
  let internals
  try {
    internals = parseAttrInternals(
      asPostcssNodeWithChildren(state.current).nodes,
    )
  } catch (err) {
    throw error('Failed to parse :attr selector', {
      cause: err,
    })
  }

  // reuses the attribute selector logic to filter the nodes
  const comparator =
    internals.operator ?
      attributeSelectorsMap.get(internals.operator)
    : undefined
  const value = internals.value || ''
  const propertyName = internals.attribute
  const insensitive = internals.insensitive
  const prefixProperties = internals.properties
  return filterAttributes(
    state,
    comparator,
    value,
    propertyName,
    insensitive,
    prefixProperties,
  )
}
/**
 * :empty Pseudo-Selector, matches only nodes that have no children.
 */
const empty = async (state: ParserState) => {
  for (const node of state.partial.nodes) {
    if (node.edgesOut.size > 0) {
      removeNode(state, node)
    }
  }
  return state
}

/**
 * :has Pseudo-Selector, matches only nodes that have valid results
 * for its nested selector expressions.
 */
const has = async (state: ParserState) => {
  const top = asPostcssNodeWithChildren(state.current)
  const collectNodes = new Set<NodeLike>()
  const collectEdges = new Set<EdgeLike>()

  for (const node of top.nodes) {
    if (isSelectorNode(node)) {
      const nestedState = await state.walk({
        cancellable: state.cancellable,
        initial: {
          edges: new Set(state.initial.edges),
          nodes: new Set(state.initial.nodes),
        },
        current: node,
        walk: state.walk,
        collect: {
          edges: new Set(),
          nodes: new Set(),
        },
        partial: {
          edges: new Set(state.partial.edges),
          nodes: new Set(state.partial.nodes),
        },
      })
      for (const n of nestedState.collect.nodes) {
        collectNodes.add(n)
      }
      for (const e of nestedState.partial.edges) {
        collectEdges.add(e)
      }
    }
  }

  // if the nested selector did not match anything, that means
  // no current node has any matches
  if (collectNodes.size === 0) {
    state.partial.edges.clear()
    state.partial.nodes.clear()
    return state
  }

  // handles transitive dependencies
  // compareNodes collects a list of all ancestor nodes
  // from the resulting nodes of the nested selector
  const compareNodes = new Set<NodeLike>()
  const traverse = new Set(collectNodes)
  for (const node of traverse) {
    for (const edge of node.edgesIn) {
      compareNodes.add(edge.from)
      if (edge.from.edgesIn.size) {
        traverse.add(edge.from)
      }
    }
  }

  // for each node in the current list checks to see if
  // it has a node in the resulting nested state that is
  // a transitive dependency / children.
  nodesLoop: for (const node of state.partial.nodes) {
    if (node.edgesOut.size === 0 || !compareNodes.has(node)) {
      removeNode(state, node)
      continue
    }

    for (const edge of node.edgesOut.values()) {
      if (collectEdges.has(edge)) {
        continue nodesLoop
      }
    }
    removeNode(state, node)
  }

  removeDanglingEdges(state)

  return state
}

/**
 * :is Pseudo-selector, acts as a shortcut for writing more compact expressions
 * by allowing multiple nested selectors to match on the previous results.
 *
 * It also enables the loose parsing mode, skipping instead of erroring usage
 * of non-existing classes, identifiers, pseudo-classes, etc.
 */
const is = async (state: ParserState) => {
  const top = asPostcssNodeWithChildren(state.current)
  const collect = new Set()
  for (const node of top.nodes) {
    if (isSelectorNode(node)) {
      const nestedState = await state.walk({
        cancellable: state.cancellable,
        collect: {
          edges: new Set(),
          nodes: new Set(),
        },
        current: node,
        initial: state.initial,
        loose: true,
        partial: {
          nodes: new Set(state.partial.nodes),
          edges: new Set(state.partial.edges),
        },
        walk: state.walk,
      })
      for (const n of nestedState.collect.nodes) {
        collect.add(n)
      }
    }
  }
  for (const node of state.partial.nodes) {
    if (!collect.has(node)) {
      removeNode(state, node)
    }
  }
  return state
}

/**
 * :missing Pseudo-Selector, matches only
 * edges that are not linked to any node.
 */
const missing = async (state: ParserState) => {
  for (const edge of state.partial.edges) {
    if (edge.to) {
      state.partial.edges.delete(edge)
    }
  }
  state.partial.nodes.clear()
  return state
}

/**
 * :not Pseudo-class, serves to create negate expressions, anything that
 * matches selectors declared inside the `:not()` expression is going to be
 * filtered out in the final result.
 */
const not = async (state: ParserState) => {
  const top = asPostcssNodeWithChildren(state.current)
  const collect = new Set()
  for (const node of top.nodes) {
    if (isSelectorNode(node)) {
      const nestedState = await state.walk({
        cancellable: state.cancellable,
        collect: {
          edges: new Set(),
          nodes: new Set(),
        },
        current: node,
        initial: state.initial,
        partial: {
          nodes: new Set(state.partial.nodes),
          edges: new Set(state.partial.edges),
        },
        walk: state.walk,
      })
      for (const n of nestedState.collect.nodes) {
        collect.add(n)
      }
      /* c8 ignore start - should be impossible */
    } else {
      throw error('Error parsing :not() selectors', {
        wanted: { type: 'selector' },
        found: node,
      })
    }
    /* c8 ignore stop */
  }
  for (const node of state.partial.nodes) {
    if (collect.has(node)) {
      removeNode(state, node)
    }
  }
  return state
}

/**
 * :private Pseudo-Selector will only match packages that have
 * a `private: true` key set in their `package.json` metadata.
 */
const privateFn = async (state: ParserState) => {
  for (const node of state.partial.nodes) {
    if (!node.manifest || !asManifest(node.manifest).private) {
      removeNode(state, node)
    }
  }

  removeDanglingEdges(state)

  return state
}

/**
 * :root Pseudo-Element will return the project root node for the graph.
 */
const root = async (state: ParserState) => {
  const [anyNode] = state.initial.nodes.values()
  const mainImporter = anyNode?.graph.mainImporter
  if (!mainImporter) {
    throw error(':root pseudo-element works on local graphs only')
  }
  for (const edge of state.partial.edges) {
    if (edge.to !== mainImporter) {
      state.partial.edges.delete(edge)
    }
  }
  state.partial.nodes.clear()
  state.partial.nodes.add(mainImporter)
  return state
}

/**
 * :project Pseudo-Element, returns all graph importers (e.g: the
 * root node along with any configured workspace)
 */
const project = async (state: ParserState) => {
  const [anyNode] = state.initial.nodes.values()
  const importers = anyNode?.graph.importers
  if (!importers?.size) {
    throw error(':project pseudo-element works on local graphs only')
  }

  // make a list of all edges that are coming from importers
  // so that we can filter out any edges that are not direct
  // dependencies of the importers
  const importersEdgesIn = new Set<EdgeLike>()
  for (const importer of importers) {
    for (const edge of importer.edgesIn) {
      importersEdgesIn.add(edge)
    }
  }

  for (const edge of state.partial.edges) {
    if (!edge.to || !importersEdgesIn.has(edge)) {
      state.partial.edges.delete(edge)
    }
  }
  state.partial.nodes.clear()
  for (const importer of importers) {
    state.partial.nodes.add(importer)
  }
  return state
}

/**
 * :scope Pseudo-Element, returns the original scope of items
 * at the start of a given selector.
 */
const scope = async (state: ParserState) => {
  state.partial.edges.clear()
  state.partial.nodes.clear()
  for (const edge of state.initial.edges) {
    state.partial.edges.add(edge)
  }
  for (const node of state.initial.nodes) {
    state.partial.nodes.add(node)
  }
  return state
}

/**
 * :type(str) Pseudo-Element will match only nodes that are of
 * the same type as the value used
 */
const typeFn = async (state: ParserState) => {
  const type = asPostcssNodeWithChildren(state.current)
  const selector = asPostcssNodeWithChildren(type.nodes[0])
  const name = asTagNode(selector.nodes[0]).value
  for (const node of state.partial.nodes) {
    const nodeType = splitDepID(node.id)[0]
    if (nodeType !== name) {
      removeNode(state, node)
    }
  }
  return state
}

const pseudoSelectors = new Map<string, ParserFn>(
  Object.entries({
    attr,
    empty,
    has,
    is,
    // TODO: link
    missing,
    not,
    // TODO: overridden
    private: privateFn,
    project,
    root,
    scope,
    type: typeFn,
    // TODO: semver
    // TODO: outdated
  }),
)

/**
 * Parsers the `pseudo` node types.
 */
export const pseudo = async (state: ParserState) => {
  await state.cancellable()

  const curr = asPseudoNode(state.current)
  const parserFn =
    curr.value && pseudoSelectors.get(curr.value.slice(1))

  if (!parserFn) {
    if (state.loose) {
      return state
    }

    throw new Error(
      `Unsupported pseudo-class: ${state.current.value}`,
    )
  }
  return parserFn(state)
}
