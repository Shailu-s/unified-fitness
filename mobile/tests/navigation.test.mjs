import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function historyElements() {
  const source = ts.createSourceFile('HistoryScreen.tsx',
    readFileSync(new URL('../src/screens/HistoryScreen.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node)) elements.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return elements;
}

function attributes(element) {
  return new Map(element.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => [attribute.name.getText(), attribute.initializer]));
}

test('History declares native sheet presentation and swipe-down dismissal', () => {
  const modal = historyElements().find((element) => element.tagName.getText() === 'Modal');
  assert.ok(modal);
  const props = attributes(modal);
  assert.equal(props.get('presentationStyle')?.text, 'pageSheet');
  assert.equal(props.has('allowSwipeDismissal'), true);
  assert.equal(props.get('allowSwipeDismissal'), undefined);
});

test('native dismissal and Done button use the same history close callback', () => {
  const elements = historyElements();
  const modal = elements.find((element) => element.tagName.getText() === 'Modal');
  assert.equal(attributes(modal).get('onRequestClose')?.expression.getText(), 'onClose');
  assert.ok(elements.some((element) => element.tagName.getText() === 'Pressable' &&
    attributes(element).get('onPress')?.expression.getText() === 'onClose'));
});
