import { Plugin, PluginKey, Transaction, EditorState, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  matches: SearchMatch[];
  currentIndex: number;
}

const searchPluginKey = new PluginKey<SearchState>('search');

/**
 * 在文档中搜索所有匹配项
 */
function findMatches(doc: EditorState['doc'], query: string, caseSensitive: boolean): SearchMatch[] {
  if (!query) return [];
  
  const matches: SearchMatch[] = [];
  const searchText = caseSensitive ? query : query.toLowerCase();
  
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let index = 0;
    
    while (index < text.length) {
      const foundIndex = text.indexOf(searchText, index);
      if (foundIndex === -1) break;
      
      matches.push({
        from: pos + foundIndex,
        to: pos + foundIndex + query.length
      });
      
      index = foundIndex + 1;
    }
  });
  
  return matches;
}

/**
 * 创建搜索插件
 */
export function createSearchPlugin(): Plugin {
  return new Plugin({
    key: searchPluginKey,
    
    state: {
      init: () => ({
        query: '',
        caseSensitive: false,
        matches: [] as SearchMatch[],
        currentIndex: 0
      }),
      
      apply: (tr, prevState) => {
        const meta = tr.getMeta(searchPluginKey);
        
        // 如果有搜索相关的 action
        if (meta) {
          if (meta.type === 'setQuery') {
            const newQuery = meta.query;
            const matches = findMatches(tr.doc, newQuery, prevState.caseSensitive);
            return {
              query: newQuery,
              caseSensitive: prevState.caseSensitive,
              matches,
              currentIndex: matches.length > 0 ? 0 : 0
            };
          }
          
          if (meta.type === 'setCaseSensitive') {
            const matches = findMatches(tr.doc, prevState.query, meta.caseSensitive);
            return {
              query: prevState.query,
              caseSensitive: meta.caseSensitive,
              matches,
              currentIndex: matches.length > 0 ? 0 : 0
            };
          }
          
          if (meta.type === 'nextMatch') {
            if (prevState.matches.length === 0) return prevState;
            const nextIndex = (prevState.currentIndex + 1) % prevState.matches.length;
            return { ...prevState, currentIndex: nextIndex };
          }
          
          if (meta.type === 'prevMatch') {
            if (prevState.matches.length === 0) return prevState;
            const prevIndex = (prevState.currentIndex - 1 + prevState.matches.length) % prevState.matches.length;
            return { ...prevState, currentIndex: prevIndex };
          }
          
          if (meta.type === 'reset') {
            return {
              query: '',
              caseSensitive: false,
              matches: [],
              currentIndex: 0
            };
          }
        }
        
        // 文档变化时重新计算匹配
        if (tr.docChanged && prevState.query) {
          const matches = findMatches(tr.doc, prevState.query, prevState.caseSensitive);
          const newCurrentIndex = Math.min(prevState.currentIndex, Math.max(0, matches.length - 1));
          return { ...prevState, matches, currentIndex: newCurrentIndex };
        }
        
        return prevState;
      }
    },
    
    props: {
      decorations: (state) => {
        const searchState = searchPluginKey.getState(state);
        if (!searchState || !searchState.query || searchState.matches.length === 0) {
          return DecorationSet.empty;
        }
        
        const decorations: Decoration[] = [];
        
        searchState.matches.forEach((match, index) => {
          const isCurrent = index === searchState.currentIndex;
          const className = isCurrent ? 'search-match-current' : 'search-match';
          
          decorations.push(
            Decoration.inline(match.from, match.to, {
              class: className
            })
          );
        });
        
        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
}

/**
 * 获取搜索插件 key
 */
export function getSearchPluginKey() {
  return searchPluginKey;
}

/**
 * 设置搜索查询
 */
export function setQuery(tr: Transaction, query: string): Transaction {
  return tr.setMeta(searchPluginKey, { type: 'setQuery', query });
}

/**
 * 设置大小写敏感
 */
export function setCaseSensitive(tr: Transaction, caseSensitive: boolean): Transaction {
  return tr.setMeta(searchPluginKey, { type: 'setCaseSensitive', caseSensitive });
}

/**
 * 下一个匹配
 */
export function nextMatch(tr: Transaction): Transaction {
  return tr.setMeta(searchPluginKey, { type: 'nextMatch' });
}

/**
 * 上一个匹配
 */
export function prevMatch(tr: Transaction): Transaction {
  return tr.setMeta(searchPluginKey, { type: 'prevMatch' });
}

/**
 * 重置搜索
 */
export function resetSearch(tr: Transaction): Transaction {
  return tr.setMeta(searchPluginKey, { type: 'reset' });
}

/**
 * 替换当前匹配
 */
export function replaceCurrent(view: { state: EditorState; dispatch: (tr: Transaction) => void }, replacement: string): boolean {
  const searchState = searchPluginKey.getState(view.state);
  if (!searchState || searchState.matches.length === 0) return false;
  
  const currentMatch = searchState.matches[searchState.currentIndex];
  if (!currentMatch) return false;
  
  const tr = view.state.tr.replaceWith(
    currentMatch.from,
    currentMatch.to,
    view.state.schema.text(replacement)
  );
  
  // 替换后移到下一个匹配
  tr.setMeta(searchPluginKey, { type: 'nextMatch' });
  view.dispatch(tr);
  
  return true;
}

/**
 * 替换所有匹配
 */
export function replaceAll(view: { state: EditorState; dispatch: (tr: Transaction) => void }, replacement: string): boolean {
  const searchState = searchPluginKey.getState(view.state);
  if (!searchState || searchState.matches.length === 0) return false;
  
  const tr = view.state.tr;
  const textNode = view.state.schema.text(replacement);
  
  // 从后向前替换，避免位置偏移问题
  const matches = [...searchState.matches].reverse();
  matches.forEach(match => {
    tr.replaceWith(match.from, match.to, textNode);
  });
  
  view.dispatch(tr);
  return true;
}

/**
 * 跳转到当前匹配位置
 */
export function scrollToCurrentMatch(view: { state: EditorState; dispatch: (tr: Transaction) => void }): boolean {
  const searchState = searchPluginKey.getState(view.state);
  if (!searchState || searchState.matches.length === 0) return false;
  
  const currentMatch = searchState.matches[searchState.currentIndex];
  if (!currentMatch) return false;
  
  const tr = view.state.tr;
  const $pos = view.state.doc.resolve(currentMatch.from);
  tr.setSelection(TextSelection.near($pos));
  tr.scrollIntoView();
  view.dispatch(tr);
  
  return true;
}

/**
 * 获取搜索状态
 */
export function getSearchState(state: EditorState): SearchState | null {
  return searchPluginKey.getState(state) ?? null;
}
