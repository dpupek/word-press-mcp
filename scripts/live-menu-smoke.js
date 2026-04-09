import { getConfig, hasAuth } from '../src/config.js';
import { translateWpError } from '../src/error-translation.js';
import { createLogger } from '../src/logger.js';
import { createWpClient } from '../src/wp-client.js';
import {
  assignMenuLocationsWorkflow,
  cloneMenuWorkflow,
  listMenuStructureWorkflow,
  reorderMenuItemsWorkflow,
  upsertMenuItemWorkflow
} from '../src/workflows.js';

function requireAuth(config) {
  if (hasAuth(config)) return;
  throw new Error('Set WP_USERNAME and WP_APP_PASSWORD before running the live menu smoke script.');
}

function buildOperation({ toolName, route, method, args, pathParams = [], requestStyle }) {
  return { toolName, route, method, args, pathParams, requestStyle };
}

function safeError(error, context) {
  return translateWpError(error, context);
}

const config = getConfig();
requireAuth(config);

const logger = createLogger(config);
const client = createWpClient(config, logger);
const stamp = Date.now();

const createMenuOperation = buildOperation({
  toolName: 'wp_v2_menus_create',
  route: '/wp/v2/menus',
  method: 'POST',
  requestStyle: 'json',
  args: [
    { name: 'name', location: 'body' },
    { name: 'slug', location: 'body' },
    { name: 'description', location: 'body' }
  ]
});

const deleteMenuOperation = buildOperation({
  toolName: 'wp_v2_menus_id_delete',
  route: '/wp/v2/menus/(?P<id>[\\d]+)',
  method: 'DELETE',
  pathParams: ['id'],
  requestStyle: 'query',
  args: [
    { name: 'id', location: 'path' },
    { name: 'force', location: 'query' }
  ]
});

const result = {
  ok: true,
  siteUrl: config.siteUrl,
  allowInsecureTls: config.allowInsecureTls,
  stamp,
  steps: []
};

let sourceMenuId = null;
let cloneMenuId = null;

try {
  const createdMenu = await client.execute(createMenuOperation, {
    name: `Codex Disposable Menu ${stamp}`,
    slug: `codex-disposable-menu-${stamp}`,
    description: 'Disposable menu for live workflow validation.'
  });
  sourceMenuId = createdMenu.data?.id;
  result.steps.push({
    step: 'create_menu',
    ok: true,
    menu: {
      id: sourceMenuId,
      name: createdMenu.data?.name,
      slug: createdMenu.data?.slug
    }
  });

  const alphaItem = await upsertMenuItemWorkflow(client, {
    mode: 'execute',
    confirm: true,
    menuId: sourceMenuId,
    type: 'custom',
    title: 'Alpha',
    url: 'https://test.nexportsolutions.com/alpha',
    menuOrder: 1
  });
  const betaItem = await upsertMenuItemWorkflow(client, {
    mode: 'execute',
    confirm: true,
    menuId: sourceMenuId,
    type: 'custom',
    title: 'Beta',
    url: 'https://test.nexportsolutions.com/beta',
    menuOrder: 2
  });
  result.steps.push({
    step: 'seed_menu_items',
    ok: true,
    items: [
      { id: alphaItem.item?.id, title: alphaItem.item?.title },
      { id: betaItem.item?.id, title: betaItem.item?.title }
    ]
  });

  const structureBefore = await listMenuStructureWorkflow(client, { menuId: sourceMenuId });
  result.steps.push({
    step: 'list_menu_structure',
    ok: true,
    tree: structureBefore.tree
  });

  const alphaNode = structureBefore.tree.find((node) => node.title === 'Alpha');
  const betaNode = structureBefore.tree.find((node) => node.title === 'Beta');
  const reordered = await reorderMenuItemsWorkflow(client, {
    mode: 'execute',
    confirm: true,
    menuId: sourceMenuId,
    tree: [
      {
        itemId: betaNode.id,
        children: [
          {
            itemId: alphaNode.id
          }
        ]
      }
    ]
  });
  result.steps.push({
    step: 'reorder_menu_items',
    ok: true,
    changes: reordered.changes,
    tree: reordered.tree
  });

  const cloned = await cloneMenuWorkflow(client, {
    mode: 'execute',
    confirm: true,
    sourceMenuId,
    targetName: `Codex Cloned Menu ${stamp}`,
    targetSlug: `codex-cloned-menu-${stamp}`
  });
  cloneMenuId = cloned.targetMenu?.id;
  result.steps.push({
    step: 'clone_menu',
    ok: true,
    targetMenu: cloned.targetMenu,
    clonedItems: cloned.clonedItems,
    tree: cloned.tree
  });

  const locationPlan = await assignMenuLocationsWorkflow(client, {
    mode: 'plan',
    menuId: sourceMenuId,
    locations: structureBefore.menu.locations || []
  });
  result.steps.push({
    step: 'menu_location_plan',
    ok: true,
    availableLocations: locationPlan.availableLocations,
    notes: locationPlan.notes
  });
} catch (error) {
  result.ok = false;
  result.error = safeError(error);
} finally {
  const cleanup = [];

  for (const id of [cloneMenuId, sourceMenuId].filter(Boolean)) {
    try {
      await client.execute(deleteMenuOperation, { id, force: true });
      cleanup.push({ target: 'menu', id, ok: true });
    } catch (error) {
      cleanup.push({
        target: 'menu',
        id,
        ok: false,
        error: safeError(error, { route: deleteMenuOperation.route, method: deleteMenuOperation.method })
      });
    }
  }

  result.cleanup = cleanup;
}

console.log(JSON.stringify(result, null, 2));
