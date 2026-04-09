import fs from 'node:fs';
import { diffElementorAudits, extractElementorAudit, validateElementorAudit } from './elementor.js';

function normalizeTerms(input) {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function buildWorkflowPlan(name, steps, notes = []) {
  return {
    ok: true,
    mode: 'plan',
    workflow: name,
    steps,
    notes
  };
}

function summarizeDiffRisk(diff) {
  const totalDelta = Math.abs(diff?.summary_delta?.total_elements || 0);
  const widgetDelta = Math.abs(diff?.summary_delta?.widget_count || 0);
  const headingChanges =
    (Array.isArray(diff?.headings_added) ? diff.headings_added.length : 0) +
    (Array.isArray(diff?.headings_removed) ? diff.headings_removed.length : 0);

  if (totalDelta === 0 && widgetDelta === 0 && headingChanges === 0) {
    return { riskLevel: 'low', reason: 'Candidate and live document have no structural Elementor deltas.' };
  }

  if (totalDelta <= 2 && widgetDelta <= 2 && headingChanges <= 2) {
    return {
      riskLevel: 'medium',
      reason: 'Candidate differs slightly from the live document; review the diff before restore.'
    };
  }

  return {
    riskLevel: 'high',
    reason: 'Candidate differs substantially from the live document; restore should be treated as higher risk.'
  };
}

function buildRestoreRecommendation(liveInspection, candidateInspection, candidateValidation, diff) {
  if (!candidateInspection.elementor.is_elementor) {
    return {
      canRestore: false,
      riskLevel: 'high',
      reason: 'Candidate does not appear to be Elementor-authored.'
    };
  }

  if (!candidateValidation.ok) {
    return {
      canRestore: false,
      riskLevel: 'high',
      reason: `Candidate failed Elementor validation with ${candidateValidation.issues.length} issue(s).`
    };
  }

  if (!liveInspection.elementor.is_elementor) {
    return {
      canRestore: true,
      riskLevel: 'medium',
      reason: 'Live document is not currently identified as Elementor-authored, but the candidate is valid and can be restored.'
    };
  }

  const diffRisk = summarizeDiffRisk(diff);
  return {
    canRestore: true,
    riskLevel: diffRisk.riskLevel,
    reason: diffRisk.reason
  };
}

function requireWorkflowConfirmation(workflow, args) {
  if (args.mode !== 'execute') return;
  if (args.confirm === true) return;
  throw {
    kind: 'confirmation_required',
    message: `${workflow} requires confirm=true in execute mode.`,
    details: { workflow, mode: args.mode }
  };
}

function ensureNumericTermIds(fieldName, values) {
  const normalized = normalizeTerms(values);
  if (normalized.length === 0) return normalized;
  if (normalized.every((value) => typeof value === 'number')) return normalized;
  throw {
    kind: 'validation_error',
    message: `${fieldName} must be numeric term IDs in execute mode.`,
    details: {
      fieldName,
      actionable: `Run workflow_taxonomy_reconcile first, then supply numeric ${fieldName} IDs to the write workflow.`
    }
  };
}

function buildWpGetOperation(postType, route, pathParams) {
  return {
    toolName: `wp_v2_${postType}_${pathParams.join('_') || 'list'}_get`,
    route,
    method: 'GET',
    args: [
      ...pathParams.map((name) => ({ name, location: 'path' })),
      { name: 'context', location: 'query' }
    ],
    pathParams,
    requestStyle: 'query'
  };
}

function buildTree(items, parentId = 0) {
  return items
    .filter((item) => Number(item.parent || 0) === Number(parentId || 0))
    .sort((left, right) => {
      const leftOrder = Number(left.menu_order || 0);
      const rightOrder = Number(right.menu_order || 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return Number(left.id || 0) - Number(right.id || 0);
    })
    .map((item) => ({
      id: item.id,
      title: item.title?.raw || item.title?.rendered || item.title || null,
      type: item.type || null,
      object: item.object || null,
      object_id: item.object_id || null,
      url: item.url || null,
      parent: item.parent || 0,
      menu_order: item.menu_order || 0,
      target: item.target || null,
      children: buildTree(items, item.id)
    }));
}

function validateMenuItemArgs(args) {
  const type = args.type || 'custom';
  if (!args.menuId) {
    throw {
      kind: 'validation_error',
      message: 'menuId is required for menu item workflows.',
      details: { args }
    };
  }

  if (type === 'custom' && !args.url) {
    throw {
      kind: 'validation_error',
      message: 'Custom menu items require a url.',
      details: { type, actionable: 'Provide url for custom menu items.' }
    };
  }

  if (['post_type', 'taxonomy', 'post_type_archive'].includes(type)) {
    if (!args.object) {
      throw {
        kind: 'validation_error',
        message: `${type} menu items require an object value.`,
        details: { type, actionable: 'Provide object, for example post, page, or category.' }
      };
    }
    if (type !== 'post_type_archive' && !args.objectId) {
      throw {
        kind: 'validation_error',
        message: `${type} menu items require objectId.`,
        details: { type, actionable: 'Provide the underlying WordPress object ID.' }
      };
    }
  }
}

async function listMenuLocations(client) {
  const operation = {
    toolName: 'wp_v2_menu_locations_list',
    route: '/wp/v2/menu-locations',
    method: 'GET',
    args: [{ name: 'context', location: 'query' }],
    pathParams: [],
    requestStyle: 'query'
  };
  const result = await client.execute(operation, { context: 'edit' });
  return Array.isArray(result.data) ? result.data : [];
}

async function executeWithEditFallback(client, operation, args) {
  try {
    const result = await client.execute(operation, { ...args, context: 'edit' });
    return { result, contextUsed: 'edit' };
  } catch {
    const result = await client.execute(operation, { ...args, context: 'view' });
    return { result, contextUsed: 'view' };
  }
}

function buildPreviewUrl({ siteUrl, postType, document }) {
  if (!siteUrl || !document?.id) return null;
  if (typeof document.preview_link === 'string' && document.preview_link.trim()) {
    return document.preview_link;
  }

  const url = new URL(siteUrl);
  if (postType === 'pages' || document?.type === 'page') {
    url.searchParams.set('page_id', String(document.id));
  } else {
    url.searchParams.set('p', String(document.id));
  }
  url.searchParams.set('preview', 'true');
  url.searchParams.set('preview_id', String(document.id));

  if (document?.preview_nonce) {
    url.searchParams.set('preview_nonce', String(document.preview_nonce));
  }

  return url.toString();
}

function buildPostUrlSummary({ siteUrl, postType, document, contextUsed }) {
  const status = document?.status || null;
  const publicStatuses = new Set(['publish']);
  const scheduledStatuses = new Set(['future']);
  const publicUrl = publicStatuses.has(status) && typeof document?.link === 'string' ? document.link : null;
  const previewUrl = buildPreviewUrl({ siteUrl, postType, document });
  const notes = [];

  if (!publicUrl && previewUrl) {
    notes.push('Preview URLs for unpublished content commonly require an authenticated browser session with sufficient WordPress privileges.');
  }

  if (scheduledStatuses.has(status) && typeof document?.link === 'string') {
    notes.push('The public URL is known, but the post is scheduled and may not render publicly until its publish time.');
  }

  if (contextUsed === 'view') {
    notes.push('The document had to be loaded with view context, so some edit-only preview fields may be unavailable.');
  }

  return {
    apiUrl: null,
    publicUrl,
    previewUrl,
    editContextAvailable: contextUsed === 'edit',
    isPublished: publicStatuses.has(status),
    isScheduled: scheduledStatuses.has(status),
    status,
    notes
  };
}

export async function inspectPostWorkflow(client, args) {
  const operation = {
    toolName: 'wp_v2_posts_id_get',
    route: '/wp/v2/posts/(?P<id>[\\d]+)',
    method: 'GET',
    args: [
      { name: 'id', location: 'path' },
      { name: 'context', location: 'query' }
    ],
    pathParams: ['id'],
    requestStyle: 'query'
  };
  const result = await client.execute(operation, { id: args.postId, context: 'edit' });
  const post = result.data;
  const elementorAudit = extractElementorAudit(post);
  return {
    ok: true,
    workflow: 'workflow_inspect_post',
    post: {
      id: post?.id,
      status: post?.status,
      slug: post?.slug,
      template: post?.template,
      title: post?.title?.raw || post?.title?.rendered || null,
      featured_media: post?.featured_media,
      has_elementor_data: Boolean(post?.meta?._elementor_data),
      elementor: elementorAudit
    },
    urls: {
      api: result.requestUrl
    }
  };
}

export async function getPostUrlsWorkflow(client, config, args) {
  const route = `/wp/v2/${args.postType}/(?P<id>[\\d]+)`;
  const operation = buildWpGetOperation(args.postType, route, ['id']);
  const { result, contextUsed } = await executeWithEditFallback(client, operation, { id: args.postId });
  const document = result.data;
  const urls = buildPostUrlSummary({
    siteUrl: config.siteUrl,
    postType: args.postType,
    document,
    contextUsed
  });

  return {
    ok: true,
    workflow: 'workflow_get_post_urls',
    contextUsed,
    document: {
      id: document?.id,
      type: document?.type,
      status: document?.status,
      slug: document?.slug,
      title: document?.title?.raw || document?.title?.rendered || null
    },
    urls: {
      ...urls,
      apiUrl: result.requestUrl
    }
  };
}

export async function listMenuStructureWorkflow(client, args) {
  const menuOperation = {
    toolName: 'wp_v2_menus_id_get',
    route: '/wp/v2/menus/(?P<id>[\\d]+)',
    method: 'GET',
    args: [
      { name: 'id', location: 'path' },
      { name: 'context', location: 'query' }
    ],
    pathParams: ['id'],
    requestStyle: 'query'
  };
  const menuItemsOperation = {
    toolName: 'wp_v2_menu_items_list',
    route: '/wp/v2/menu-items',
    method: 'GET',
    args: [
      { name: 'context', location: 'query' },
      { name: 'menus', location: 'query' },
      { name: 'per_page', location: 'query' },
      { name: 'orderby', location: 'query' },
      { name: 'order', location: 'query' }
    ],
    pathParams: [],
    requestStyle: 'query'
  };

  const [menuResult, itemsResult, locations] = await Promise.all([
    client.execute(menuOperation, { id: args.menuId, context: 'edit' }),
    client.execute(menuItemsOperation, {
      context: 'edit',
      menus: args.menuId,
      per_page: 100,
      orderby: 'menu_order',
      order: 'asc'
    }),
    listMenuLocations(client).catch(() => [])
  ]);

  const items = Array.isArray(itemsResult.data) ? itemsResult.data : [];
  const menu = menuResult.data || {};
  const assignedLocations = Array.isArray(menu.locations)
    ? menu.locations
    : locations
        .filter((location) => Number(location?.menu) === Number(args.menuId))
        .map((location) => location?.name || location?.location || null)
        .filter(Boolean);

  return {
    ok: true,
    workflow: 'workflow_list_menu_structure',
    menu: {
      id: menu.id,
      name: menu.name,
      slug: menu.slug,
      description: menu.description || null,
      locations: assignedLocations,
      auto_add: menu.auto_add ?? null
    },
    items,
    tree: buildTree(items)
  };
}

export async function upsertMenuItemWorkflow(client, args) {
  const mode = args.mode || 'plan';
  validateMenuItemArgs(args);

  const steps = [
    'Validate the target menu and the menu item payload.',
    'Create a new menu item or update the existing one using the menu-items REST endpoint.',
    'Reload the menu structure so the caller can verify placement and ordering.'
  ];

  if (mode === 'plan') {
    return buildWorkflowPlan('workflow_upsert_menu_item', steps, [
      args.itemId
        ? `The workflow will update existing menu item ${args.itemId}.`
        : 'The workflow will create a new menu item.',
      `Target menu: ${args.menuId}.`,
      `Item type: ${args.type || 'custom'}.`
    ]);
  }

  requireWorkflowConfirmation('workflow_upsert_menu_item', args);

  const operation = args.itemId
    ? {
        toolName: 'wp_v2_menu_items_id_update_post',
        route: '/wp/v2/menu-items/(?P<id>[\\d]+)',
        method: 'POST',
        args: [],
        pathParams: ['id'],
        requestStyle: 'json'
      }
    : {
        toolName: 'wp_v2_menu_items_create',
        route: '/wp/v2/menu-items',
        method: 'POST',
        args: [],
        pathParams: [],
        requestStyle: 'json'
      };

  const payload = {
    ...(args.itemId ? { id: args.itemId } : {}),
    title: args.title,
    type: args.type || 'custom',
    status: args.status || 'publish',
    parent: args.parentId || 0,
    attr_title: args.attrTitle,
    classes: args.classes,
    description: args.description,
    menu_order: args.menuOrder,
    object: args.object,
    object_id: args.objectId,
    target: args.target,
    url: args.url,
    xfn: args.xfn,
    menus: args.menuId
  };

  const result = await client.execute(operation, payload);
  const structure = await listMenuStructureWorkflow(client, { menuId: args.menuId });

  return {
    ok: true,
    mode,
    workflow: 'workflow_upsert_menu_item',
    item: result.data,
    menu: structure.menu,
    tree: structure.tree
  };
}

export async function assignMenuLocationsWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const availableLocations = await listMenuLocations(client);
  const availableNames = availableLocations
    .map((location) => location?.name || location?.location)
    .filter(Boolean);
  const invalidLocations = (args.locations || []).filter((location) => !availableNames.includes(location));

  if (invalidLocations.length > 0) {
    throw {
      kind: 'validation_error',
      message: 'One or more requested menu locations are not available on this site.',
      details: {
        invalidLocations,
        availableLocations: availableNames
      }
    };
  }

  const steps = [
    'Load the available menu locations for the current site.',
    'Validate that each requested location exists.',
    'Update the target menu with the requested locations and return the refreshed menu details.'
  ];

  if (mode === 'plan') {
    return {
      ...buildWorkflowPlan('workflow_assign_menu_locations', steps, [
        `Target menu: ${args.menuId}.`,
        `Requested locations: ${(args.locations || []).join(', ') || 'none'}.`
      ]),
      availableLocations: availableNames
    };
  }

  requireWorkflowConfirmation('workflow_assign_menu_locations', args);

  const operation = {
    toolName: 'wp_v2_menus_id_update_post',
    route: '/wp/v2/menus/(?P<id>[\\d]+)',
    method: 'POST',
    args: [],
    pathParams: ['id'],
    requestStyle: 'json'
  };
  const result = await client.execute(operation, {
    id: args.menuId,
    locations: args.locations
  });

  return {
    ok: true,
    mode,
    workflow: 'workflow_assign_menu_locations',
    menu: result.data,
    availableLocations: availableNames
  };
}

export async function inspectElementorDocumentWorkflow(client, args) {
  const route = `/wp/v2/${args.postType}/(?P<id>[\\d]+)`;
  const operation = buildWpGetOperation(args.postType, route, ['id']);
  const { result, contextUsed } = await executeWithEditFallback(client, operation, { id: args.postId });
  return {
    ok: true,
    workflow: 'workflow_inspect_elementor_document',
    document: result.data,
    contextUsed,
    elementor: extractElementorAudit(result.data)
  };
}

export async function inspectElementorHistoryWorkflow(client, args) {
  const baseType = args.postType;
  const route =
    args.kind === 'autosave'
      ? `/wp/v2/${baseType}/(?P<parent>[\\d]+)/autosaves/(?P<id>[\\d]+)`
      : `/wp/v2/${baseType}/(?P<parent>[\\d]+)/revisions/(?P<id>[\\d]+)`;
  const operation = buildWpGetOperation(baseType, route, ['parent', 'id']);
  const { result, contextUsed } = await executeWithEditFallback(client, operation, {
    parent: args.parentId,
    id: args.historyId
  });
  return {
    ok: true,
    workflow: 'workflow_inspect_elementor_history',
    kind: args.kind,
    contextUsed,
    document: result.data,
    elementor: extractElementorAudit(result.data)
  };
}

export async function validateElementorDocumentWorkflow(client, args) {
  const inspection = await inspectElementorDocumentWorkflow(client, args);
  return {
    ok: true,
    workflow: 'workflow_validate_elementor_document',
    contextUsed: inspection.contextUsed,
    document: {
      id: inspection.document?.id,
      type: inspection.document?.type,
      title: inspection.elementor.title,
      status: inspection.elementor.status,
      slug: inspection.elementor.slug
    },
    elementor: inspection.elementor,
    validation: validateElementorAudit(inspection.elementor)
  };
}

export async function diffElementorDocumentsWorkflow(client, args) {
  const sourceInspection = await inspectElementorDocumentWorkflow(client, {
    postType: args.sourcePostType,
    postId: args.sourcePostId
  });

  let targetInspection;
  if (args.targetKind === 'document') {
    targetInspection = await inspectElementorDocumentWorkflow(client, {
      postType: args.targetPostType,
      postId: args.targetPostId
    });
  } else {
    targetInspection = await inspectElementorHistoryWorkflow(client, {
      postType: args.targetPostType,
      kind: args.targetKind,
      parentId: args.targetParentId,
      historyId: args.targetHistoryId
    });
  }

  return {
    ok: true,
    workflow: 'workflow_diff_elementor_documents',
    source: {
      contextUsed: sourceInspection.contextUsed,
      document: {
        id: sourceInspection.document?.id,
        type: sourceInspection.document?.type,
        title: sourceInspection.elementor.title
      },
      validation: validateElementorAudit(sourceInspection.elementor),
      elementor: sourceInspection.elementor
    },
    target: {
      contextUsed: targetInspection.contextUsed,
      kind: args.targetKind,
      document: {
        id: targetInspection.document?.id,
        type: targetInspection.document?.type,
        title: targetInspection.elementor.title
      },
      validation: validateElementorAudit(targetInspection.elementor),
      elementor: targetInspection.elementor
    },
    diff: diffElementorAudits(sourceInspection.elementor, targetInspection.elementor)
  };
}

export async function restoreElementorCandidateWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const liveInspection = await inspectElementorDocumentWorkflow(client, {
    postType: args.postType,
    postId: args.targetPostId
  });
  const candidateInspection = await inspectElementorHistoryWorkflow(client, {
    postType: args.postType,
    kind: args.candidateKind,
    parentId: args.targetPostId,
    historyId: args.candidateId
  });
  const candidateValidation = validateElementorAudit(candidateInspection.elementor);
  const diff = diffElementorAudits(liveInspection.elementor, candidateInspection.elementor);
  const recommendation = buildRestoreRecommendation(
    liveInspection,
    candidateInspection,
    candidateValidation,
    diff
  );

  const steps = [
    'Inspect the live document and the requested revision or autosave with edit context when possible.',
    'Validate the candidate Elementor document and compare it against the current live document.',
    'If the candidate is safe to restore, copy its title, content, excerpt, template, and Elementor meta back onto the live document while preserving the live status.'
  ];

  if (mode === 'plan') {
    return {
      ...buildWorkflowPlan('workflow_restore_elementor_candidate', steps, [
        `Live context used: ${liveInspection.contextUsed}.`,
        `Candidate context used: ${candidateInspection.contextUsed}.`,
        recommendation.reason
      ]),
      target: {
        postType: args.postType,
        postId: args.targetPostId,
        status: liveInspection.document?.status,
        title: liveInspection.elementor.title
      },
      candidate: {
        kind: args.candidateKind,
        id: args.candidateId,
        title: candidateInspection.elementor.title,
        validation: candidateValidation
      },
      recommendation,
      diff
    };
  }

  requireWorkflowConfirmation('workflow_restore_elementor_candidate', args);
  if (!recommendation.canRestore) {
    throw {
      kind: 'validation_error',
      message: 'Candidate restore was blocked because the requested revision or autosave failed restore safety checks.',
      details: {
        postType: args.postType,
        targetPostId: args.targetPostId,
        candidateKind: args.candidateKind,
        candidateId: args.candidateId,
        recommendation,
        validation: candidateValidation
      }
    };
  }

  const candidate = candidateInspection.document;
  const candidateMeta = candidate?.meta || {};
  const updateOperation = {
    toolName: `wp_v2_${args.postType}_id_update`,
    route: `/wp/v2/${args.postType}/(?P<id>[\\d]+)`,
    method: 'POST',
    args: [
      { name: 'id', location: 'path' },
      { name: 'title', location: 'body' },
      { name: 'status', location: 'body' },
      { name: 'content', location: 'body' },
      { name: 'excerpt', location: 'body' },
      { name: 'template', location: 'body' },
      { name: 'meta', location: 'body' }
    ],
    pathParams: ['id'],
    requestStyle: 'json'
  };

  const restorePayload = {
    id: args.targetPostId,
    title: candidate?.title?.raw || candidate?.title?.rendered || liveInspection.document?.title?.raw || liveInspection.document?.title?.rendered || '',
    status: liveInspection.document?.status || 'draft',
    content: candidate?.content?.raw || candidate?.content?.rendered || '',
    excerpt: candidate?.excerpt?.raw || candidate?.excerpt?.rendered || '',
    template: candidate?.template || liveInspection.document?.template || undefined,
    meta: {
      _elementor_edit_mode: candidateMeta._elementor_edit_mode,
      _elementor_template_type: candidateMeta._elementor_template_type,
      _elementor_data: candidateMeta._elementor_data,
      _elementor_page_settings: candidateMeta._elementor_page_settings,
      _elementor_conditions: candidateMeta._elementor_conditions
    }
  };

  const updateResult = await client.execute(updateOperation, restorePayload);
  const afterInspection = await inspectElementorDocumentWorkflow(client, {
    postType: args.postType,
    postId: args.targetPostId
  });

  return {
    ok: true,
    mode,
    workflow: 'workflow_restore_elementor_candidate',
    recommendation,
    before: {
      contextUsed: liveInspection.contextUsed,
      elementor: liveInspection.elementor
    },
    candidate: {
      kind: args.candidateKind,
      id: args.candidateId,
      contextUsed: candidateInspection.contextUsed,
      validation: candidateValidation,
      elementor: candidateInspection.elementor
    },
    restoreResult: updateResult.data,
    after: {
      contextUsed: afterInspection.contextUsed,
      validation: validateElementorAudit(afterInspection.elementor),
      elementor: afterInspection.elementor,
      diffFromCandidate: diffElementorAudits(candidateInspection.elementor, afterInspection.elementor)
    }
  };
}

