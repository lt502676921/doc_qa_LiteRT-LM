import type {OfficeContentNode} from 'officeparser';

/** Fractions of the rendered physical page, with the origin at its top left. */
export interface SourceRegion {x: number; y: number; width: number; height: number;}
interface PositionedText {start: number; end: number; bounds: NonNullable<OfficeContentNode['bounds']>;}
export interface SourceText {text: string; runs: PositionedText[];}

/** Keep character offsets aligned with the same text that is sent to the model. */
export function sourceText(node: OfficeContentNode): SourceText {
  if (['image', 'chart', 'drawing', 'embed'].includes(node.type)) return {text: '', runs: []};
  if (!node.children?.length) {
    const text = node.text || '';
    return {text, runs: text && node.bounds ? [{start: 0, end: text.length, bounds: node.bounds}] : []};
  }
  const separator = node.type === 'row' ? ' | ' :
    ['paragraph', 'heading', 'text'].includes(node.type) ? '' : '\n';
  const children = node.children.map(sourceText).filter(child => node.type === 'row' || child.text);
  const result: SourceText = {text: '', runs: []};
  children.forEach((child, index) => {
    if (index) result.text += separator;
    const offset = result.text.length;
    result.runs.push(...child.runs.map(run => ({...run, start: run.start + offset, end: run.end + offset})));
    result.text += child.text;
  });
  return result;
}

/** Use only this chunk's text runs, so a split table/paragraph does not highlight its siblings. */
export function sourceRegions(source: SourceText, start: number, end: number,
    pageWidth: number, pageHeight: number): SourceRegion[] {
  if (![pageWidth, pageHeight].every(value => Number.isFinite(value) && value > 0)) return [];
  return source.runs.filter(run => run.end > start && run.start < end).flatMap(({bounds: b}) => {
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0) return [];
    const left = Math.max(0, b.x), top = Math.max(0, b.y);
    const right = Math.min(pageWidth, b.x + b.width), bottom = Math.min(pageHeight, b.y + b.height);
    if (right <= left || bottom <= top) return [];
    return [{x: left / pageWidth, y: top / pageHeight,
      width: (right - left) / pageWidth, height: (bottom - top) / pageHeight}];
  });
}
