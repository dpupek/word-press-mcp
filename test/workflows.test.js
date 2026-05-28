import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignMenuLocationsWorkflow,
  cleanupElementorKitWorkflow,
  cloneElementorDocumentWorkflow,
  cloneMenuWorkflow,
  draftOrUpdatePostWorkflow,
  diffElementorDocumentsWorkflow,
  getPostUrlsWorkflow,
  getLiveRenderStateWorkflow,
  getSiteCapabilitiesWorkflow,
  getSiteIdentityWorkflow,
  importElementorDocumentMediaWorkflow,
  inspectElementorHistoryWorkflow,
  listMenuStructureWorkflow,
  nexportBlogPostWorkflow,
  patchElementorDocumentWorkflow,
  publishAndVerifyElementorPageWorkflow,
  reorderMenuItemsWorkflow,
  restoreElementorCandidateWorkflow,
  updateElementorWidgetWorkflow,
  upsertMenuItemWorkflow,
  validateElementorDocumentWorkflow
} from '../src/workflows.js';

const fakeClient = {
  async execute(operation, payload) {
    const elementorMeta = {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_data: JSON.stringify([{ id: 'root', elType: 'container', elements: [] }]),
      _elementor_page_settings: JSON.stringify({ hide_title: 'yes' }),
      _elementor_conditions: JSON.stringify([])
    };
    return {
      data: {
        id: payload.id || 101,
        operation: operation.toolName,
        title: { raw: payload.title || 'Source Title', rendered: payload.title || 'Source Title' },
        content: { raw: payload.content || '<p>Hello</p>', rendered: payload.content || '<p>Hello</p>' },
        excerpt: { raw: payload.excerpt || 'Excerpt', rendered: payload.excerpt || 'Excerpt' },
        status: payload.status || 'draft',
        slug: payload.slug || 'source-title',
        type: payload.type || 'page',
        template: payload.template || 'elementor_theme',
        meta: payload.meta || elementorMeta,
        categories: payload.categories || [1],
        tags: payload.tags || [2],
        ...payload
      }
    };
  }
};

const fakeConfig = {
  siteUrl: 'https://example.com'
};

function createMutableElementorClient() {
  const state = {
    id: 44,
    type: 'page',
    status: 'draft',
    slug: 'sample-page',
    link: 'https://example.com/sample-page/',
    title: { raw: 'Sample Page', rendered: 'Sample Page' },
    content: { raw: '<p>Stored body</p>', rendered: '<div>REST body</div>' },
    excerpt: { raw: 'Stored excerpt', rendered: 'Stored excerpt' },
    template: 'elementor_theme',
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_data: JSON.stringify([
        {
          id: 'hero',
          elType: 'container',
          settings: { background_background: 'classic' },
          elements: [
            {
              id: 'heading',
              elType: 'widget',
              widgetType: 'heading',
              settings: {
                title: 'Hero Title',
                title_color: '#111111',
                __globals__: { title_color: 'globals/colors?id=primary' }
              },
              elements: []
            }
          ]
        }
      ]),
      _elementor_page_settings: JSON.stringify({ hide_title: 'yes' }),
      _elementor_conditions: JSON.stringify([])
    }
  };
  const calls = [];

  return {
    calls,
    state,
    async healthCheck() {
      return {
        siteUrl: 'https://example.com',
        routeCount: 501,
        namespaces: ['wp/v2', 'elementor/v1', 'wp-site-health/v1'],
        auth: { ok: true, statusCode: 200, user: 'admin' }
      };
    },
    async execute(operation, payload) {
      calls.push({ operation, payload });

      if (operation.route === '/') {
        return {
          data: {
            name: 'Example Site',
            home: 'https://example.com',
            routes: {
              '/wp/v2/pages/(?P<id>[\\d]+)': {},
              '/wp/v2/settings': {},
              '/wp/v2/users/me': {},
              '/elementor/v1/cache': {},
              '/elementor/v1/post': {},
              '/elementor/v1/site-editor/templates': {},
              '/wp-site-health/v1/tests/page-cache': {}
            }
          }
        };
      }

      if (operation.route === '/wp/v2/settings') {
        return {
          data: {
            title: 'Example Site',
            description: 'Example description',
            url: 'https://example.com'
          }
        };
      }

      if (operation.route === '/wp/v2/users/me') {
        return {
          data: {
            id: 7,
            slug: 'admin',
            name: 'Admin User'
          }
        };
      }

      if (operation.toolName === 'elementor_v1_cache_delete') {
        return {
          data: {
            success: true
          }
        };
      }

      if (operation.route === '/wp-site-health/v1/tests/page-cache') {
        return {
          data: {
            label: 'Page cache is working'
          }
        };
      }

      if (operation.route === '/elementor/v1/post') {
        throw {
          kind: 'permission_error',
          statusCode: 403,
          responseBody: { code: 'rest_forbidden', message: 'Forbidden' }
        };
      }

      if (operation.route === '/elementor/v1/site-editor/templates') {
        return {
          data: [
            {
              id: 'template-1',
              title: 'Header Template'
            }
          ]
        };
      }

      if (operation.route === '/wp/v2/pages/(?P<id>[\\d]+)' && operation.method === 'GET') {
        return {
          requestUrl: `https://example.com/wp-json/wp/v2/pages/${payload.id}?context=edit`,
          data: JSON.parse(JSON.stringify(state))
        };
      }

      if (operation.route === '/wp/v2/pages/(?P<id>[\\d]+)' && operation.method === 'POST') {
        if (payload.title) {
          state.title = { raw: payload.title, rendered: payload.title };
        }
        if (payload.content) {
          state.content.raw = payload.content;
        }
        if (payload.meta) {
          state.meta = { ...state.meta, ...payload.meta };
        }
        return {
          data: JSON.parse(JSON.stringify(state))
        };
      }

      throw new Error(`Unexpected mutable Elementor operation: ${operation.toolName} ${operation.route}`);
    }
  };
}

