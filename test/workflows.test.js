import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneElementorDocumentWorkflow,
  draftOrUpdatePostWorkflow,
  diffElementorDocumentsWorkflow,
  importElementorDocumentMediaWorkflow,
  inspectElementorHistoryWorkflow,
  nexportBlogPostWorkflow,
  restoreElementorCandidateWorkflow,
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
