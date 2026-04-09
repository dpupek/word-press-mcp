import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { translateWpError } from './error-translation.js';
import { buildOperationInputSchema, enforceMutationConfirmation, validateSpecialOperationArgs } from './tool-runtime.js';
import { loadOperations } from './generator.js';
import { createLogger } from './logger.js';
import { createWpClient } from './wp-client.js';
import { jsonResult } from './utils.js';
import { loadAgentBootstrap, loadGeneratedCatalog, loadStaticHelp } from './help.js';
import { augmentElementorSchema, enrichElementorResponse, maybeApplyElementorOptions } from './elementor.js';
import {
  assignMenuLocationsWorkflow,
  cloneElementorDocumentWorkflow,
  cloneMenuWorkflow,
  cleanupElementorKitWorkflow,
  draftOrUpdatePostWorkflow,
  diffElementorDocumentsWorkflow,
  getPostUrlsWorkflow,
  getElementorTemplateConditionsWorkflow,
  inspectElementorHistoryWorkflow,
  inspectPostWorkflow,
  inspectElementorDocumentWorkflow,
  importElementorDocumentMediaWorkflow,
  listMenuStructureWorkflow,
  listElementorTemplatesWorkflow,
  mediaFeaturedImageWorkflow,
  nexportBlogPostWorkflow,
  reorderMenuItemsWorkflow,
  restoreElementorCandidateWorkflow,
  taxonomyReconcileWorkflow,
  upsertMenuItemWorkflow,
  validateElementorDocumentWorkflow,
  validateFilePath,
  validateSlugOrTitleArgs
} from './workflows.js';

const noopSchema = {};

function identityShape(schemaShape) {
  return Object.fromEntries(Object.entries(schemaShape).map(([key, value]) => [key, value]));
}