const fakeMenuClient = {
  nextCreatedMenuItemId: 200,
  async execute(operation, payload) {
    if (operation.toolName === 'wp_v2_menus_create') {
      return {
        data: {
          id: 27,
          name: payload.name,
          slug: payload.slug || 'main-menu-copy',
          description: payload.description || null,
          locations: [],
          auto_add: false
        }
      };
    }

    if (operation.toolName === 'wp_v2_menu_locations_list') {
      return {
        data: [
          { name: 'primary', menu: 7 },
          { name: 'footer', menu: 0 }
        ]
      };
    }

    if (operation.toolName === 'wp_v2_menus_id_get') {
      return {
        data: {
          id: payload.id,
          name: 'Main Menu',
          slug: 'main-menu',
          description: 'Main navigation',
          locations: ['primary'],
          auto_add: false
        }
      };
    }

    if (operation.toolName === 'wp_v2_menu_items_list') {
      return {
        data: [
          {
            id: 101,
            title: { rendered: 'Home' },
            type: 'custom',
            url: 'https://example.com/',
            parent: 0,
            menu_order: 1
          },
          {
            id: 102,
            title: { rendered: 'Docs' },
            type: 'custom',
            url: 'https://example.com/docs',
            parent: 0,
            menu_order: 2
          },
          {
            id: 103,
            title: { rendered: 'API' },
            type: 'custom',
            url: 'https://example.com/docs/api',
            parent: 102,
            menu_order: 3
          }
        ]
      };
    }

    if (operation.toolName === 'wp_v2_menu_items_create' || operation.toolName === 'wp_v2_menu_items_id_update_post') {
      if (operation.toolName === 'wp_v2_menu_items_create') {
        this.nextCreatedMenuItemId += 1;
      }
      return {
        data: {
          id: payload.id || this.nextCreatedMenuItemId,
          title: payload.title,
          type: payload.type,
          menus: payload.menus,
          parent: payload.parent || 0,
          menu_order: payload.menu_order || 0,
          url: payload.url || null
        }
      };
    }

    if (operation.toolName === 'wp_v2_menus_id_update_post') {
      return {
        data: {
          id: payload.id,
          locations: payload.locations,
          name: 'Main Menu'
        }
      };
    }

    throw new Error(`Unexpected fake menu operation: ${operation.toolName}`);
  }
};

test('draftOrUpdatePostWorkflow: returns plan steps in plan mode', async () => {
  // Arrange
  const args = { mode: 'plan', title: 'Example' };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await draftOrUpdatePostWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.mode, 'plan');
  assert.ok(result.steps.length >= 3);
});