export async function listElementorTemplatesWorkflow(client, args) {
  const wpLibraryOperation = {
    toolName: 'wp_v2_elementor_library_list',
    route: '/wp/v2/elementor_library',
    method: 'GET',
    args: [
      { name: 'context', location: 'query' },
      { name: 'per_page', location: 'query' }
    ],
    pathParams: [],
    requestStyle: 'query'
  };
  const siteEditorOperation = {
    toolName: 'elementor_v1_site_editor_templates_list',
    route: '/elementor/v1/site-editor/templates',
    method: 'GET',
    args: [],
    pathParams: [],
    requestStyle: 'query'
  };

  const [libraryResult, siteEditorResult] = await Promise.allSettled([
    client.execute(wpLibraryOperation, { context: 'edit', per_page: 100 }),
    client.execute(siteEditorOperation, {})
  ]);

  let conditions = [];
  if (args.includeConditions) {
    conditions = await Promise.all(
      (Array.isArray(siteEditorResult.value?.data) ? siteEditorResult.value.data : []).map(async (item) => {
        const templateId = String(item?.id ?? '');
        if (!templateId) return null;
        try {
          const conditionResult = await getElementorTemplateConditionsWorkflow(client, { templateId });
          return { templateId, conditions: conditionResult.conditions };
        } catch (error) {
          return { templateId, error: error.message || String(error) };
        }
      })
    );
    conditions = conditions.filter(Boolean);
  }

  return {
    ok: true,
    workflow: 'workflow_list_elementor_templates',
    wp_library_templates: libraryResult.status === 'fulfilled' && Array.isArray(libraryResult.value.data)
      ? libraryResult.value.data.map((item) => ({
          id: item.id,
          title: item.title?.raw || item.title?.rendered || null,
          status: item.status,
          slug: item.slug,
          audit: extractElementorAudit(item)
        }))
      : null,
    wp_library_error: libraryResult.status === 'rejected' ? libraryResult.reason : null,
    site_editor_templates: siteEditorResult.status === 'fulfilled' ? siteEditorResult.value.data : null,
    site_editor_error: siteEditorResult.status === 'rejected' ? siteEditorResult.reason : null,
    conditions
  };
}

