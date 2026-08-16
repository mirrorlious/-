import { describe, expect, it } from 'vitest';
import {
  buildPortableVocabularyPreferences,
  getLemmaMatches,
  normalizeMasteredLemmas
} from '../../src/core/vocabulary.js';

describe('vocabulary domain', () => {
  it('normalizes mastered lemmas without retaining invalid or duplicate values', () => {
    expect(normalizeMasteredLemmas([' Implement ', 'control', 'IMPLEMENT', '', 'two words', null]))
      .toEqual(['control', 'implement']);
  });

  it.each(['implement', 'implements', 'implemented', 'implementing'])(
    'uses the existing lemma matcher for %s',
    (word) => {
      expect(getLemmaMatches(word, [{
        type: 'required',
        data: { implement: '实施' }
      }])).toMatchObject({ word: 'implement', type: 'required' });
    }
  );

  it('builds a versioned portable preference snapshot', () => {
    expect(buildPortableVocabularyPreferences(['Implement', 'control', 'implement'])).toEqual({
      vocabulary: {
        version: 1,
        ignoredLemmas: ['control', 'implement']
      }
    });
  });
});
