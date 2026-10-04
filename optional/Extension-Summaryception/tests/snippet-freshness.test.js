import {describe,it,expect} from 'vitest';
import {installSummaryContext,makeMessage} from './test-helpers.js';
import {captureSnippetSources,recordSnippetSources,snippetFreshness} from '../src/core/snippet-freshness.js';
import {importSummaryceptionMemory} from '../src/features/memory.js';
import {getChatStore} from '../src/foundation/state.js';
import {markSummaryPrompt,isSummaryPrompt} from '../src/foundation/request-origin.js';

describe('retained summary provenance',()=>{
 it('promotions inherit stale source revisions rather than accepting corrected text silently',()=>{
  const ctx=installSummaryContext({chat:[makeMessage({mes:'Old book choice',scId:'a'})]});
  const child={text:'Old summary',sourceMessageIds:['a']};child.sourceRevisions=captureSnippetSources(child);
  ctx.chat[0].mes='Corrected book choice';
  const parent={text:'Merged old summary',sourceMessageIds:['a'],fromLayer:0};
  recordSnippetSources({layers:[[],[parent]]},[[child]]);
  expect(snippetFreshness(parent)).toBe('stale');
 });
 it('old and imported summaries without a baseline remain explicitly unverified',async()=>{
  installSummaryContext({chat:[makeMessage({mes:'Book club',scId:'a'})]});
  const old={text:'Old summary',sourceMessageIds:['a']};
  const promoted={...old,fromLayer:0};
  recordSnippetSources({layers:[[],[promoted]]},[[old]]);
  expect(snippetFreshness(promoted)).toBe('unknown');
  expect((await importSummaryceptionMemory({layers:[[old]],ghostedMessageIds:[]})).status).toBe('imported');
  expect(snippetFreshness(getChatStore().layers[0][0])).toBe('unknown');
 });
 it('hiding does not change source revisions but role/name changes do',()=>{
  const ctx=installSummaryContext({chat:[makeMessage({mes:'Book club',scId:'a'})]});
  const snippet={text:'Memory',sourceMessageIds:['a']};snippet.sourceRevisions=captureSnippetSources(snippet);
  ctx.chat[0].is_system=true;ctx.chat[0].is_hidden=true;
  expect(snippetFreshness(snippet)).toBe('current');
  ctx.chat[0].is_user=true;expect(snippetFreshness(snippet)).toBe('stale');
 });
 it('request ownership follows raw prompt identity, never a global busy flag or matching prose',()=>{
  const own=markSummaryPrompt([{role:'user',content:'Summarize this.'}]);
  own.unshift({role:'system',content:'Summarization rules'});
  expect(isSummaryPrompt(own)).toBe(true);
  expect(isSummaryPrompt([...own])).toBe(true);
  expect(isSummaryPrompt(JSON.parse(JSON.stringify(own)))).toBe(false);
  expect(isSummaryPrompt([{role:'user',content:'Foreground reply while summarizer is live'}])).toBe(false);
 });
});