test('getPostUrlsWorkflow: returns a public URL for published posts', async () => {
  // Arrange
  const args = { postType: 'posts', postId: 44 };
  const publishedClient = {
    async execute(operation, payload) {
      return {
        requestUrl: `https://example.com/wp-json/wp/v2/posts/${payload.id}?context=edit`,
        data: {
          id: payload.id,
          type: 'post',
          status: 'publish',
          slug: 'published-post',
          link: 'https://example.com/2026/04/09/published-post/',
          title: { raw: 'Published Post', rendered: 'Published Post' }
        }
      };
    }
  };

  // Assert (initial)
  assert.equal(args.postType, 'posts');

  // Act
  const result = await getPostUrlsWorkflow(publishedClient, fakeConfig, args);

  // Assert
  assert.equal(result.workflow, 'workflow_get_post_urls');
  assert.equal(result.urls.publicUrl, 'https://example.com/2026/04/09/published-post/');
  assert.equal(result.urls.isPublished, true);
});

test('getPostUrlsWorkflow: derives a preview URL for draft pages', async () => {
  // Arrange
  const args = { postType: 'pages', postId: 51 };
  const draftPageClient = {
    async execute(operation, payload) {
      return {
        requestUrl: `https://example.com/wp-json/wp/v2/pages/${payload.id}?context=edit`,
        data: {
          id: payload.id,
          type: 'page',
          status: 'draft',
          slug: 'draft-page',
          title: { raw: 'Draft Page', rendered: 'Draft Page' }
        }
      };
    }
  };

  // Assert (initial)
  assert.equal(args.postId, 51);

  // Act
  const result = await getPostUrlsWorkflow(draftPageClient, fakeConfig, args);

  // Assert
  assert.equal(result.urls.publicUrl, null);
  assert.match(result.urls.previewUrl, /\?page_id=51/);
  assert.match(result.urls.previewUrl, /preview=true/);
  assert.equal(result.urls.isPublished, false);
  assert.ok(result.urls.notes.some((note) => /authenticated browser session/i.test(note)));
});

test('getSiteIdentityWorkflow: returns normalized site identity and capability hints', async () => {
  // Arrange
  const config = { siteUrl: 'https://example.com' };
  const identityClient = {
    async healthCheck() {
      return {
        siteUrl: 'https://example.com',
        routeCount: 501,
        namespaces: ['wp/v2', 'elementor/v1'],
        auth: { ok: true, statusCode: 200, user: 'admin' }
      };
    },
    async execute(operation, payload) {
      if (operation.route === '/') {
        return {
          data: {
            name: 'Example Site',
            home: 'https://example.com',
            url: 'http://example.com',
            routes: {
              '/wp/v2/posts': {},
              '/wp/v2/menu-items': {},
              '/wp/v2/menus': {}
            }
          }
        };
      }

      if (operation.route === '/wp/v2/settings') {
        return {
          data: {
            title: 'Example Site',
            description: 'Example Description',
            url: 'https://example.com',
            language: 'en_US',
            timezone: 'America/Chicago'
          }
        };
      }

      if (operation.route === '/wp/v2/users/me') {
        return {
          data: {
            id: 9,
            slug: 'admin',
            name: 'Admin User',
            url: 'https://example.com/author/admin'
          }
        };
      }

      throw new Error(`Unexpected identity operation: ${operation.route} ${payload?.context || ''}`);
    }
  };

  // Assert (initial)
  assert.equal(config.siteUrl, 'https://example.com');

  // Act
  const result = await getSiteIdentityWorkflow(identityClient, config);

  // Assert
  assert.equal(result.workflow, 'workflow_get_site_identity');
  assert.equal(result.site.title, 'Example Site');
  assert.equal(result.site.siteUrl, 'https://example.com');
  assert.equal(result.site.reportedSiteUrl, 'https://example.com');
  assert.equal(result.currentUser.slug, 'admin');
  assert.equal(result.capabilities.authenticated, true);
  assert.equal(result.capabilities.hasElementor, true);
  assert.equal(result.capabilities.hasClassicMenus, true);
});

test('getSiteIdentityWorkflow: does not claim classic menus when routes are absent', async () => {
  // Arrange
  const config = { siteUrl: 'https://example.com' };
  const identityClient = {
    async healthCheck() {
      return {
        siteUrl: 'https://example.com',
        routeCount: 100,
        namespaces: ['wp/v2'],
        auth: { ok: false, statusCode: 401, user: null }
      };
    },
    async execute(operation) {
      if (operation.route === '/') {
        return {
          data: {
            name: 'Example Site',
            url: 'http://example.com',
            routes: {
              '/wp/v2/posts': {},
              '/wp/v2/pages': {}
            }
          }
        };
      }

      throw new Error(`Unexpected identity operation: ${operation.route}`);
    }
  };

  // Assert (initial)
  assert.equal(config.siteUrl, 'https://example.com');

  // Act
  const result = await getSiteIdentityWorkflow(identityClient, config);

  // Assert
  assert.equal(result.site.siteUrl, 'https://example.com');
  assert.equal(result.site.reportedSiteUrl, 'http://example.com');
  assert.equal(result.capabilities.hasClassicMenus, false);
});