export async function getElementorTemplateConditionsWorkflow(client, args) {
  const operation = {
    toolName: 'elementor_v1_site_editor_templates_conditions_id_get',
    route: '/elementor/v1/site-editor/templates-conditions/(?P<id>[\\w]+)',
    method: 'GET',
    args: [{ name: 'id', location: 'path' }],
    pathParams: ['id'],
    requestStyle: 'query'
  };
  const result = await client.execute(operation, { id: args.templateId });
  return {
    ok: true,
    workflow: 'workflow_get_elementor_template_conditions',
    templateId: args.templateId,
    conditions: result.data
  };
}

export async function cloneElementorDocumentWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const sourceType = args.sourcePostType || 'posts';
  const sourceOperation = buildWpGetOperation(sourceType, `/wp/v2/${sourceType}/(?P<id>[\\d]+)`, ['id']);
  const { result: sourceResult, contextUsed } = await executeWithEditFallback(client, sourceOperation, { id: args.sourcePostId });
  const source = sourceResult.data;
  const audit = extractElementorAudit(source);

  const steps = [
    'Load the source document with edit context when possible so Elementor meta is available.',
    'Copy the safe WordPress fields and the Elementor meta bundle into a new draft or target post.',
    'Return the cloned document and a fresh Elementor audit for validation.'
  ];
  if (mode === 'plan') {
    return buildWorkflowPlan('workflow_clone_elementor_document', steps, [
      `Source context used during planning: ${contextUsed}.`,
      audit.is_elementor
        ? 'Source appears to be Elementor-authored and can be cloned.'
        : 'Source does not appear to be Elementor-authored; cloning will preserve standard fields only unless Elementor meta becomes available.'
    ]);
  }

  requireWorkflowConfirmation('workflow_clone_elementor_document', args);
  const targetType = args.targetPostType || sourceType;
  const createOperation = {
    toolName: `wp_v2_${targetType}_create`,
    route: `/wp/v2/${targetType}`,
    method: 'POST',
    args: [
      { name: 'title', location: 'body' },
      { name: 'status', location: 'body' },
      { name: 'content', location: 'body' },
      { name: 'excerpt', location: 'body' },
      { name: 'template', location: 'body' },
      { name: 'meta', location: 'body' },
      { name: 'categories', location: 'body' },
      { name: 'tags', location: 'body' }
    ],
    pathParams: [],
    requestStyle: 'json'
  };

  const sourceMeta = source?.meta || {};
  const clonePayload = {
    title: args.title || `${source?.title?.raw || source?.title?.rendered || 'Untitled'} Copy`,
    status: args.status || 'draft',
    content: source?.content?.raw || source?.content?.rendered || '',
    excerpt: source?.excerpt?.raw || source?.excerpt?.rendered || '',
    template: source?.template || undefined,
    meta: {
      _elementor_edit_mode: sourceMeta._elementor_edit_mode,
      _elementor_template_type: sourceMeta._elementor_template_type,
      _elementor_data: sourceMeta._elementor_data,
      _elementor_page_settings: sourceMeta._elementor_page_settings,
      _elementor_conditions: sourceMeta._elementor_conditions
    }
  };
  if (Array.isArray(source?.categories)) clonePayload.categories = source.categories;
  if (Array.isArray(source?.tags)) clonePayload.tags = source.tags;

  const createResult = await client.execute(createOperation, clonePayload);
  return {
    ok: true,
    mode,
    workflow: 'workflow_clone_elementor_document',
    source: {
      postType: sourceType,
      postId: args.sourcePostId,
      contextUsed,
      audit
    },
    clone: {
      postType: targetType,
      post: createResult.data,
      audit: extractElementorAudit(createResult.data)
    }
  };
}

