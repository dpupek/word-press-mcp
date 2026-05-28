import { hasAuth } from './config.js';

const ELEMENTOR_META_KEYS = [
  '_elementor_edit_mode',
  '_elementor_template_type',
  '_elementor_data',
  '_elementor_page_settings',
  '_elementor_conditions'
];

function safeJsonParse(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: true, value };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: error.message, raw: value };
  }
}

function buildFinding(severity, code, message, extra = {}) {
  return {
    severity,
    code,
    message,
    ...extra
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function visitElements(elements, state, depth = 1) {
  if (!Array.isArray(elements)) return;
  state.maxDepth = Math.max(state.maxDepth, depth);
  for (const element of elements) {
    state.totalElements += 1;
    if (element?.elType === 'container' || element?.isInner !== undefined) {
      state.containerCount += 1;
    }
    if (element?.elType === 'widget') {
      state.widgetCount += 1;
      const widgetType = element?.widgetType || 'unknown';
      state.widgetTypes[widgetType] = (state.widgetTypes[widgetType] || 0) + 1;
      const title = element?.settings?.title;
      if (typeof title === 'string' && title.trim()) {
        state.headingTitles.push(title.trim());
      }
    }
    visitElements(element?.elements, state, depth + 1);
  }
}

export function isElementorAwareOperation(operation) {
  if (operation.method !== 'GET') return false;
  return (
    operation.route.startsWith('/wp/v2/posts') ||
    operation.route.startsWith('/wp/v2/pages') ||
    operation.route.startsWith('/wp/v2/elementor_library')
  );
}

export function augmentElementorSchema(schemaShape, operation, z) {
  if (!isElementorAwareOperation(operation)) return schemaShape;
  const augmented = {
    ...schemaShape,
    include_elementor_state: z.boolean().optional(),
    include_elementor_summary: z.boolean().optional(),
    include_elementor_raw_parsed: z.boolean().optional(),
    include_elementor_theme_builder_state: z.boolean().optional()
  };
  if (operation.route === '/wp/v2/posts' || operation.route === '/wp/v2/pages' || operation.route === '/wp/v2/elementor_library') {
    augmented.elementor_only = z.boolean().optional();
  }
  return augmented;
}

function buildElementorState(item) {
  const meta = item?.meta || {};
  const dataParsed = safeJsonParse(meta._elementor_data);
  const pageSettingsParsed = safeJsonParse(meta._elementor_page_settings);
  const conditionsParsed = safeJsonParse(meta._elementor_conditions);
  const editMode = meta._elementor_edit_mode || '';
  const templateType = meta._elementor_template_type || '';
  return {
    is_elementor: editMode === 'builder' || Boolean(meta._elementor_data),
    elementor_edit_mode: editMode || null,
    elementor_template_type: templateType || null,
    has_elementor_data: Boolean(meta._elementor_data),
    has_page_settings: meta._elementor_page_settings !== undefined && meta._elementor_page_settings !== null,
    has_conditions: Array.isArray(conditionsParsed.value) ? conditionsParsed.value.length > 0 : Boolean(meta._elementor_conditions),
    elementor_data_json_valid: dataParsed.ok,
    elementor_page_settings_json_valid: pageSettingsParsed.ok,
    elementor_conditions_json_valid: conditionsParsed.ok
  };
}

function buildElementorSummary(item) {
  const meta = item?.meta || {};
  const dataParsed = safeJsonParse(meta._elementor_data);
  if (!dataParsed.ok || !Array.isArray(dataParsed.value)) {
    return {
      parse_ok: dataParsed.ok,
      parse_error: dataParsed.ok ? null : dataParsed.error,
      root_element_count: 0,
      total_elements: 0,
      container_count: 0,
      widget_count: 0,
      widget_types: {},
      heading_titles: [],
      max_depth: 0,
      likely_structure: null
    };
  }

  const state = {
    totalElements: 0,
    containerCount: 0,
    widgetCount: 0,
    widgetTypes: {},
    headingTitles: [],
    maxDepth: 0
  };
  visitElements(dataParsed.value, state);
  const widgetTypeNames = Object.keys(state.widgetTypes);
  return {
    parse_ok: true,
    parse_error: null,
    root_element_count: dataParsed.value.length,
    total_elements: state.totalElements,
    container_count: state.containerCount,
    widget_count: state.widgetCount,
    widget_types: state.widgetTypes,
    heading_titles: state.headingTitles.slice(0, 25),
    max_depth: state.maxDepth,
    likely_structure: widgetTypeNames.length > 0 && state.containerCount > 0 ? 'container-based' : 'unknown'
  };
}

function visitAuditElements(elements, visitor, parent = null) {
  if (!Array.isArray(elements)) return;
  for (const element of elements) {
    visitor(element, parent);
    visitAuditElements(element?.elements, visitor, element);
  }
}

function buildThemeBuilderState(item) {
  const meta = item?.meta || {};
  const templateType = meta._elementor_template_type || '';
  const conditions = safeJsonParse(meta._elementor_conditions);
  return {
    is_theme_builder_document: ['header', 'footer', 'single', 'single-post', 'single-page', 'archive', 'search-results', 'error-404', 'loop-item'].includes(templateType),
    template_type: templateType || null,
    condition_count: Array.isArray(conditions.value) ? conditions.value.length : 0,
    conditions: Array.isArray(conditions.value) ? conditions.value : null
  };
}

function enrichOne(item, options) {
  const enriched = { ...item };
  if (options.include_elementor_state) {
    enriched.elementor_state = buildElementorState(item);
  }
  if (options.include_elementor_summary) {
    enriched.elementor_summary = buildElementorSummary(item);
  }
  if (options.include_elementor_raw_parsed) {
    const meta = item?.meta || {};
    enriched.elementor_parsed = {
      data: safeJsonParse(meta._elementor_data),
      page_settings: safeJsonParse(meta._elementor_page_settings),
      conditions: safeJsonParse(meta._elementor_conditions)
    };
  }
  if (options.include_elementor_theme_builder_state) {
    enriched.elementor_theme_builder_state = buildThemeBuilderState(item);
  }
  return enriched;
}

export function maybeApplyElementorOptions(operation, args, config) {
  if (!isElementorAwareOperation(operation)) {
    return { requestArgs: args, elementorOptions: null };
  }
  const options = {
    include_elementor_state: Boolean(args.include_elementor_state),
    include_elementor_summary: Boolean(args.include_elementor_summary),
    include_elementor_raw_parsed: Boolean(args.include_elementor_raw_parsed),
    include_elementor_theme_builder_state: Boolean(args.include_elementor_theme_builder_state),
    elementor_only: Boolean(args.elementor_only)
  };
  const needsElementorContext = Object.values(options).some(Boolean);
  const requestArgs = { ...args };
  delete requestArgs.include_elementor_state;
  delete requestArgs.include_elementor_summary;
  delete requestArgs.include_elementor_raw_parsed;
  delete requestArgs.include_elementor_theme_builder_state;
  delete requestArgs.elementor_only;
  if (needsElementorContext && requestArgs.context === undefined && hasAuth(config)) {
    requestArgs.context = 'edit';
  }
  return { requestArgs, elementorOptions: options };
}

export function enrichElementorResponse(data, options) {
  if (!options || !Object.values(options).some(Boolean)) return data;
  if (Array.isArray(data)) {
    const enriched = data.map((item) => enrichOne(item, options));
    return options.elementor_only ? enriched.filter((item) => item?.elementor_state?.is_elementor) : enriched;
  }
  return enrichOne(data, options);
}

export function extractElementorAudit(item) {
  const audit = buildElementorState(item);
  const summary = buildElementorSummary(item);
  const themeBuilder = buildThemeBuilderState(item);
  const meta = item?.meta || {};
  const parsedData = safeJsonParse(meta._elementor_data);
  const parsedPageSettings = safeJsonParse(meta._elementor_page_settings);
  const parsedConditions = safeJsonParse(meta._elementor_conditions);
  return {
    ...audit,
    summary,
    theme_builder: themeBuilder,
    missing_meta_keys: ELEMENTOR_META_KEYS.filter((key) => item?.meta?.[key] === undefined),
    parsed: {
      data: parsedData.ok && Array.isArray(parsedData.value) ? parsedData.value : null,
      page_settings: parsedPageSettings.ok ? parsedPageSettings.value : null,
      conditions: parsedConditions.ok ? parsedConditions.value : null
    },
    title: item?.title?.raw || item?.title?.rendered || null,
    status: item?.status || null,
    slug: item?.slug || null,
    type: item?.type || null
  };
}

export function validateElementorAudit(audit) {
  const issues = [];
  const warnings = [];
  const findings = [];

  if (!audit.is_elementor) {
    const message = 'Document does not currently look Elementor-authored.';
    warnings.push(message);
    findings.push(buildFinding('warning', 'not_elementor_document', message));
  }
  if (audit.is_elementor && audit.elementor_edit_mode !== 'builder') {
    const message = 'Elementor edit mode is not `builder`.';
    issues.push(message);
    findings.push(buildFinding('error', 'edit_mode_not_builder', message));
  }
  if (audit.has_elementor_data && !audit.elementor_data_json_valid) {
    const message = '`_elementor_data` is present but not valid JSON.';
    issues.push(message);
    findings.push(buildFinding('error', 'invalid_elementor_data', message));
  }
  if (audit.has_page_settings && !audit.elementor_page_settings_json_valid) {
    const message = '`_elementor_page_settings` is not valid JSON/object data.';
    issues.push(message);
    findings.push(buildFinding('error', 'invalid_page_settings', message));
  }
  if (audit.has_conditions && !audit.elementor_conditions_json_valid) {
    const message = '`_elementor_conditions` is not valid JSON/array data.';
    issues.push(message);
    findings.push(buildFinding('error', 'invalid_conditions', message));
  }
  if (audit.is_elementor && !audit.has_elementor_data) {
    const message = 'Elementor edit mode is set but `_elementor_data` is empty or missing.';
    warnings.push(message);
    findings.push(buildFinding('warning', 'missing_elementor_data', message));
  }
  if (audit.summary.parse_ok && audit.summary.total_elements === 0 && audit.has_elementor_data) {
    const message = 'Elementor data parsed successfully but contains no elements.';
    warnings.push(message);
    findings.push(buildFinding('warning', 'empty_elementor_tree', message));
  }
  if (audit.theme_builder.is_theme_builder_document && audit.theme_builder.condition_count === 0) {
    const message = 'Theme-builder document has no conditions assigned.';
    warnings.push(message);
    findings.push(buildFinding('warning', 'missing_theme_builder_conditions', message));
  }
  if (audit.missing_meta_keys.length > 0) {
    const message = `Missing Elementor meta keys: ${audit.missing_meta_keys.join(', ')}`;
    warnings.push(message);
    findings.push(buildFinding('warning', 'missing_meta_keys', message));
  }

  if (audit.summary.parse_ok && Array.isArray(audit.parsed?.data)) {
    let hasGlobals = false;
    let hasTextColor = false;
    let hasGlobalTypography = false;
    let hasHeroBackground = false;

    visitAuditElements(audit.parsed.data, (element) => {
      const settings = element?.settings || {};
      if (isObject(settings.__globals__) && Object.keys(settings.__globals__).length > 0) {
        hasGlobals = true;
      }
      if (settings.text_color || settings.title_color) {
        hasTextColor = true;
      }
      if (settings.typography_typography || settings.title_typography_typography || settings.__globals__?.typography) {
        hasGlobalTypography = true;
      }
      if (settings.background_image?.url || settings.background_background === 'classic') {
        hasHeroBackground = true;
      }
    });

    if (!hasGlobals) {
      const message = 'Elementor document does not expose any widget-level `__globals__` bindings.';
      warnings.push(message);
      findings.push(buildFinding('warning', 'missing_global_bindings', message));
    }
    if (!hasTextColor) {
      const message = 'Elementor document does not expose text color bindings such as `text_color` or `title_color`.';
      warnings.push(message);
      findings.push(buildFinding('warning', 'missing_text_color_binding', message));
    }
    if (!hasGlobalTypography) {
      const message = 'Elementor document does not expose obvious typography bindings.';
      warnings.push(message);
      findings.push(buildFinding('warning', 'missing_typography_binding', message));
    }
    if (audit.summary.container_count > 0 && !hasHeroBackground) {
      const message = 'Elementor document has container structure but no obvious background-image settings were found.';
      warnings.push(message);
      findings.push(buildFinding('warning', 'missing_container_background', message));
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    findings
  };
}

export function diffElementorAudits(sourceAudit, targetAudit) {
  return {
    source_title: sourceAudit.title,
    target_title: targetAudit.title,
    changed_edit_mode: sourceAudit.elementor_edit_mode !== targetAudit.elementor_edit_mode,
    changed_template_type: sourceAudit.elementor_template_type !== targetAudit.elementor_template_type,
    changed_has_elementor_data: sourceAudit.has_elementor_data !== targetAudit.has_elementor_data,
    changed_page_settings_validity:
      sourceAudit.elementor_page_settings_json_valid !== targetAudit.elementor_page_settings_json_valid,
    changed_conditions_validity:
      sourceAudit.elementor_conditions_json_valid !== targetAudit.elementor_conditions_json_valid,
    summary_delta: {
      root_element_count:
        (targetAudit.summary.root_element_count || 0) - (sourceAudit.summary.root_element_count || 0),
      total_elements: (targetAudit.summary.total_elements || 0) - (sourceAudit.summary.total_elements || 0),
      container_count: (targetAudit.summary.container_count || 0) - (sourceAudit.summary.container_count || 0),
      widget_count: (targetAudit.summary.widget_count || 0) - (sourceAudit.summary.widget_count || 0),
      max_depth: (targetAudit.summary.max_depth || 0) - (sourceAudit.summary.max_depth || 0)
    },
    widget_types_added: Object.fromEntries(
      Object.entries(targetAudit.summary.widget_types || {}).filter(
        ([key, value]) => (sourceAudit.summary.widget_types?.[key] || 0) < value
      )
    ),
    widget_types_removed: Object.fromEntries(
      Object.entries(sourceAudit.summary.widget_types || {}).filter(
        ([key, value]) => (targetAudit.summary.widget_types?.[key] || 0) < value
      )
    ),
    heading_titles_added: (targetAudit.summary.heading_titles || []).filter(
      (title) => !(sourceAudit.summary.heading_titles || []).includes(title)
    ),
    heading_titles_removed: (sourceAudit.summary.heading_titles || []).filter(
      (title) => !(targetAudit.summary.heading_titles || []).includes(title)
    )
  };
}