test('getSiteCapabilitiesWorkflow: reports route availability, active capability probes, and blocked routes', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();

  // Assert (initial)
  assert.equal(capabilityClient.calls.length, 0);

  // Act
  const result = await getSiteCapabilitiesWorkflow(capabilityClient, fakeConfig);

  // Assert
  assert.equal(result.workflow, 'workflow_get_site_capabilities');
  assert.equal(result.capabilities.canReadEditContext, true);
  assert.equal(result.capabilities.canPurgeElementorCache, true);
  assert.equal(result.capabilities.canUseElementorPostEndpoint, false);
  assert.equal(result.capabilities.canManageElementorTemplates, true);
  assert.ok(result.blockedRoutes.some((route) => route.route === '/elementor/v1/post'));
});

test('getSiteCapabilitiesWorkflow: does not claim page writes when the write probe is forbidden', async () => {
  // Arrange
  const readOnlyClient = createMutableElementorClient();
  const originalExecute = readOnlyClient.execute.bind(readOnlyClient);
  readOnlyClient.execute = async (operation, payload) => {
    if (operation.route === '/wp/v2/pages/(?P<id>[\\d]+)' && operation.method === 'POST') {
      throw {
        kind: 'permission_error',
        statusCode: 403,
        responseBody: { code: 'rest_forbidden', message: 'Forbidden' }
      };
    }
    return originalExecute(operation, payload);
  };

  // Assert (initial)
  assert.equal(readOnlyClient.calls.length, 0);

  // Act
  const result = await getSiteCapabilitiesWorkflow(readOnlyClient, fakeConfig);

  // Assert
  assert.equal(result.capabilities.canWritePages, false);
  assert.ok(result.blockedRoutes.some((route) => route.route === '/wp/v2/pages/(?P<id>[\\d]+)'));
});

test('getLiveRenderStateWorkflow: compares stored, REST-rendered, and live frontend layers', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();
  const args = {
    postId: 44,
    postType: 'pages',
    liveUrl: 'https://example.com/sample-page/',
    expectedText: ['Hero Title'],
    forbiddenText: ['Legacy CTA']
  };
  const liveReader = {
    async read(url) {
      return {
        url,
        html: '<html><head><link rel="stylesheet" href="/wp-content/uploads/sites/3/elementor/css/post-44.css?ver=1"></head><body><h1>Hero Title</h1></body></html>'
      };
    }
  };

  // Assert (initial)
  assert.equal(args.postId, 44);

  // Act
  const result = await getLiveRenderStateWorkflow(capabilityClient, fakeConfig, args, liveReader);

  // Assert
  assert.equal(result.workflow, 'workflow_get_live_render_state');
  assert.ok(result.stored.elementorDataHash);
  assert.ok(result.restRendered.htmlHash);
  assert.ok(result.liveFrontend.htmlHash);
  assert.equal(result.stalenessAssessment.restVsStoredMismatch, false);
  assert.equal(result.stalenessAssessment.liveVsStoredMismatch, true);
  assert.equal(result.stalenessAssessment.likelyCacheIssue, true);
  assert.equal(result.generatedCssUrls.length, 1);
});

test('getLiveRenderStateWorkflow: does not flag a mismatch when raw, REST, and live layers contain the same markers with different markup', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();
  capabilityClient.state.content.raw = '<h1>Hero Title</h1><p>Stored body</p>';
  capabilityClient.state.content.rendered = '<div class=\"entry-content\"><h1>Hero Title</h1><p>Stored body</p></div>';
  const args = {
    postId: 44,
    postType: 'pages',
    liveUrl: 'https://example.com/sample-page/',
    expectedText: ['Hero Title', 'Stored body'],
    forbiddenText: ['Legacy CTA']
  };
  const liveReader = {
    async read(url) {
      return {
        url,
        html: '<html><body><main><h1>Hero Title</h1><p>Stored body</p></main></body></html>'
      };
    }
  };

  // Assert (initial)
  assert.match(capabilityClient.state.content.raw, /Hero Title/);

  // Act
  const result = await getLiveRenderStateWorkflow(capabilityClient, fakeConfig, args, liveReader);

  // Assert
  assert.equal(result.stalenessAssessment.restVsStoredMismatch, false);
  assert.equal(result.stalenessAssessment.liveVsStoredMismatch, false);
  assert.equal(result.stalenessAssessment.likelyCacheIssue, false);
});

