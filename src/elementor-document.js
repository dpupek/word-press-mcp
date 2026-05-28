function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, patch) {
  if (!isObject(target) || !isObject(patch)) {
    return deepClone(patch);
  }

  const merged = deepClone(target);
  for (const [key, value] of Object.entries(patch)) {
    if (isObject(value) && isObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = deepClone(value);
    }
  }
  return merged;
}

function countStructure(elements) {
  const summary = {
    containers: 0,
    widgets: 0,
    widgetTypes: {}
  };

  function visit(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node?.elType === 'container' || node?.isInner !== undefined) {
        summary.containers += 1;
      }
      if (node?.elType === 'widget') {
        summary.widgets += 1;
        const widgetType = node?.widgetType || 'unknown';
        summary.widgetTypes[widgetType] = (summary.widgetTypes[widgetType] || 0) + 1;
      }
      visit(node?.elements);
    }
  }

  visit(elements);
  return summary;
}

function assertStableElementId(element) {
  if (typeof element?.id === 'string' && element.id.trim()) return;
  throw {
    kind: 'validation_error',
    message: 'Inserted Elementor elements must include a stable string id.',
    details: { element }
  };
}

export function parseElementorDocument(raw) {
  if (Array.isArray(raw)) {
    return { ok: true, elements: deepClone(raw), error: null };
  }

  if (typeof raw !== 'string') {
    return {
      ok: false,
      elements: [],
      error: 'Elementor document data must be a JSON string or parsed array.'
    };
  }

  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return {
        ok: false,
        elements: [],
        error: 'Elementor document data must parse to an array.'
      };
    }
    return { ok: true, elements: value, error: null };
  } catch (error) {
    return { ok: false, elements: [], error: error.message };
  }
}

export function findElementById(elements, targetId, parent = null, path = []) {
  if (!Array.isArray(elements)) return null;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element?.id === targetId) {
      return {
        element,
        parent,
        index,
        path: [...path, index],
        siblings: elements
      };
    }

    const child = findElementById(element?.elements, targetId, element, [...path, index, 'elements']);
    if (child) return child;
  }

  return null;
}

export function applyWidgetSettingsPatch(elements, args) {
  const nextElements = deepClone(elements);
  const found = findElementById(nextElements, args.widgetId);

  if (!found) {
    throw {
      kind: 'validation_error',
      message: `Widget ${args.widgetId} was not found in the Elementor document.`,
      details: { widgetId: args.widgetId }
    };
  }

  if (found.element?.elType !== 'widget') {
    throw {
      kind: 'validation_error',
      message: `Element ${args.widgetId} is not an Elementor widget.`,
      details: { widgetId: args.widgetId, elType: found.element?.elType || null }
    };
  }

  if (args.expectedWidgetType && found.element?.widgetType !== args.expectedWidgetType) {
    throw {
      kind: 'validation_error',
      message: `Widget ${args.widgetId} is ${found.element?.widgetType || 'unknown'}, not ${args.expectedWidgetType}.`,
      details: {
        widgetId: args.widgetId,
        actualWidgetType: found.element?.widgetType || null,
        expectedWidgetType: args.expectedWidgetType
      }
    };
  }

  const before = deepClone(found.element?.settings || {});
  found.element.settings = args.replaceExistingSettings
    ? deepClone(args.settingsPatch || {})
    : deepMerge(found.element?.settings || {}, args.settingsPatch || {});

  return {
    elements: nextElements,
    widget: found.element,
    before,
    after: deepClone(found.element.settings || {})
  };
}

function replaceFoundElement(found, replacement) {
  assertStableElementId(replacement);
  found.siblings.splice(found.index, 1, deepClone(replacement));
}

function insertRelative(found, element, direction) {
  assertStableElementId(element);
  found.siblings.splice(found.index + direction, 0, deepClone(element));
}

function appendChild(found, element) {
  assertStableElementId(element);
  found.element.elements = Array.isArray(found.element.elements) ? found.element.elements : [];
  found.element.elements.push(deepClone(element));
}

