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

test('photo capture creates a reviewable draft and the result screen offers explicit Save and Later', () => {
  const log = readFileSync(new URL('../src/screens/LogScreen.tsx', import.meta.url), 'utf8');
  const result = readFileSync(new URL('../src/screens/MealResultScreen.tsx', import.meta.url), 'utf8');
  assert.match(log, /const meal = addPhotoDraft\(/);
  assert.match(log, />Drafts<\/Text>/);
  assert.match(log, /snap\('gallery'\)/);
  assert.match(log, /accessibilityLabel="Add photo from camera or gallery"/);
  assert.match(result, /savePhotoDraft\(id\)/);
  assert.match(result, /pending \? 'Save now' : 'Save'/);
  assert.match(result, /isDraft \? 'Later' : 'Done'/);
  assert.match(result, /discardPhotoDraft\(id\)/);
});

test('photo review overlays macros at the bottom of the image without portion or assumption copy', () => {
  const result = readFileSync(new URL('../src/screens/MealResultScreen.tsx', import.meta.url), 'utf8');
  assert.match(result, /style=\{s\.photo\}/);
  assert.match(result, /style=\{s\.overlay\}/);
  assert.match(result, /overlay: \{[^\n]*position: 'absolute'[^\n]*bottom: 0/);
  assert.match(result, /AI estimate/);
  assert.equal(result.includes('meal.assumptions'), false);
  assert.equal(result.includes('meal.portion'), false);
  assert.equal(result.includes('meal.foods.map'), false);
  assert.match(result, />Edit<\/Text>/);
  assert.match(result, />Remove<\/Text>/);
  assert.match(result, /accessibilityLabel="Remove photo"/);
});

test('camera control opens a camera/gallery chooser with no standalone gallery button', () => {
  const log = readFileSync(new URL('../src/screens/LogScreen.tsx', import.meta.url), 'utf8');
  assert.match(log, /onPress=\{choosePhoto\}/);
  assert.match(log, /options: \['Camera', 'Gallery', 'Cancel'\]/);
  assert.match(log, /cancelButtonIndex: 2/);
  assert.match(log, /text: 'Gallery', onPress: .*snap\('gallery'\)/);
  assert.equal(log.includes('galleryButton'), false);
});

test('meal editor keeps editable macros without portion prompts or explanatory paragraphs', () => {
  const editor = readFileSync(new URL('../src/components/MealEditor.tsx', import.meta.url), 'utf8');
  assert.equal(editor.includes('Portion (optional)'), false);
  assert.equal(editor.includes('meal.assumptions'), false);
  assert.equal(editor.includes('Saved offline immediately'), false);
  assert.equal(editor.includes('Correct an estimate if needed'), false);
  for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fibre (g)']) assert.ok(editor.includes(label));
});

test('isolated photo preview retains JWT verification and separate activation from production', () => {
  const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../../supabase/functions/nutrition-photo-preview/index.ts', import.meta.url), 'utf8');
  const production = readFileSync(new URL('../../supabase/functions/nutrition-estimate/index.ts', import.meta.url), 'utf8');
  assert.match(config, /\[functions\.nutrition-photo-preview\]\s+verify_jwt = true/);
  assert.match(preview, /PHOTO_PREVIEW_API_ENABLED/);
  assert.match(production, /PHOTO_API_ENABLED/);
  assert.equal(production.includes('PHOTO_PREVIEW_API_ENABLED'), false);
});

test('native dismissal and Done button use the same history close callback', () => {
  const elements = historyElements();
  const modal = elements.find((element) => element.tagName.getText() === 'Modal');
  assert.equal(attributes(modal).get('onRequestClose')?.expression.getText(), 'onClose');
  assert.ok(elements.some((element) => element.tagName.getText() === 'Pressable' &&
    attributes(element).get('onPress')?.expression.getText() === 'onClose'));
});