export async function importElementorDocumentMediaWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const inspection = await inspectElementorDocumentWorkflow(client, {
    postType: args.postType,
    postId: args.documentId
  });
  const validation = validateElementorAudit(inspection.elementor);

  const steps = [
    'Inspect the target document and confirm it is Elementor-authored with valid builder data.',
    'Call the Elementor document media-import endpoint for the target document ID.',
    'Re-inspect the document so the caller can compare pre/post validation state.'
  ];

  if (mode === 'plan') {
    return buildWorkflowPlan('workflow_import_elementor_document_media', steps, [
      inspection.elementor.is_elementor
        ? 'Target document appears to be Elementor-authored.'
        : 'Target document does not appear to be Elementor-authored; import should not be executed.',
      validation.ok
        ? 'Preflight validation passed.'
        : `Preflight validation found ${validation.issues.length} issue(s).`
    ]);
  }

  requireWorkflowConfirmation('workflow_import_elementor_document_media', args);
  if (!inspection.elementor.is_elementor) {
    throw {
      kind: 'validation_error',
      message: 'Target document does not appear to be Elementor-authored, so media import was blocked.',
      details: { documentId: args.documentId, postType: args.postType }
    };
  }
  if (!validation.ok) {
    throw {
      kind: 'validation_error',
      message: 'Target document failed Elementor validation, so media import was blocked.',
      details: { documentId: args.documentId, postType: args.postType, validation }
    };
  }

  const importOperation = {
    toolName: 'elementor_v1_documents_id_media_import_create',
    route: '/elementor/v1/documents/(?P<id>\\d+)/media/import',
    method: 'POST',
    args: [{ name: 'id', location: 'path' }],
    pathParams: ['id'],
    requestStyle: 'json'
  };
  const importResult = await client.execute(importOperation, { id: args.documentId });
  const afterInspection = await inspectElementorDocumentWorkflow(client, {
    postType: args.postType,
    postId: args.documentId
  });

  return {
    ok: true,
    mode,
    workflow: 'workflow_import_elementor_document_media',
    before: {
      contextUsed: inspection.contextUsed,
      validation,
      elementor: inspection.elementor
    },
    importResult: importResult.data,
    after: {
      contextUsed: afterInspection.contextUsed,
      validation: validateElementorAudit(afterInspection.elementor),
      elementor: afterInspection.elementor
    }
  };
}