function moveFoundElement(nextElements, operation) {
  const source = findElementById(nextElements, operation.elementId);
  if (!source) {
    throw {
      kind: 'validation_error',
      message: `Element ${operation.elementId} was not found in the Elementor document.`,
      details: { elementId: operation.elementId }
    };
  }

  const moving = source.siblings.splice(source.index, 1)[0];
  const target = findElementById(nextElements, operation.targetId);
  if (!target) {
    throw {
      kind: 'validation_error',
      message: `Target ${operation.targetId} was not found in the Elementor document.`,
      details: { targetId: operation.targetId }
    };
  }

  if (operation.position === 'before') {
    target.siblings.splice(target.index, 0, moving);
  } else if (operation.position === 'after') {
    target.siblings.splice(target.index + 1, 0, moving);
  } else {
    target.element.elements = Array.isArray(target.element.elements) ? target.element.elements : [];
    target.element.elements.push(moving);
  }
}

export function applyElementorDocumentOperations(elements, operations) {
  let nextElements = deepClone(elements);

  for (const operation of operations || []) {
    if (operation.op === 'replaceWidgetSettings' || operation.op === 'mergeWidgetSettings') {
      nextElements = applyWidgetSettingsPatch(nextElements, {
        widgetId: operation.widgetId,
        expectedWidgetType: operation.expectedWidgetType,
        settingsPatch: operation.settingsPatch,
        replaceExistingSettings: operation.op === 'replaceWidgetSettings'
      }).elements;
      continue;
    }

    if (operation.op === 'moveElement') {
      moveFoundElement(nextElements, operation);
      continue;
    }

    const targetId = operation.targetId || operation.elementId;
    const found = findElementById(nextElements, targetId);
    if (!found) {
      throw {
        kind: 'validation_error',
        message: `Target ${targetId} was not found in the Elementor document.`,
        details: { operation }
      };
    }

    switch (operation.op) {
      case 'replaceElement':
        replaceFoundElement(found, operation.element);
        break;
      case 'insertBefore':
        insertRelative(found, operation.element, 0);
        break;
      case 'insertAfter':
        insertRelative(found, operation.element, 1);
        break;
      case 'appendChild':
        appendChild(found, operation.element);
        break;
      case 'removeElement':
        found.siblings.splice(found.index, 1);
        break;
      case 'replaceContainerChildren':
        found.element.elements = Array.isArray(operation.children) ? deepClone(operation.children) : [];
        for (const child of found.element.elements) {
          assertStableElementId(child);
        }
        break;
      default:
        throw {
          kind: 'validation_error',
          message: `Unsupported Elementor document operation: ${operation.op}.`,
          details: { operation }
        };
    }
  }

  return nextElements;
}

export function summarizeElementorStructuralDiff(beforeElements, afterElements) {
  const before = countStructure(beforeElements);
  const after = countStructure(afterElements);
  const beforeIds = new Map();
  const afterIds = new Map();

  function collectIds(elements, store) {
    if (!Array.isArray(elements)) return;
    for (const element of elements) {
      if (typeof element?.id === 'string' && element.id) {
        store.set(element.id, element);
      }
      collectIds(element?.elements, store);
    }
  }

  collectIds(beforeElements, beforeIds);
  collectIds(afterElements, afterIds);

  const widgetTypesChanged = [];
  for (const [id, beforeElement] of beforeIds.entries()) {
    const afterElement = afterIds.get(id);
    if (!afterElement) continue;
    if (beforeElement?.widgetType && afterElement?.widgetType && beforeElement.widgetType !== afterElement.widgetType) {
      widgetTypesChanged.push({
        id,
        before: beforeElement.widgetType,
        after: afterElement.widgetType
      });
    }
  }

  return {
    widgetsAdded: Math.max(0, after.widgets - before.widgets),
    widgetsRemoved: Math.max(0, before.widgets - after.widgets),
    containersAdded: Math.max(0, after.containers - before.containers),
    containersRemoved: Math.max(0, before.containers - after.containers),
    widgetTypesChanged
  };
}