test('listMenuStructureWorkflow: returns a nested menu tree', async () => {
  // Arrange
  const args = { menuId: 7 };

  // Assert (initial)
  assert.equal(args.menuId, 7);

  // Act
  const result = await listMenuStructureWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_list_menu_structure');
  assert.equal(result.menu.name, 'Main Menu');
  assert.equal(result.tree.length, 2);
  assert.equal(result.tree[1].children[0].title, 'API');
});

test('upsertMenuItemWorkflow: returns a plan before mutation', async () => {
  // Arrange
  const args = { mode: 'plan', menuId: 7, type: 'custom', title: 'Support', url: 'https://example.com/support' };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await upsertMenuItemWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_upsert_menu_item');
  assert.equal(result.mode, 'plan');
  assert.ok(result.steps.length >= 3);
});

test('upsertMenuItemWorkflow: creates a custom menu item and returns refreshed tree', async () => {
  // Arrange
  const args = {
    mode: 'execute',
    confirm: true,
    menuId: 7,
    type: 'custom',
    title: 'Support',
    url: 'https://example.com/support',
    menuOrder: 4
  };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await upsertMenuItemWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_upsert_menu_item');
  assert.equal(result.item.id, 201);
  assert.equal(result.menu.name, 'Main Menu');
  assert.ok(Array.isArray(result.tree));
});

test('assignMenuLocationsWorkflow: validates locations before mutation', async () => {
  // Arrange
  const args = { mode: 'plan', menuId: 7, locations: ['primary'] };

  // Assert (initial)
  assert.equal(args.locations[0], 'primary');

  // Act
  const result = await assignMenuLocationsWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_assign_menu_locations');
  assert.ok(result.availableLocations.includes('primary'));
});

test('assignMenuLocationsWorkflow: updates menu locations in execute mode', async () => {
  // Arrange
  const args = { mode: 'execute', confirm: true, menuId: 7, locations: ['primary', 'footer'] };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await assignMenuLocationsWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_assign_menu_locations');
  assert.deepEqual(result.menu.locations, ['primary', 'footer']);
});

test('reorderMenuItemsWorkflow: returns a plan for changed menu ordering', async () => {
  // Arrange
  const args = {
    mode: 'plan',
    menuId: 7,
    items: [
      { itemId: 101, menuOrder: 1, parentId: 0 },
      { itemId: 103, menuOrder: 2, parentId: 0 },
      { itemId: 102, menuOrder: 3, parentId: 0 }
    ]
  };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await reorderMenuItemsWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_reorder_menu_items');
  assert.equal(result.mode, 'plan');
  assert.equal(result.changes.length, 2);
});