function isLikelyElementorKitAudit(audit) {
  return audit?.template_type === 'kit';
}

function buildElementorLibraryDeleteOperation(includeForceKitDelete = false) {
  return {
    toolName: 'wp_v2_elementor_library_id_delete',
    route: '/wp/v2/elementor_library/(?P<id>[\\d]+)',
    method: 'DELETE',
    pathParams: ['id'],
    requestStyle: 'query',
    args: [
      { name: 'id', location: 'path' },
      { name: 'force', location: 'query' },
      ...(includeForceKitDelete ? [{ name: 'force_delete_kit', location: 'query' }] : [])
    ]
  };
}

function extractKitConfirmationUrl(error) {
  const body =
    typeof error?.responseBody === 'string'
      ? error.responseBody
      : typeof error?.responseBody?.message === 'string'
        ? error.responseBody.message
        : '';
  const hrefMatch = body.match(/href="([^"]*force_delete_kit=1[^"]*)"/i);
  return hrefMatch?.[1]?.replace(/&amp;/g, '&') || null;
}

export async function cleanupElementorKitWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const inspection = await inspectElementorDocumentWorkflow(client, {
    postType: 'elementor_library',
    postId: args.documentId
  });
  const validation = validateElementorAudit(inspection.elementor);
  const isLikelyKit = isLikelyElementorKitAudit(inspection.elementor);

  const steps = [
    'Inspect the Elementor library document and determine whether it looks like a kit/site-settings record.',
    'Attempt the normal forced WordPress delete path first.',
    'Only if Elementor demands a site-settings confirmation flow, decide whether to retry with the explicit kit-delete confirmation flag.'
  ];

  if (mode === 'plan') {
    return {
      ...buildWorkflowPlan('workflow_cleanup_elementor_kit', steps, [
        isLikelyKit
          ? 'Target looks like an Elementor kit or site-settings record, so the special delete-confirmation path may be required.'
          : 'Target does not obviously look like a kit, but Elementor may still intercept deletion on this site.',
        validation.ok
          ? 'Inspection succeeded and Elementor metadata is readable.'
          : `Inspection succeeded but Elementor validation reported ${validation.issues.length} issue(s).`
      ]),
      target: {
        documentId: args.documentId,
        title: inspection.elementor.title,
        status: inspection.elementor.status,
        slug: inspection.elementor.slug,
        templateType: inspection.elementor.template_type
      },
      validation,
      cleanupStrategy: {
        standardDelete: {
          force: true
        },
        forceKitDeleteAvailable: true,
        requiresExplicitOptIn: true,
        likelyNeedsSpecialConfirmation: isLikelyKit
      }
    };
  }

  requireWorkflowConfirmation('workflow_cleanup_elementor_kit', args);

  const standardDeleteOperation = buildElementorLibraryDeleteOperation(false);

  try {
    const deleteResult = await client.execute(standardDeleteOperation, {
      id: args.documentId,
      force: true
    });
    return {
      ok: true,
      mode,
      workflow: 'workflow_cleanup_elementor_kit',
      pathUsed: 'standard_delete',
      target: {
        documentId: args.documentId,
        templateType: inspection.elementor.template_type,
        title: inspection.elementor.title
      },
      validation,
      deleteResult: deleteResult.data
    };
  } catch (error) {
    const responseText =
      typeof error?.responseBody === 'string'
        ? error.responseBody
        : typeof error?.responseBody?.message === 'string'
          ? error.responseBody.message
          : '';
    const detectionText = `${error?.wpCode || error?.responseBody?.code || ''} ${error?.message || ''} ${responseText} ${error?.snippet || ''}`;
    const isKitConfirmationError =
      error?.kind === 'elementor_kit_delete_confirmation' ||
      /cant_delete_kit|delete your site settings|force_delete_kit/i.test(detectionText);

    if (!isKitConfirmationError) {
      throw error;
    }

    if (!args.allowForceKitDelete) {
      throw {
        kind: 'validation_error',
        message:
          'Elementor intercepted the kit delete request with a confirmation flow. The workflow stopped before taking the special-case delete path.',
        details: {
          documentId: args.documentId,
          templateType: inspection.elementor.template_type,
          actionable:
            'Re-run workflow_cleanup_elementor_kit with allowForceKitDelete=true only after confirming this is a disposable Elementor kit or site-settings record.'
        }
      };
    }

    const forcedDeleteOperation = buildElementorLibraryDeleteOperation(true);
    let forcedDeleteResult;
    try {
      forcedDeleteResult = await client.execute(forcedDeleteOperation, {
        id: args.documentId,
        force: true,
        force_delete_kit: 1
      });
    } catch (forcedDeleteError) {
      throw {
        kind: 'validation_error',
        message:
          'Elementor still blocked kit cleanup after the explicit `force_delete_kit` retry. This site appears to require a browser-admin confirmation flow instead of a pure REST delete.',
        details: {
          documentId: args.documentId,
          templateType: inspection.elementor.template_type,
          confirmationUrl: extractKitConfirmationUrl(forcedDeleteError),
          actionable:
            'Open the Elementor admin confirmation URL in a browser session with appropriate privileges, complete the site-settings delete confirmation there, and treat this record as a manual cleanup item.'
        }
      };
    }

    return {
      ok: true,
      mode,
      workflow: 'workflow_cleanup_elementor_kit',
      pathUsed: 'force_delete_kit',
      target: {
        documentId: args.documentId,
        templateType: inspection.elementor.template_type,
        title: inspection.elementor.title
      },
      validation,
      deleteResult: forcedDeleteResult.data
    };
  }
}