export async function startServer() {
  const config = getConfig();
  const logger = createLogger(config);
  const client = createWpClient(config, logger);
  const operations = loadOperations();

  const mcpServer = new McpServer({
    name: 'wordpress-mcp',
    version: '0.1.0'
  });

  function registerTool(name, description, schemaShape, handler) {
    mcpServer.registerTool(
      name,
      {
        title: name,
        description,
        inputSchema: identityShape(schemaShape)
      },
      async (args) => {
        try {
          return await handler(args || {});
        } catch (error) {
          logger.warn('tool failed', { name, error: error.message || String(error) });
          return jsonResult({
            ok: false,
            tool: name,
            error: translateWpError(error)
          });
        }
      }
    );
  }

  mcpServer.resource(
    'agent_bootstrap',
    'agent_bootstrap',
    { description: 'WordPress MCP agent bootstrap guidance', mimeType: 'text/markdown' },
    async () => ({
      contents: [{ uri: 'agent_bootstrap', mimeType: 'text/markdown', text: loadAgentBootstrap() }]
    })
  );

  mcpServer.resource(
    'help',
    'help',
    { description: 'WordPress MCP help', mimeType: 'text/markdown' },
    async () => ({
      contents: [{ uri: 'help', mimeType: 'text/markdown', text: loadStaticHelp() }]
    })
  );

  mcpServer.resource(
    'tool_catalog',
    'tool_catalog',
    { description: 'Generated WordPress MCP tool catalog', mimeType: 'text/markdown' },
    async () => ({
      contents: [{ uri: 'tool_catalog', mimeType: 'text/markdown', text: loadGeneratedCatalog() }]
    })
  );

  registerTool('agent_bootstrap', 'Return task-oriented bootstrap guidance for agents using this WordPress MCP server.', noopSchema, async () =>
    jsonResult({ ok: true, markdown: loadAgentBootstrap() })
  );
  registerTool('help', 'Explain how to configure and use the WordPress MCP tools.', noopSchema, async () =>
    jsonResult({ ok: true, markdown: loadStaticHelp() })
  );
  registerTool('tool_catalog', 'Return the generated WordPress MCP tool catalog.', noopSchema, async () =>
    jsonResult({ ok: true, markdown: loadGeneratedCatalog() })
  );
  registerTool('version', 'Return the WordPress MCP server version.', noopSchema, async () =>
    jsonResult({ ok: true, name: 'wordpress-mcp', version: '0.1.0', routeCount: operations.length })
  );
  registerTool('health', 'Check WordPress MCP configuration and API connectivity.', noopSchema, async () =>
    jsonResult({ ok: true, ...(await client.healthCheck()) })
  );

  for (const operation of operations) {
    const schemaShape = augmentElementorSchema(buildOperationInputSchema(operation), operation, z);
    registerTool(operation.toolName, operation.description, schemaShape, async (args) => {
      const { requestArgs, elementorOptions } = maybeApplyElementorOptions(operation, args, config);
      enforceMutationConfirmation(operation, config, requestArgs);
      validateSpecialOperationArgs(operation, requestArgs);
      const result = await client.execute(operation, requestArgs);
      return jsonResult({
        ok: true,
        tool: operation.toolName,
        route: operation.route,
        method: operation.method,
        statusCode: result.statusCode,
        requestUrl: result.requestUrl,
        data: enrichElementorResponse(result.data, elementorOptions)
      });
    });
  }

  registerTool(
    'workflow_list_menu_structure',
    'Return a menu, its assigned locations, and a nested tree of menu items.',
    {
      menuId: z.number().int()
    },
    async (args) => jsonResult(await listMenuStructureWorkflow(client, args))
  );

  registerTool(
    'workflow_upsert_menu_item',
    'Plan or execute a safe create/update flow for a WordPress menu item.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      menuId: z.number().int(),
      itemId: z.number().int().optional(),
      title: z.any().optional(),
      type: z.enum(['taxonomy', 'post_type', 'post_type_archive', 'custom']).optional(),
      status: z.enum(['publish', 'future', 'draft', 'pending', 'private']).optional(),
      parentId: z.number().int().optional(),
      attrTitle: z.string().optional(),
      classes: z.array(z.string()).optional(),
      description: z.string().optional(),
      menuOrder: z.number().int().optional(),
      object: z.string().optional(),
      objectId: z.number().int().optional(),
      target: z.enum(['_blank', '']).optional(),
      url: z.string().optional(),
      xfn: z.array(z.string()).optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await upsertMenuItemWorkflow(client, args))
  );

  registerTool(
    'workflow_assign_menu_locations',
    'Plan or execute assignment of a WordPress menu to one or more menu locations.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      menuId: z.number().int(),
      locations: z.array(z.string()),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await assignMenuLocationsWorkflow(client, args))
  );

  registerTool(
    'workflow_reorder_menu_items',
    'Plan or execute a safe reordering and parent-move flow for WordPress menu items.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      menuId: z.number().int(),
      items: z
        .array(
          z.object({
            itemId: z.number().int(),
            parentId: z.number().int().optional(),
            menuOrder: z.number().int().optional()
          })
        )
        .optional(),
      tree: z
        .array(
          z.object({
            itemId: z.number().int(),
            menuOrder: z.number().int().optional(),
            children: z
              .array(
                z.object({
                  itemId: z.number().int(),
                  menuOrder: z.number().int().optional(),
                  children: z.array(z.any()).optional()
                })
              )
              .optional()
          })
        )
        .optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await reorderMenuItemsWorkflow(client, args))
  );

  registerTool(
    'workflow_clone_menu',
    'Plan or execute a safe clone of a classic WordPress menu, its items, and optional location assignments.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      sourceMenuId: z.number().int(),
      targetName: z.string().optional(),
      targetSlug: z.string().optional(),
      description: z.string().optional(),
      cloneLocations: z.boolean().optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await cloneMenuWorkflow(client, args))
  );

  registerTool(
    'workflow_draft_or_update_post',
    'Plan or shape a safe WordPress post create/update flow.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      title: z.string().optional(),
      status: z.string().optional(),
      content: z.string().optional(),
      excerpt: z.string().optional(),
      categories: z.array(z.any()).optional(),
      tags: z.array(z.any()).optional(),
      existingPostId: z.number().int().optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await draftOrUpdatePostWorkflow(client, args))
  );

  registerTool(
    'workflow_media_featured_image',
    'Plan or shape a media upload and featured image assignment flow.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      postId: z.number().int(),
      filePath: z.string(),
      confirm: z.boolean().optional()
    },
    async (args) => {
      validateFilePath(args.filePath);
      return jsonResult(await mediaFeaturedImageWorkflow(client, args));
    }
  );

  registerTool(
    'workflow_taxonomy_reconcile',
    'Inspect category and tag matches before post mutation.',
    {
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional()
    },
    async (args) => jsonResult(await taxonomyReconcileWorkflow(client, args))
  );

  registerTool(
    'workflow_get_post_urls',
    'Return the public and preview URL candidates for a WordPress post or page.',
    {
      postType: z.enum(['posts', 'pages']).default('posts'),
      postId: z.number().int()
    },
    async (args) => jsonResult(await getPostUrlsWorkflow(client, config, args))
  );

  registerTool(
    'workflow_inspect_post',
    'Inspect a WordPress post, including Elementor editability signals when present.',
    {
      postId: z.number().int().optional(),
      slug: z.string().optional(),
      title: z.string().optional()
    },
    async (args) => {
      validateSlugOrTitleArgs(args);
      if (args.postId) {
        return jsonResult(await inspectPostWorkflow(client, args));
      }
      return jsonResult({
        ok: true,
        workflow: 'workflow_inspect_post',
        mode: 'plan',
        actionable: 'Resolve postId first using the generated list/search tools, then rerun with postId for a deterministic inspection.',
        selectors: args
      });
    }
  );

  registerTool(
    'workflow_inspect_elementor_document',
    'Inspect a post, page, or Elementor template and return a structured Elementor audit.',
    {
      postType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      postId: z.number().int()
    },
    async (args) => jsonResult(await inspectElementorDocumentWorkflow(client, args))
  );

  registerTool(
    'workflow_validate_elementor_document',
    'Validate an Elementor-authored post, page, or template and return issues and warnings.',
    {
      postType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      postId: z.number().int()
    },
    async (args) => jsonResult(await validateElementorDocumentWorkflow(client, args))
  );

  registerTool(
    'workflow_list_elementor_templates',
    'List Elementor templates from the WordPress template library and the Elementor site editor.',
    {
      includeConditions: z.boolean().optional()
    },
    async (args) => jsonResult(await listElementorTemplatesWorkflow(client, args))
  );

  registerTool(
    'workflow_get_elementor_template_conditions',
    'Return Elementor site-editor conditions for a specific template ID.',
    {
      templateId: z.string()
    },
    async (args) => jsonResult(await getElementorTemplateConditionsWorkflow(client, args))
  );

  registerTool(
    'workflow_inspect_elementor_history',
    'Inspect a revision or autosave for a post, page, or Elementor template and return a structured Elementor audit.',
    {
      postType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      kind: z.enum(['revision', 'autosave']),
      parentId: z.number().int(),
      historyId: z.number().int()
    },
    async (args) => jsonResult(await inspectElementorHistoryWorkflow(client, args))
  );

  registerTool(
    'workflow_clone_elementor_document',
    'Plan or execute a safe clone of an Elementor-authored document into a new draft.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      sourcePostType: z.enum(['posts', 'pages', 'elementor_library']).optional(),
      sourcePostId: z.number().int(),
      targetPostType: z.enum(['posts', 'pages', 'elementor_library']).optional(),
      title: z.string().optional(),
      status: z.string().optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await cloneElementorDocumentWorkflow(client, args))
  );

  registerTool(
    'workflow_cleanup_elementor_kit',
    'Plan or execute a guarded cleanup of an Elementor kit or site-settings record.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      documentId: z.number().int(),
      allowForceKitDelete: z.boolean().optional(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await cleanupElementorKitWorkflow(client, args))
  );

  registerTool(
    'workflow_import_elementor_document_media',
    'Plan or execute a guarded Elementor document media import for an existing Elementor-authored document.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      postType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      documentId: z.number().int(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await importElementorDocumentMediaWorkflow(client, args))
  );

  registerTool(
    'workflow_diff_elementor_documents',
    'Diff one Elementor document against another document, revision, or autosave.',
    {
      sourcePostType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      sourcePostId: z.number().int(),
      targetKind: z.enum(['document', 'revision', 'autosave']),
      targetPostType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      targetPostId: z.number().int().optional(),
      targetParentId: z.number().int().optional(),
      targetHistoryId: z.number().int().optional()
    },
    async (args) => jsonResult(await diffElementorDocumentsWorkflow(client, args))
  );

  registerTool(
    'workflow_restore_elementor_candidate',
    'Plan or execute a guarded restore of an Elementor revision or autosave onto the live document.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      postType: z.enum(['posts', 'pages', 'elementor_library']).default('posts'),
      targetPostId: z.number().int(),
      candidateKind: z.enum(['revision', 'autosave']),
      candidateId: z.number().int(),
      confirm: z.boolean().optional()
    },
    async (args) => jsonResult(await restoreElementorCandidateWorkflow(client, args))
  );

  registerTool(
    'workflow_nexport_blog_post',
    'Plan or shape a NexPort-specific blog publishing flow with site conventions and safety guidance.',
    {
      mode: z.enum(['plan', 'execute']).optional(),
      title: z.string().optional(),
      status: z.string().optional(),
      template: z.string().optional(),
      content: z.string().optional(),
      excerpt: z.string().optional(),
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      filePath: z.string().optional(),
      confirm: z.boolean().optional()
    },
    async (args) => {
      if (args.filePath) validateFilePath(args.filePath);
      return jsonResult(await nexportBlogPostWorkflow(client, args));
    }
  );

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('wordpress-mcp connected', { transport: 'stdio', routeCount: operations.length });
}