test('reorderMenuItemsWorkflow: executes parent and order changes', async () => {
  // Arrange
  const calls = [];
  const trackingClient = {
    async execute(operation, payload) {
      calls.push({ operation: operation.toolName, payload });
      return fakeMenuClient.execute(operation, payload);
    }
  };
  const args = {
    mode: 'execute',
    confirm: true,
    menuId: 7,
    tree: [
      {
        itemId: 101,
        children: []
      },
      {
        itemId: 102,
        children: []
      },
      {
        itemId: 103,
        children: []
      }
    ]
  };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await reorderMenuItemsWorkflow(trackingClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_reorder_menu_items');
  assert.ok(result.updatedItems.length >= 1);
  assert.ok(calls.some((call) => call.operation === 'wp_v2_menu_items_id_update_post'));
});

test('cloneMenuWorkflow: returns a plan before mutation', async () => {
  // Arrange
  const args = { mode: 'plan', sourceMenuId: 7, targetName: 'Cloned Menu' };

  // Assert (initial)
  assert.equal(args.sourceMenuId, 7);

  // Act
  const result = await cloneMenuWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_clone_menu');
  assert.equal(result.mode, 'plan');
  assert.ok(result.steps.length >= 3);
});

test('cloneMenuWorkflow: clones menu items and locations in execute mode', async () => {
  // Arrange
  const args = {
    mode: 'execute',
    confirm: true,
    sourceMenuId: 7,
    targetName: 'Cloned Menu',
    cloneLocations: true
  };

  // Assert (initial)
  assert.equal(args.cloneLocations, true);

  // Act
  const result = await cloneMenuWorkflow(fakeMenuClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_clone_menu');
  assert.equal(result.targetMenu.id, 27);
  assert.equal(result.clonedItems.length, 3);
  assert.ok(Array.isArray(result.clonedLocations));
});

test('nexportBlogPostWorkflow: applies safe NexPort defaults', async () => {
  // Arrange
  const args = { mode: 'plan', title: 'Release Post' };

  // Assert (initial)
  assert.equal(args.title, 'Release Post');

  // Act
  const result = await nexportBlogPostWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.mode, 'plan');
  assert.ok(result.notes.length > 0);
});

test('inspectElementorHistoryWorkflow: returns Elementor audit for revision-like records', async () => {
  // Arrange
  const args = { postType: 'pages', kind: 'revision', parentId: 22, historyId: 5 };

  // Assert (initial)
  assert.equal(args.kind, 'revision');

  // Act
  const result = await inspectElementorHistoryWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_inspect_elementor_history');
  assert.equal(result.elementor.is_elementor, true);
  assert.equal(result.contextUsed, 'edit');
});

test('cloneElementorDocumentWorkflow: returns plan guidance before mutation', async () => {
  // Arrange
  const args = { mode: 'plan', sourcePostType: 'pages', sourcePostId: 44 };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await cloneElementorDocumentWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.mode, 'plan');
  assert.ok(result.steps.length >= 3);
});

test('cloneElementorDocumentWorkflow: clones a source Elementor document in execute mode', async () => {
  // Arrange
  const args = {
    mode: 'execute',
    confirm: true,
    sourcePostType: 'pages',
    sourcePostId: 44,
    targetPostType: 'pages',
    title: 'Cloned Page'
  };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await cloneElementorDocumentWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_clone_elementor_document');
  assert.equal(result.clone.post.title, 'Cloned Page');
  assert.equal(result.clone.audit.is_elementor, true);
});

test('validateElementorDocumentWorkflow: returns validation envelope for inspected document', async () => {
  // Arrange
  const args = { postType: 'pages', postId: 44 };

  // Assert (initial)
  assert.equal(args.postType, 'pages');

  // Act
  const result = await validateElementorDocumentWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_validate_elementor_document');
  assert.ok(Array.isArray(result.validation.issues));
  assert.ok(Array.isArray(result.validation.warnings));
  assert.ok(Array.isArray(result.validation.findings));
});

test('updateElementorWidgetWorkflow: patches one widget and returns before and after settings', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();
  const args = {
    mode: 'execute',
    confirm: true,
    postId: 44,
    postType: 'pages',
    widgetId: 'heading',
    expectedWidgetType: 'heading',
    settingsPatch: {
      title: 'Updated Hero Title',
      title_color: '#C58A1E'
    }
  };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await updateElementorWidgetWorkflow(capabilityClient, args, fakeConfig);

  // Assert
  assert.equal(result.workflow, 'workflow_update_elementor_widget');
  assert.equal(result.before.title, 'Hero Title');
  assert.equal(result.after.title, 'Updated Hero Title');
  assert.equal(result.after.title_color, '#C58A1E');
  assert.equal(result.storedUpdated, true);
});

test('patchElementorDocumentWorkflow: applies ordered document operations and returns a structural diff summary', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();
  const args = {
    mode: 'execute',
    confirm: true,
    postId: 44,
    postType: 'pages',
    operations: [
      {
        op: 'insertAfter',
        targetId: 'heading',
        element: {
          id: 'cta',
          elType: 'widget',
          widgetType: 'button',
          settings: { text: 'Contact Us', link: { url: '/contact' } },
          elements: []
        }
      }
    ]
  };

  // Assert (initial)
  assert.equal(args.operations.length, 1);

  // Act
  const result = await patchElementorDocumentWorkflow(capabilityClient, args, fakeConfig);

  // Assert
  assert.equal(result.workflow, 'workflow_patch_elementor_document');
  assert.equal(result.diffSummary.widgetsAdded, 1);
  assert.equal(result.storedUpdated, true);
  assert.ok(Array.isArray(result.warnings));
});