export async function draftOrUpdatePostWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const steps = [
    'Validate title, status, and optional existing post identifier.',
    'Resolve categories and tags before any write.',
    'Create or update the post in draft status unless explicit publish intent is provided.'
  ];
  if (mode === 'plan') {
    return buildWorkflowPlan('workflow_draft_or_update_post', steps, [
      'Provide `existingPostId` to force an update instead of create.',
      'Provide category/tag IDs when you want deterministic taxonomy assignment.'
    ]);
  }
  requireWorkflowConfirmation('workflow_draft_or_update_post', args);
  const payload = {
    title: args.title,
    status: args.status || 'draft',
    content: args.content || '',
    excerpt: args.excerpt || '',
    categories: ensureNumericTermIds('categories', args.categories),
    tags: ensureNumericTermIds('tags', args.tags)
  };
  const operation = args.existingPostId
    ? {
        toolName: 'wp_v2_posts_id_update',
        route: '/wp/v2/posts/(?P<id>[\\d]+)',
        method: 'POST',
        args: [
          { name: 'id', location: 'path' },
          { name: 'title', location: 'body' },
          { name: 'status', location: 'body' },
          { name: 'content', location: 'body' },
          { name: 'excerpt', location: 'body' },
          { name: 'categories', location: 'body' },
          { name: 'tags', location: 'body' }
        ],
        pathParams: ['id'],
        requestStyle: 'json'
      }
    : {
        toolName: 'wp_v2_posts_create',
        route: '/wp/v2/posts',
        method: 'POST',
        args: [
          { name: 'title', location: 'body' },
          { name: 'status', location: 'body' },
          { name: 'content', location: 'body' },
          { name: 'excerpt', location: 'body' },
          { name: 'categories', location: 'body' },
          { name: 'tags', location: 'body' }
        ],
        pathParams: [],
        requestStyle: 'json'
      };

  const result = await client.execute(operation, {
    ...(args.existingPostId ? { id: args.existingPostId } : {}),
    ...payload
  });
  return {
    ok: true,
    mode,
    workflow: 'workflow_draft_or_update_post',
    data: result.data
  };
}

