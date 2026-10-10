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
  const camera = readFileSync(new URL('../src/screens/CameraScreen.tsx', import.meta.url), 'utf8');
  assert.match(camera, /const meal = addPhotoDraft\(/);
  assert.match(log, />Drafts<\/Text>/);
  assert.match(camera, /pickMealPhoto\('gallery'\)/);
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

test('logging controls keep typing left, camera central and voice right', () => {
  const log = readFileSync(new URL('../src/screens/LogScreen.tsx', import.meta.url), 'utf8');
  const source = ts.createSourceFile('LogScreen.tsx', log, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let row;
  const visit = (node) => {
    if (ts.isJsxElement(node) && attributes(node.openingElement).get('style')?.expression?.getText() === 's.satRow') row = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  const buttons = row.children.filter(ts.isJsxElement).map((node) => attributes(node.openingElement));
  assert.deepEqual(buttons.map((props) => props.get('accessibilityLabel')?.text), ['Log food by typing', 'Add photo from camera or gallery', 'Log by voice']);
  assert.match(buttons[1].get('style').expression.getText(), /s\.shutter/);
});

test('voice button opens a recording screen with durable document storage and native time limit', () => {
  const log = readFileSync(new URL('../src/screens/LogScreen.tsx', import.meta.url), 'utf8');
  const voice = readFileSync(new URL('../src/screens/VoiceScreen.tsx', import.meta.url), 'utf8');
  assert.match(log, /onPress=\{\(\) => openVoice\(\)\}/);
  assert.equal(log.includes("soon('Voice')"), false);
  assert.match(voice, /directory: 'document'/);
  assert.match(voice, /record\(\{ forDuration: MAX_VOICE_SECONDS \}\)/);
  assert.ok(voice.indexOf('startVoiceRecording(recorder.uri)') < voice.indexOf('recorder.record('));
  assert.match(voice, /Meal transcript/);
  assert.match(voice, /recording \? 'Done' : 'Record'/);
  assert.equal(/\bonType\b/.test(voice), false);
  assert.equal(voice.includes('Meal · or type instead'), false);
  assert.match(voice, /reviewVoiceTranscript\(jobId, text\)/);
  assert.match(voice, /MealResultScreen[^\n]*embedded/);
  assert.match(voice, /value !== 'active'/);
});

test('camera icon opens a live camera directly with gallery on the bottom right', () => {
  const log = readFileSync(new URL('../src/screens/LogScreen.tsx', import.meta.url), 'utf8');
  const camera = readFileSync(new URL('../src/screens/CameraScreen.tsx', import.meta.url), 'utf8');
  assert.match(log, /onPress=\{openCamera\}/);
  assert.equal(log.includes('showActionSheetWithOptions'), false);
  assert.match(camera, /CameraView ref=\{camera\}/);
  assert.match(camera, /onCameraReady/);
  assert.match(camera, /controls: \{[^\n]*position: 'absolute'[^\n]*bottom: 0/);
  assert.ok(camera.indexOf('style={s.gallery}') > camera.indexOf('accessibilityLabel="Take meal photo"'));
  assert.match(camera, /photo\('gallery'\)/);
  assert.match(camera, /prepareMealPhoto\(shot\)/);
  assert.match(camera, /MealResultScreen[^\n]*embedded/);
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
