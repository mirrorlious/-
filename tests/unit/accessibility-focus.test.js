// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  focusFirstElement,
  getFocusableElements,
  handleArticleVocabularyNavigation,
  handleTabListNavigation,
  handleKeyboardActivation
} from '../../src/accessibility/focus.js';

const makeVisible = (element) => {
  element.getClientRects = () => [{ width: 1, height: 1 }];
  return element;
};

describe('accessibility focus utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns visible enabled controls in document order', () => {
    document.body.innerHTML = `
      <div id="dialog">
        <button id="first">First</button>
        <button id="disabled" disabled>Disabled</button>
        <input id="last" />
      </div>
    `;
    const dialog = document.querySelector('#dialog');
    makeVisible(document.querySelector('#first'));
    makeVisible(document.querySelector('#last'));

    expect(getFocusableElements(dialog).map((element) => element.id)).toEqual(['first', 'last']);
  });

  it('prefers an explicitly marked autofocus target', () => {
    document.body.innerHTML = `
      <div id="dialog" tabindex="-1">
        <button id="first">First</button>
        <button id="preferred" data-autofocus="true">Preferred</button>
      </div>
    `;
    const dialog = makeVisible(document.querySelector('#dialog'));
    makeVisible(document.querySelector('#first'));
    makeVisible(document.querySelector('#preferred'));

    focusFirstElement(dialog);
    expect(document.activeElement.id).toBe('preferred');
  });

  it.each(['Enter', ' '])('activates keyboard cards with %j', (key) => {
    const activate = vi.fn();
    const currentTarget = {};
    const event = {
      key,
      target: currentTarget,
      currentTarget,
      preventDefault: vi.fn()
    };

    handleKeyboardActivation(event, activate);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it('moves through dense vocabulary with arrow keys while keeping one article entry point', () => {
    document.body.innerHTML = `
      <div id="article" data-reader-vocabulary-region="true" tabindex="0">
        <span id="word-one" data-reader-vocabulary="true" tabindex="-1">one</span>
        <span id="word-two" data-reader-vocabulary="true" tabindex="-1">two</span>
      </div>
    `;
    const article = makeVisible(document.querySelector('#article'));
    makeVisible(document.querySelector('#word-one'));
    makeVisible(document.querySelector('#word-two'));
    article.focus();
    const event = { key: 'ArrowRight', currentTarget: article, preventDefault: vi.fn() };

    expect(handleArticleVocabularyNavigation(event)).toBe(true);
    expect(document.activeElement.id).toBe('word-one');
    expect(event.preventDefault).toHaveBeenCalledOnce();

    handleArticleVocabularyNavigation({ key: 'End', currentTarget: article, preventDefault: vi.fn() });
    expect(document.activeElement.id).toBe('word-two');
  });

  it('activates adjacent tabs with arrow keys', () => {
    document.body.innerHTML = `
      <div id="tabs" role="tablist">
        <button id="tab-one" role="tab">One</button>
        <button id="tab-two" role="tab">Two</button>
      </div>
    `;
    const tabList = document.querySelector('#tabs');
    const first = document.querySelector('#tab-one');
    const second = document.querySelector('#tab-two');
    const click = vi.spyOn(second, 'click');
    first.focus();

    handleTabListNavigation({ key: 'ArrowRight', currentTarget: tabList, preventDefault: vi.fn() });
    expect(document.activeElement).toBe(second);
    expect(click).toHaveBeenCalledOnce();
  });
});
