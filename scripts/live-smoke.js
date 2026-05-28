import { getConfig, hasAuth } from '../src/config.js';
import { translateWpError } from '../src/error-translation.js';
import { createLogger } from '../src/logger.js';
import { createWpClient } from '../src/wp-client.js';
import {
  cloneElementorDocumentWorkflow,
  cleanupElementorKitWorkflow,
  getPostUrlsWorkflow,
  getSiteCapabilitiesWorkflow,
  importElementorDocumentMediaWorkflow,
  inspectElementorDocumentWorkflow,
  publishAndVerifyElementorPageWorkflow,
  restoreElementorCandidateWorkflow
} from '../src/workflows.js';
import { findElementById, parseElementorDocument } from '../src/elementor-document.js';

function requireAuth(config) {
  if (hasAuth(config)) return;
  throw new Error('Set WP_USERNAME and WP_APP_PASSWORD before running the live smoke script.');
}

function buildOperation({ toolName, route, method, args, pathParams = [], requestStyle }) {
  return { toolName, route, method, args, pathParams, requestStyle };
}

function safeError(error, context) {
  return translateWpError(error, context);
}

function findFirstWidgetIdByType(elements, widgetType) {
  if (!Array.isArray(elements)) return null;
  for (const element of elements) {
    if (element?.elType === 'widget' && element?.widgetType === widgetType && element?.id) {
      return element.id;
    }
    const childMatch = findFirstWidgetIdByType(element?.elements, widgetType);
    if (childMatch) return childMatch;
  }
  return null;
}

const config = getConfig();
requireAuth(config);

const logger = createLogger(config);
const client = createWpClient(config, logger);
const stamp = Date.now();
const smokeElementorSourcePageId = Number(process.env.WORDPRESS_MCP_SMOKE_ELEMENTOR_SOURCE_PAGE_ID || 0) || null;

const createPostOperation = buildOperation({
  toolName: 'wp_v2_posts_create',
  route: '/wp/v2/posts',
  method: 'POST',
  requestStyle: 'json',
  args: [
    { name: 'title', location: 'body' },
    { name: 'status', location: 'body' },
    { name: 'content', location: 'body' },
    { name: 'excerpt', location: 'body' }
  ]
});

const deletePostOperation = buildOperation({
  toolName: 'wp_v2_posts_id_delete',
  route: '/wp/v2/posts/(?P<id>[\\d]+)',
  method: 'DELETE',
  pathParams: ['id'],
  requestStyle: 'query',
  args: [
    { name: 'id', location: 'path' },
    { name: 'force', location: 'query' }
  ]
});

const deletePageOperation = buildOperation({
  toolName: 'wp_v2_pages_id_delete',
  route: '/wp/v2/pages/(?P<id>[\\d]+)',
  method: 'DELETE',
  pathParams: ['id'],
  requestStyle: 'query',
  args: [
    { name: 'id', location: 'path' },
    { name: 'force', location: 'query' }
  ]
});

const updateTemplateOperation = buildOperation({
  toolName: 'wp_v2_elementor_library_id_update',
  route: '/wp/v2/elementor_library/(?P<id>[\\d]+)',
  method: 'POST',
  pathParams: ['id'],
  requestStyle: 'json',
  args: [
    { name: 'id', location: 'path' },
    { name: 'title', location: 'body' },
    { name: 'status', location: 'body' },
    { name: 'content', location: 'body' },
    { name: 'excerpt', location: 'body' },
    { name: 'template', location: 'body' },
    { name: 'meta', location: 'body' }
  ]
});

const revisionsOperation = buildOperation({
  toolName: 'wp_v2_elementor_library_parent_revisions_get',
  route: '/wp/v2/elementor_library/(?P<parent>[\\d]+)/revisions',
  method: 'GET',
  pathParams: ['parent'],
  requestStyle: 'query',
  args: [
    { name: 'parent', location: 'path' },
    { name: 'context', location: 'query' },
    { name: 'per_page', location: 'query' }
  ]
});

const result = {
  ok: true,
  siteUrl: config.siteUrl,
  allowInsecureTls: config.allowInsecureTls,
  stamp,
  steps: []
};

let publishedPostId = null;
let templateCloneId = null;
let publishedPageCloneId = null;

