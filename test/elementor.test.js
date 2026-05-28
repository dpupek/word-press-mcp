import test from 'node:test';
import assert from 'node:assert/strict';
import { diffElementorAudits, enrichElementorResponse, extractElementorAudit, validateElementorAudit } from '../src/elementor.js';

test('extractElementorAudit: summarizes valid elementor document data', () => {
  // Arrange
  const item = {
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_data: JSON.stringify([
        {
          id: 'root',
          elType: 'container',
          elements: [
            {
              id: 'heading',
              elType: 'widget',
              widgetType: 'heading',
              settings: { title: 'Hero Title' }
            }
          ]
        }
      ]),
      _elementor_page_settings: JSON.stringify({ hide_title: 'yes' }),
      _elementor_conditions: JSON.stringify([])
    },
    title: { rendered: 'Landing Page' },
    status: 'draft',
    slug: 'landing-page',
    type: 'page'
  };

  // Assert (initial)
  assert.equal(item.meta._elementor_edit_mode, 'builder');

  // Act
  const audit = extractElementorAudit(item);

  // Assert
  assert.equal(audit.is_elementor, true);
  assert.equal(audit.summary.parse_ok, true);
  assert.equal(audit.summary.widget_types.heading, 1);
  assert.equal(audit.summary.heading_titles[0], 'Hero Title');
});

test('enrichElementorResponse: filters list results when elementor_only is enabled', () => {
  // Arrange
  const data = [
    {
      id: 1,
      meta: { _elementor_edit_mode: 'builder', _elementor_data: '[]' }
    },
    {
      id: 2,
      meta: {}
    }
  ];

  // Assert (initial)
  assert.equal(data.length, 2);

  // Act
  const result = enrichElementorResponse(data, { include_elementor_state: true, elementor_only: true });

  // Assert
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
  assert.equal(result[0].elementor_state.is_elementor, true);
});

test('validateElementorAudit: reports issues for malformed elementor data', () => {
  // Arrange
  const audit = extractElementorAudit({
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_data: '{bad json'
    }
  });

  // Assert (initial)
  assert.equal(audit.is_elementor, true);

  // Act
  const result = validateElementorAudit(audit);

  // Assert
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes('_elementor_data')));
});

test('validateElementorAudit: returns structured findings while preserving legacy issue and warning arrays', () => {
  // Arrange
  const audit = extractElementorAudit({
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_data: JSON.stringify([
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
      ])
    }
  });

  // Assert (initial)
  assert.equal(audit.is_elementor, true);

  // Act
  const result = validateElementorAudit(audit);

  // Assert
  assert.ok(Array.isArray(result.findings));
  assert.ok(result.findings.some((finding) => finding.code === 'missing_global_bindings'));
  assert.ok(result.warnings.some((warning) => /__globals__/.test(warning)));
});

test('diffElementorAudits: reports structural deltas between source and target', () => {
  // Arrange
  const source = extractElementorAudit({
    title: { rendered: 'Source' },
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_data: JSON.stringify([{ id: 'a', elType: 'widget', widgetType: 'heading', settings: { title: 'A' } }])
    }
  });
  const target = extractElementorAudit({
    title: { rendered: 'Target' },
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_data: JSON.stringify([
        { id: 'a', elType: 'widget', widgetType: 'heading', settings: { title: 'A' } },
        { id: 'b', elType: 'widget', widgetType: 'text-editor', settings: {} }
      ])
    }
  });

  // Assert (initial)
  assert.equal(source.summary.total_elements, 1);

  // Act
  const diff = diffElementorAudits(source, target);

  // Assert
  assert.equal(diff.summary_delta.total_elements, 1);
  assert.equal(diff.widget_types_added['text-editor'], 1);
});