export async function mediaFeaturedImageWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const steps = [
    'Validate the media file path before upload.',
    'Upload the media asset to WordPress.',
    'Attach the uploaded media ID as the post featured image.'
  ];
  if (mode === 'plan') return buildWorkflowPlan('workflow_media_featured_image', steps);
  requireWorkflowConfirmation('workflow_media_featured_image', args);
  const uploadResult = await client.execute(
    {
      toolName: 'wp_v2_media_create',
      route: '/wp/v2/media',
      method: 'POST',
      args: [
        { name: 'filePath', location: 'body', isFilePath: true },
        { name: 'title', location: 'body' }
      ],
      pathParams: [],
      requestStyle: 'media-upload'
    },
    { filePath: args.filePath, title: args.title || undefined }
  );
  const attachResult = await client.execute(
    {
      toolName: 'wp_v2_posts_id_update',
      route: '/wp/v2/posts/(?P<id>[\\d]+)',
      method: 'POST',
      args: [
        { name: 'id', location: 'path' },
        { name: 'featured_media', location: 'body' }
      ],
      pathParams: ['id'],
      requestStyle: 'json'
    },
    { id: args.postId, featured_media: uploadResult.data?.id }
  );
  return {
    ok: true,
    mode,
    workflow: 'workflow_media_featured_image',
    media: uploadResult.data,
    post: attachResult.data
  };
}