test('publishAndVerifyElementorPageWorkflow: reports live verification failure separately from stored update success', async () => {
  // Arrange
  const capabilityClient = createMutableElementorClient();
  const args = {
    mode: 'execute',
    confirm: true,
    postId: 44,
    postType: 'pages',
    update: {
      type: 'widget',
      widgetId: 'heading',
      expectedWidgetType: 'heading',
      settingsPatch: {
        title: 'Updated Hero Title'
      }
    },
    purgeCache: true,
    liveUrl: 'https://example.com/sample-page/',
    expectedText: ['Updated Hero Title'],
    forbiddenText: ['Legacy CTA']
  };
  const liveReader = {
    async read(url) {
      return {
        url,
        html: '<html><body><h1>Updated Hero Title</h1><p>Legacy CTA</p></body></html>'
      };
    }
  };

  // Assert (initial)
  assert.equal(args.purgeCache, true);

  // Act
  const result = await publishAndVerifyElementorPageWorkflow(capabilityClient, fakeConfig, args, liveReader);

  // Assert
  assert.equal(result.workflow, 'workflow_publish_and_verify_elementor_page');
  assert.equal(result.storedUpdated, true);
  assert.equal(result.cachePurged, true);
  assert.equal(result.liveUpdated, false);
  assert.deepEqual(result.verification.forbiddenTextFound, ['Legacy CTA']);
});

test('diffElementorDocumentsWorkflow: compares source against revision target', async () => {
  // Arrange
  const args = {
    sourcePostType: 'pages',
    sourcePostId: 44,
    targetKind: 'revision',
    targetPostType: 'pages',
    targetParentId: 44,
    targetHistoryId: 7
  };

  // Assert (initial)
  assert.equal(args.targetKind, 'revision');

  // Act
  const result = await diffElementorDocumentsWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_diff_elementor_documents');
  assert.ok(result.diff.summary_delta.total_elements >= 0);
  assert.ok(result.source.validation);
  assert.ok(result.target.validation);
});

test('importElementorDocumentMediaWorkflow: returns a guarded plan before mutation', async () => {
  // Arrange
  const args = { mode: 'plan', postType: 'pages', documentId: 44 };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await importElementorDocumentMediaWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_import_elementor_document_media');
  assert.equal(result.mode, 'plan');
  assert.ok(result.steps.length >= 3);
});

test('importElementorDocumentMediaWorkflow: executes import after validation passes', async () => {
  // Arrange
  const args = { mode: 'execute', confirm: true, postType: 'pages', documentId: 44 };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await importElementorDocumentMediaWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_import_elementor_document_media');
  assert.equal(result.before.validation.ok, true);
  assert.ok(result.importResult);
  assert.ok(result.after.validation);
});

test('cleanupElementorKitWorkflow: returns a guarded plan before deletion', async () => {
  // Arrange
  const args = { mode: 'plan', documentId: 44 };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await cleanupElementorKitWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_cleanup_elementor_kit');
  assert.equal(result.mode, 'plan');
  assert.equal(result.cleanupStrategy.forceKitDeleteAvailable, true);
});

test('cleanupElementorKitWorkflow: stops at Elementor confirmation flow without explicit opt-in', async () => {
  // Arrange
  const confirmationClient = {
    async execute(operation, payload) {
      if (operation.method === 'DELETE') {
        throw {
          statusCode: 500,
          wpCode: 'cant_delete_kit',
          responseBody:
            '<h4>Are you sure you want to delete your Site Settings?</h4><a href="?force_delete_kit=1">Delete</a>'
        };
      }

      return fakeClient.execute(operation, payload);
    }
  };
  const args = { mode: 'execute', confirm: true, documentId: 44 };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act / Assert
  await assert.rejects(
    () => cleanupElementorKitWorkflow(confirmationClient, args),
    (error) =>
      error.kind === 'validation_error' &&
      /confirmation flow/.test(error.message)
  );
});

