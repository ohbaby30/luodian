export type HomeIdea = {
  id: string;
  archivedAt?: string | null;
  status?: string;
};

export function isClosedIdea(idea: HomeIdea): boolean {
  return idea.status === "finalized";
}

export function groupIdeas<T extends HomeIdea>(ideas: T[]): { open: T[]; closed: T[] } {
  const visibleIdeas = ideas.filter((idea) => idea.status !== "archived" && !idea.archivedAt);
  return {
    open: visibleIdeas.filter((idea) => !isClosedIdea(idea)),
    closed: visibleIdeas.filter(isClosedIdea),
  };
}
