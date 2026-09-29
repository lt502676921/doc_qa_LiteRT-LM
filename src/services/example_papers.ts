export const EXAMPLE_PAPERS = [
  {id: 'bitcoin', title: 'Bitcoin', year: 2008, pages: 9, description: 'Start here · short document'},
  {id: 'attention', title: 'Attention Is All You Need', year: 2017, pages: 15, description: 'Architecture & numerical evidence'},
  {id: 'mapreduce', title: 'MapReduce', year: 2004, pages: 13, description: 'Failure recovery & comparisons'},
  {id: 'gfs', title: 'The Google File System', year: 2003, pages: 15, description: 'Long document & design decisions'},
  {id: 'raft', title: 'Raft', year: 2014, pages: 18, description: 'Consensus & cross-section reasoning'},
] as const;
export async function loadExamplePaper(id: string, signal?: AbortSignal): Promise<File> {
  if (!EXAMPLE_PAPERS.some(paper => paper.id === id)) throw new Error('Unknown example document.');
  const response = await fetch(`${import.meta.env.BASE_URL}examples/${id}.pdf`, {signal});
  if (!response.ok) throw new Error(`Unable to load example document (${response.status}).`);
  return new File([await response.blob()], `${id}.pdf`, {type: 'application/pdf'});
}