test('cleanupElementorKitWorkflow: retries with force_delete_kit when explicitly allowed', async () => {
  // Arrange
  const calls = [];
  const confirmationThenDeleteClient = {
    async execute(operation, payload) {
      calls.push({ operation, payload });
      if (operation.method === 'DELETE' && payload.force_delete_kit !== 1) {
        throw {
          statusCode: 500,
          wpCode: 'cant_delete_kit',
          responseBody:
            '<h4>Are you sure you want to delete your Site Settings?</h4><a href="?force_delete_kit=1">Delete</a>'
        };
      }

      return fakeClient.execute(operation, payload);
    }
  };
  const args = { mode: 'execute', confirm: true, documentId: 44, allowForceKitDelete: true };

  // Assert (initial)
  assert.equal(args.allowForceKitDelete, true);

  // Act
  const result = await cleanupElementorKitWorkflow(confirmationThenDeleteClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_cleanup_elementor_kit');
  assert.equal(result.pathUsed, 'force_delete_kit');
  assert.equal(calls.filter((call) => call.operation.method === 'DELETE').length, 2);
  assert.equal(calls.at(-1).payload.force_delete_kit, 1);
});

test('cleanupElementorKitWorkflow: reports browser-admin cleanup when force_delete_kit still fails', async () => {
  // Arrange
  const stubbornConfirmationClient = {
    async execute(operation, payload) {
      if (operation.method === 'DELETE') {
        throw {
          statusCode: 500,
          wpCode: 'cant_delete_kit',
          responseBody:
            '<h4>Are you sure you want to delete your Site Settings?</h4><a href="https://test.example/wp-admin/admin.php?page=elementor-app&force_delete_kit=1">Delete</a>'
        };
      }

      return fakeClient.execute(operation, payload);
    }
  };
  const args = { mode: 'execute', confirm: true, documentId: 44, allowForceKitDelete: true };

  // Assert (initial)
  assert.equal(args.documentId, 44);

  // Act / Assert
  await assert.rejects(
    () => cleanupElementorKitWorkflow(stubbornConfirmationClient, args),
    (error) =>
      error.kind === 'validation_error' &&
      /browser-admin confirmation flow/.test(error.message) &&
      /force_delete_kit=1/.test(error.details.confirmationUrl)
  );
});

test('restoreElementorCandidateWorkflow: returns a guarded plan with a restore recommendation', async () => {
  // Arrange
  const args = {
    mode: 'plan',
    postType: 'pages',
    targetPostId: 44,
    candidateKind: 'revision',
    candidateId: 7
  };

  // Assert (initial)
  assert.equal(args.mode, 'plan');

  // Act
  const result = await restoreElementorCandidateWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_restore_elementor_candidate');
  assert.equal(result.mode, 'plan');
  assert.equal(result.recommendation.canRestore, true);
  assert.ok(result.steps.length >= 3);
  assert.ok(result.diff);
});

test('restoreElementorCandidateWorkflow: restores a validated candidate while preserving live status', async () => {
  // Arrange
  const args = {
    mode: 'execute',
    confirm: true,
    postType: 'pages',
    targetPostId: 44,
    candidateKind: 'revision',
    candidateId: 7
  };

  // Assert (initial)
  assert.equal(args.confirm, true);

  // Act
  const result = await restoreElementorCandidateWorkflow(fakeClient, args);

  // Assert
  assert.equal(result.workflow, 'workflow_restore_elementor_candidate');
  assert.equal(result.restoreResult.status, 'draft');
  assert.equal(result.candidate.validation.ok, true);
  assert.ok(result.after.validation);
});

test('restoreElementorCandidateWorkflow: blocks execution when the candidate fails Elementor validation', async () => {
  // Arrange
  const invalidCandidateClient = {
    async execute(operation, payload) {
      if (operation.route.includes('/revisions/') || operation.route.includes('/autosaves/')) {
        return {
          data: {
            id: payload.id,
            title: { raw: 'Broken Candidate', rendered: 'Broken Candidate' },
            content: { raw: '<p>Broken</p>', rendered: '<p>Broken</p>' },
            excerpt: { raw: 'Broken', rendered: 'Broken' },
            status: 'draft',
            slug: 'broken-candidate',
            type: 'page',
            template: 'elementor_theme',
            meta: {
              _elementor_edit_mode: 'builder',
              _elementor_template_type: 'wp-page',
              _elementor_data: '{not-json',
              _elementor_page_settings: '{}',
              _elementor_conditions: '[]'
            }
          }
        };
      }

      return fakeClient.execute(operation, payload);
    }
  };
  const args = {
    mode: 'execute',
    confirm: true,
    postType: 'pages',
    targetPostId: 44,
    candidateKind: 'revision',
    candidateId: 7
  };

  // Assert (initial)
  assert.equal(args.candidateKind, 'revision');

  // Act / Assert
  await assert.rejects(
    () => restoreElementorCandidateWorkflow(invalidCandidateClient, args),
    (error) =>
      error.kind === 'validation_error' &&
      /failed restore safety checks/.test(error.message)
  );
});
