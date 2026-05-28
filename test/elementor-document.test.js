import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyElementorDocumentOperations,
  applyWidgetSettingsPatch,
  findElementById,
  parseElementorDocument,
  summarizeElementorStructuralDiff
} from '../src/elementor-document.js';

test('parseElementorDocument: parses a document and finds nested widget context', () => {
  // Arrange
  const raw = JSON.stringify([
    {
      id: 'hero',
      elType: 'container',
      settings: { background_background: 'classic' },
      elements: [
        {
          id: 'heading',
          elType: 'widget',
          widgetType: 'heading',
          settings: { title: 'Hero Title', title_color: '#111111' },
          elements: []
        }
      ]
    }
  ]);

  // Assert (initial)
  assert.match(raw, /heading/);

  // Act
  const document = parseElementorDocument(raw);
  const found = findElementById(document.elements, 'heading');

  // Assert
  assert.equal(document.ok, true);
  assert.equal(found.element.id, 'heading');
  assert.equal(found.parent.id, 'hero');
  assert.deepEqual(found.path, [0, 'elements', 0]);
});

test('applyWidgetSettingsPatch: deep merges widget settings without replacing the whole widget', () => {
  // Arrange
  const document = parseElementorDocument([
    {
      id: 'hero',
      elType: 'container',
      settings: {},
      elements: [
        {
          id: 'heading',
          elType: 'widget',
          widgetType: 'heading',
          settings: {
            title: 'Hero Title',
            title_color: '#111111',
            typography_typography: 'custom',
            typography_font_size: { unit: 'px', size: 48 }
          },
          elements: []
        }
      ]
    }
  ]);

  // Assert (initial)
  assert.equal(document.ok, true);

  // Act
  const result = applyWidgetSettingsPatch(document.elements, {
    widgetId: 'heading',
    expectedWidgetType: 'heading',
    settingsPatch: {
      title: 'Updated Hero Title',
      typography_font_size: { unit: 'px', size: 54 }
    }
  });

  // Assert
  assert.equal(result.widget.id, 'heading');
  assert.equal(result.before.title, 'Hero Title');
  assert.equal(result.after.title, 'Updated Hero Title');
  assert.equal(result.after.title_color, '#111111');
  assert.deepEqual(result.after.typography_font_size, { unit: 'px', size: 54 });
});

test('applyElementorDocumentOperations: applies ordered tree mutations and reports structural deltas', () => {
  // Arrange
  const original = parseElementorDocument([
    {
      id: 'hero',
      elType: 'container',
      settings: {},
      elements: [
        {
          id: 'heading',
          elType: 'widget',
          widgetType: 'heading',
          settings: { title: 'Hero Title' },
          elements: []
        }
      ]
    }
  ]);
  const insertedElement = {
    id: 'cta',
    elType: 'widget',
    widgetType: 'button',
    settings: { text: 'Contact Us', link: { url: '/contact' } },
    elements: []
  };

  // Assert (initial)
  assert.equal(original.ok, true);

  // Act
  const updatedElements = applyElementorDocumentOperations(original.elements, [
    {
      op: 'insertAfter',
      targetId: 'heading',
      element: insertedElement
    },
    {
      op: 'replaceWidgetSettings',
      widgetId: 'heading',
      expectedWidgetType: 'heading',
      settingsPatch: { title: 'Updated Hero Title' }
    }
  ]);
  const diff = summarizeElementorStructuralDiff(original.elements, updatedElements);

  // Assert
  assert.equal(updatedElements[0].elements[1].id, 'cta');
  assert.equal(updatedElements[0].elements[0].settings.title, 'Updated Hero Title');
  assert.equal(diff.widgetsAdded, 1);
  assert.equal(diff.widgetsRemoved, 0);
  assert.equal(diff.widgetTypesChanged.length, 0);
});

test('applyElementorDocumentOperations: replaceWidgetSettings removes settings omitted from the replacement payload', () => {
  // Arrange
  const original = parseElementorDocument([
    {
      id: 'hero',
      elType: 'container',
      settings: {},
      elements: [
        {
          id: 'heading',
          elType: 'widget',
          widgetType: 'heading',
          settings: {
            title: 'Hero Title',
            title_color: '#111111',
            typography_typography: 'custom'
          },
          elements: []
        }
      ]
    }
  ]);

  // Assert (initial)
  assert.equal(original.ok, true);

  // Act
  const updatedElements = applyElementorDocumentOperations(original.elements, [
    {
      op: 'replaceWidgetSettings',
      widgetId: 'heading',
      expectedWidgetType: 'heading',
      settingsPatch: {
        title: 'Replaced Title'
      }
    }
  ]);

  // Assert
  assert.deepEqual(updatedElements[0].elements[0].settings, {
    title: 'Replaced Title'
  });
});