try {
  const siteCapabilities = await getSiteCapabilitiesWorkflow(client, config);
  result.steps.push({
    step: 'site_capabilities',
    ok: true,
    capabilities: siteCapabilities.capabilities,
    blockedRoutes: siteCapabilities.blockedRoutes
  });

  const publishedPost = await client.execute(createPostOperation, {
    title: `Codex Live Smoke Post ${stamp}`,
    status: 'publish',
    content:
      '<h2>Codex Live Smoke</h2><p>This disposable post was created to validate WordPress MCP publishing and browser rendering.</p>',
    excerpt: 'Disposable smoke-test post.'
  });
  publishedPostId = publishedPost.data?.id;
  result.steps.push({
    step: 'create_published_post',
    ok: true,
    post: {
      id: publishedPost.data?.id,
      slug: publishedPost.data?.slug,
      status: publishedPost.data?.status,
      link: publishedPost.data?.link
    }
  });

  const clone = await cloneElementorDocumentWorkflow(client, {
    mode: 'execute',
    confirm: true,
    sourcePostType: 'elementor_library',
    sourcePostId: 3,
    targetPostType: 'elementor_library',
    title: `Codex Restore Smoke ${stamp}`,
    status: 'draft'
  });
  templateCloneId = clone.clone?.post?.id;
  result.steps.push({
    step: 'clone_elementor_template',
    ok: true,
    clone: {
      id: templateCloneId,
      title: clone.clone?.post?.title?.raw || clone.clone?.post?.title?.rendered || null,
      status: clone.clone?.post?.status,
      audit: clone.clone?.audit
    }
  });

  const clonePost = clone.clone?.post;
  const cloneMeta = clonePost?.meta || {};
  for (const revisionTitle of [`Codex Restore Smoke ${stamp} Rev A`, `Codex Restore Smoke ${stamp} Rev B`]) {
    await client.execute(updateTemplateOperation, {
      id: templateCloneId,
      title: revisionTitle,
      status: clonePost?.status || 'draft',
      content: clonePost?.content?.raw || clonePost?.content?.rendered || '',
      excerpt: clonePost?.excerpt?.raw || clonePost?.excerpt?.rendered || '',
      template: clonePost?.template || '',
      meta: cloneMeta
    });
  }

  const revisions = await client.execute(revisionsOperation, {
    parent: templateCloneId,
    context: 'edit',
    per_page: 10
  });
  const revisionList = Array.isArray(revisions.data)
    ? revisions.data.map((item) => ({
        id: item.id,
        title: item.title?.raw || item.title?.rendered || null
      }))
    : [];
  result.steps.push({
    step: 'list_template_revisions',
    ok: true,
    revisions: revisionList
  });

  if (revisionList.length === 0) {
    throw new Error('The live smoke script did not produce any Elementor revisions to restore.');
  }

  const candidateId = revisionList[0].id;
  const restorePlan = await restoreElementorCandidateWorkflow(client, {
    mode: 'plan',
    postType: 'elementor_library',
    targetPostId: templateCloneId,
    candidateKind: 'revision',
    candidateId
  });
  result.steps.push({
    step: 'restore_plan',
    ok: true,
    candidateId,
    recommendation: restorePlan.recommendation,
    candidateValidation: restorePlan.candidate?.validation
  });

  const restoreExecute = await restoreElementorCandidateWorkflow(client, {
    mode: 'execute',
    confirm: true,
    postType: 'elementor_library',
    targetPostId: templateCloneId,
    candidateKind: 'revision',
    candidateId
  });
  result.steps.push({
    step: 'restore_execute',
    ok: true,
    restoredTitle:
      restoreExecute.restoreResult?.title?.raw || restoreExecute.restoreResult?.title?.rendered || null,
    recommendation: restoreExecute.recommendation,
    afterValidation: restoreExecute.after?.validation
  });

  try {
    const mediaImport = await importElementorDocumentMediaWorkflow(client, {
      mode: 'execute',
      confirm: true,
      postType: 'elementor_library',
      documentId: templateCloneId
    });
    result.steps.push({
      step: 'media_import_execute',
      ok: true,
      importResult: mediaImport.importResult,
      afterValidation: mediaImport.after?.validation
    });
  } catch (error) {
    result.steps.push({
      step: 'media_import_execute',
      ok: false,
      error: safeError(error, {
        route: '/elementor/v1/documents/(?P<id>\\d+)/media/import',
        method: 'POST'
      })
    });
  }

  if (smokeElementorSourcePageId) {
    const pageClone = await cloneElementorDocumentWorkflow(client, {
      mode: 'execute',
      confirm: true,
      sourcePostType: 'pages',
      sourcePostId: smokeElementorSourcePageId,
      targetPostType: 'pages',
      title: `Codex Elementor Smoke Page ${stamp}`,
      status: 'publish'
    });
    publishedPageCloneId = pageClone.clone?.post?.id;
    const clonedInspection = await inspectElementorDocumentWorkflow(client, {
      postType: 'pages',
      postId: publishedPageCloneId
    });
    const parsed = parseElementorDocument(clonedInspection.document?.meta?._elementor_data);
    const headingId = findElementById(parsed.elements, 'heading')?.element?.id || findFirstWidgetIdByType(parsed.elements, 'heading');

    if (!headingId) {
      throw new Error('Optional Elementor page smoke could not find a heading widget to patch.');
    }

    const pageUrls = await getPostUrlsWorkflow(client, config, {
      postType: 'pages',
      postId: publishedPageCloneId
    });
    const pageLiveUrl = pageUrls.urls.publicUrl || pageUrls.urls.previewUrl;
    const widgetTitle = `Codex Elementor Smoke Heading ${stamp}`;
    const publishVerify = await publishAndVerifyElementorPageWorkflow(client, config, {
      mode: 'execute',
      confirm: true,
      postType: 'pages',
      postId: publishedPageCloneId,
      update: {
        type: 'widget',
        widgetId: headingId,
        expectedWidgetType: 'heading',
        settingsPatch: {
          title: widgetTitle
        }
      },
      purgeCache: true,
      liveUrl: pageLiveUrl,
      expectedText: [widgetTitle]
    });
    result.steps.push({
      step: 'publish_and_verify_elementor_page',
      ok: publishVerify.ok,
      pageId: publishedPageCloneId,
      liveUrl: pageLiveUrl,
      storedUpdated: publishVerify.storedUpdated,
      cachePurged: publishVerify.cachePurged,
      liveUpdated: publishVerify.liveUpdated,
      verification: publishVerify.verification
    });
  }
} catch (error) {
  result.ok = false;
  result.error = safeError(error);
} finally {
  const cleanup = [];

  if (publishedPostId) {
    try {
      await client.execute(deletePostOperation, { id: publishedPostId, force: true });
      cleanup.push({ target: 'published_post', id: publishedPostId, ok: true });
    } catch (error) {
      cleanup.push({
        target: 'published_post',
        id: publishedPostId,
        ok: false,
        error: safeError(error, { route: deletePostOperation.route, method: deletePostOperation.method })
      });
    }
  }

  if (templateCloneId) {
    try {
      const cleanupResult = await cleanupElementorKitWorkflow(client, {
        mode: 'execute',
        confirm: true,
        documentId: templateCloneId,
        allowForceKitDelete: true
      });
      cleanup.push({
        target: 'elementor_library',
        id: templateCloneId,
        ok: true,
        pathUsed: cleanupResult.pathUsed
      });
    } catch (error) {
      cleanup.push({
        target: 'elementor_library',
        id: templateCloneId,
        ok: false,
        error: safeError(error, {
          route: '/wp/v2/elementor_library/(?P<id>[\\d]+)',
          method: 'DELETE'
        })
      });
    }
  }

  if (publishedPageCloneId) {
    try {
      await client.execute(deletePageOperation, { id: publishedPageCloneId, force: true });
      cleanup.push({ target: 'published_page', id: publishedPageCloneId, ok: true });
    } catch (error) {
      cleanup.push({
        target: 'published_page',
        id: publishedPageCloneId,
        ok: false,
        error: safeError(error, { route: deletePageOperation.route, method: deletePageOperation.method })
      });
    }
  }

  result.cleanup = cleanup;
}

console.log(JSON.stringify(result, null, 2));
