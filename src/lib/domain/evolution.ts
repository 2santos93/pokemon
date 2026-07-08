export interface ChainNode {
  species: { name: string; url: string };
  evolves_to: ChainNode[];
}

export interface SpeciesRef {
  id: number;
  slug: string;
}

export function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match || match[1] === undefined) {
    throw new Error(`Cannot extract id from PokéAPI url: ${url}`);
  }
  return Number(match[1]);
}

function toRef(node: ChainNode): SpeciesRef {
  return { id: idFromUrl(node.species.url), slug: node.species.name };
}

export function flattenChain(node: ChainNode): SpeciesRef[] {
  return [toRef(node), ...node.evolves_to.flatMap(flattenChain)];
}

export function chainToStages(node: ChainNode): SpeciesRef[][] {
  const stages: SpeciesRef[][] = [];
  let current: ChainNode[] = [node];
  while (current.length > 0) {
    stages.push(current.map(toRef));
    current = current.flatMap((n) => n.evolves_to);
  }
  return stages;
}