export async function taxonomyReconcileWorkflow(client, args) {
  const categorySearch = {
    toolName: 'wp_v2_categories_list',
    route: '/wp/v2/categories',
    method: 'GET',
    args: [
      { name: 'search', location: 'query' },
      { name: 'per_page', location: 'query' }
    ],
    pathParams: [],
    requestStyle: 'query'
  };
  const tagSearch = {
    toolName: 'wp_v2_tags_list',
    route: '/wp/v2/tags',
    method: 'GET',
    args: [
      { name: 'search', location: 'query' },
      { name: 'per_page', location: 'query' }
    ],
    pathParams: [],
    requestStyle: 'query'
  };

  const categories = [];
  for (const category of normalizeTerms(args.categories)) {
    const result = await client.execute(categorySearch, { search: category, per_page: 20 });
    categories.push({ query: category, matches: result.data });
  }

  const tags = [];
  for (const tag of normalizeTerms(args.tags)) {
    const result = await client.execute(tagSearch, { search: tag, per_page: 20 });
    tags.push({ query: tag, matches: result.data });
  }

  return {
    ok: true,
    workflow: 'workflow_taxonomy_reconcile',
    categories,
    tags
  };
}

export async function nexportBlogPostWorkflow(client, args) {
  const mode = args.mode || 'plan';
  const steps = [
    'Validate NexPort draft defaults: draft status and `elementor_theme` template.',
    'Map categories conservatively and tags more freely based on the NexPort publishing guidance.',
    'Keep Elementor assumptions optional and verify them after write using post inspection.'
  ];
  if (mode === 'plan') {
    return buildWorkflowPlan('workflow_nexport_blog_post', steps, [
      'Default categories for release posts: Latest News and release-announcement.',
      'Default tags for NexPort Campus beta-style posts: nexport-campus, 7-0-0, beta.'
    ]);
  }
  requireWorkflowConfirmation('workflow_nexport_blog_post', args);
  const postResult = await draftOrUpdatePostWorkflow(client, {
    ...args,
    categories: args.categories,
    tags: args.tags
  });
  let mediaResult = null;
  if (args.filePath) {
    mediaResult = await mediaFeaturedImageWorkflow(client, {
      mode: 'execute',
      confirm: true,
      postId: postResult.data?.id,
      filePath: args.filePath,
      title: args.title
    });
  }
  return {
    ok: true,
    mode,
    workflow: 'workflow_nexport_blog_post',
    post: postResult.data,
    media: mediaResult?.media || null,
    postAfterMedia: mediaResult?.post || null,
    template: args.template || 'elementor_theme'
  };
}

export function validateSlugOrTitleArgs(args) {
  if (!args.postId && !args.slug && !args.title) {
    throw {
      kind: 'validation_error',
      message: 'Provide at least one post selector: postId, slug, or title.',
      details: { provided: Object.keys(args || {}) }
    };
  }
}

export function validateFilePath(filePath) {
  if (filePath && !fs.existsSync(filePath)) {
    throw {
      kind: 'validation_error',
      message: `File not found: ${filePath}`,
      details: { filePath }
    };
  }
}
